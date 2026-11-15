<?php
// Outgoing email. Each entity sends from its own mailbox over authenticated
// SMTP (Hostinger: smtp.hostinger.com, port 465 SSL), so mail to Ares staff
// comes from the Ares address and never from the other entity's.
//
// Settings live in app_config()['mail'][<entity id>] (see config.php). An
// entity with no password configured has email switched off: mail_enabled()
// is false and send_mail() throws.
//
//   send_mail('ares', 'someone@example.com', 'Subject', "Plain text body");
//   send_mail('ares', $to, $subject, $text, $html, ['to_name' => 'Asha Rao']);

require_once __DIR__ . '/config.php';

function mail_settings(string $entity): ?array {
    $m = app_config()['mail'][$entity] ?? null;
    if (!$m || empty($m['user']) || empty($m['pass']) || empty($m['host'])) return null;
    $m['port']      = (int) ($m['port'] ?? 465);
    $m['secure']    = $m['secure'] ?? ($m['port'] === 465 ? 'ssl' : 'tls');
    $m['from']      = $m['from'] ?? $m['user'];
    $m['from_name'] = $m['from_name'] ?? '';
    return $m;
}

function mail_enabled(string $entity): bool {
    return mail_settings($entity) !== null;
}

/**
 * Send one message from the entity's mailbox. Throws RuntimeException with a
 * safe, loggable reason on any failure (never includes the password).
 * $opts: to_name, reply_to.
 */
function send_mail(string $entity, string $to, string $subject, string $text, ?string $html = null, array $opts = []): void {
    $m = mail_settings($entity);
    if (!$m) throw new RuntimeException("Email is not configured for entity '$entity'");
    if (!filter_var($to, FILTER_VALIDATE_EMAIL)) throw new RuntimeException('Invalid recipient address');
    $replyTo = $opts['reply_to'] ?? ($m['reply_to'] ?? null);
    if ($replyTo && !filter_var($replyTo, FILTER_VALIDATE_EMAIL)) $replyTo = null;

    $domain = substr(strrchr($m['from'], '@') ?: '@localhost', 1);
    $headers = [
        'Date: ' . date('r'),
        'From: ' . mail_address($m['from'], $m['from_name']),
        'To: ' . mail_address($to, $opts['to_name'] ?? ''),
        'Subject: ' . mail_header_text($subject),
        'Message-ID: <' . bin2hex(random_bytes(12)) . '@' . $domain . '>',
        'MIME-Version: 1.0',
        'Auto-Submitted: auto-generated',
    ];
    if ($replyTo) $headers[] = 'Reply-To: <' . $replyTo . '>';

    $part = fn (string $type, string $body) =>
        "Content-Type: $type; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n" . chunk_split(base64_encode($body));

    if ($html === null) {
        $message = implode("\r\n", $headers) . "\r\n" . $part('text/plain', $text);
    } else {
        $b = 'b' . bin2hex(random_bytes(12));
        $message = implode("\r\n", $headers) . "\r\n"
            . "Content-Type: multipart/alternative; boundary=\"$b\"\r\n\r\n"
            . "--$b\r\n" . $part('text/plain', $text)
            . "--$b\r\n" . $part('text/html', $html)
            . "--$b--\r\n";
    }

    smtp_deliver($m, $to, $message);
}

/* ---------------------------- internals ---------------------------- */

// Header values must never carry a line break (header injection).
function mail_header_text(string $s): string {
    $s = trim(preg_replace('/[\r\n]+/', ' ', $s));
    return preg_match('/[^\x20-\x7E]/', $s) ? mb_encode_mimeheader($s, 'UTF-8', 'B', "\r\n") : $s;
}

function mail_address(string $email, string $name = ''): string {
    $name = trim(preg_replace('/[\r\n"<>]+/', ' ', $name));
    if ($name === '') return "<$email>";
    $shown = preg_match('/[^\x20-\x7E]/', $name) ? mb_encode_mimeheader($name, 'UTF-8', 'B', "\r\n") : '"' . $name . '"';
    return "$shown <$email>";
}

function smtp_deliver(array $m, string $to, string $message): void {
    $timeout = 15;
    $remote = ($m['secure'] === 'ssl' ? 'ssl://' : 'tcp://') . $m['host'] . ':' . $m['port'];
    $errno = 0; $errstr = '';
    $fp = @stream_socket_client($remote, $errno, $errstr, $timeout);
    if (!$fp) throw new RuntimeException("Could not reach mail server {$m['host']}:{$m['port']} ($errstr)");
    stream_set_timeout($fp, $timeout);

    // Read one (possibly multi-line) reply and require the expected code.
    $expect = function (int $code, string $step) use ($fp): string {
        $reply = '';
        while (($line = fgets($fp, 1024)) !== false) {
            $reply .= $line;
            if (strlen($line) < 4 || $line[3] === ' ') break;
        }
        if ((int) substr($reply, 0, 3) !== $code) {
            fclose($fp);
            throw new RuntimeException("Mail server refused at $step: " . trim(substr($reply, 0, 200) ?: 'no reply'));
        }
        return $reply;
    };
    $say = function (string $line) use ($fp): void { fwrite($fp, $line . "\r\n"); };

    $helo = gethostname() ?: 'localhost';
    $expect(220, 'greeting');
    $say("EHLO $helo"); $expect(250, 'EHLO');
    if ($m['secure'] === 'tls') {
        $say('STARTTLS'); $expect(220, 'STARTTLS');
        if (!stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
            fclose($fp);
            throw new RuntimeException('Could not start TLS with the mail server');
        }
        $say("EHLO $helo"); $expect(250, 'EHLO after STARTTLS');
    }
    $say('AUTH LOGIN');               $expect(334, 'AUTH');
    $say(base64_encode($m['user']));  $expect(334, 'AUTH user');
    $say(base64_encode($m['pass']));  $expect(235, 'sign-in (check the mailbox password)');
    $say("MAIL FROM:<{$m['from']}>"); $expect(250, 'MAIL FROM');
    $say("RCPT TO:<$to>");            $expect(250, 'RCPT TO');
    $say('DATA');                     $expect(354, 'DATA');
    // Bodies are base64, so only header lines could start with a dot; stuff anyway.
    fwrite($fp, preg_replace('/^\./m', '..', $message) . "\r\n.\r\n");
    $expect(250, 'message accept');
    $say('QUIT');
    fclose($fp);
}
