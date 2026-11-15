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

/* ----------------------------- layout ------------------------------ */

// Look of each entity's emails. Ares: black and gold, logo on top. An entity
// without a theme gets a plain light layout with its name as the header.
const MAIL_THEMES = [
    'ares' => [
        'name'    => 'Ares Labs',
        'legal'   => 'Ares Labs LLP',
        'logo'    => '/brand/ares-full.png', // 1200 x 312, gold on transparent
        'logo_w'  => 168,
        'logo_h'  => 44,
        'page'    => '#0b0804',
        'card'    => '#15100a',
        'line'    => '#3d3319',
        'accent'  => '#d4af37',
        'on_accent' => '#1c1406',
        'heading' => '#f7efd9',
        'text'    => '#d6cbb0',
        'muted'   => '#8f8263',
    ],
];
const MAIL_THEME_PLAIN = [
    'logo' => null, 'page' => '#f3f1ec', 'card' => '#ffffff', 'line' => '#e3dfd6', 'accent' => '#1b6a4a',
    'on_accent' => '#ffffff', 'heading' => '#16201b', 'text' => '#3b4540', 'muted' => '#7b837e',
];

/**
 * Wrap a message in the entity's branded HTML layout. Every string is plain
 * text and is escaped here. $c:
 *   heading    string            the one line the reader must see
 *   paragraphs string[]          body text, in order
 *   button     [label, url]      optional call to action
 *   details    [label => value]  optional small table of facts
 *   note       string            optional small print under the body
 *   preheader  string            optional inbox preview text
 * Written for mail clients: tables, inline styles, no external CSS.
 */
function mail_layout(string $entity, array $c): string {
    $t = (MAIL_THEMES[$entity] ?? []) + MAIL_THEME_PLAIN + ['name' => ucfirst($entity), 'legal' => ucfirst($entity)];
    $e = fn ($s) => htmlspecialchars((string) $s, ENT_QUOTES, 'UTF-8');
    $font = "font-family:'Segoe UI',Helvetica,Arial,sans-serif;";
    $base = app_config()['app_url'];

    // Header: the logo when the app address is known, else the name set in the accent colour.
    // The alt text is styled the same way, so the header still reads with images blocked.
    $wordmark = "{$font}font-size:22px;font-weight:700;letter-spacing:6px;color:{$t['accent']};text-transform:uppercase;";
    $header = ($t['logo'] && $base !== '')
        ? '<img src="' . $e($base . $t['logo']) . '" width="' . $t['logo_w'] . '" height="' . $t['logo_h'] . '" alt="' . $e($t['name'])
            . '" style="display:block;border:0;outline:none;' . $wordmark . '">'
        : '<span style="' . $wordmark . '">' . $e($t['name']) . '</span>';

    $body = '';
    foreach ($c['paragraphs'] ?? [] as $p) {
        $body .= '<p style="margin:0 0 16px;' . $font . 'font-size:15px;line-height:24px;color:' . $t['text'] . ';">' . nl2br($e($p)) . '</p>';
    }
    if (!empty($c['details'])) {
        $rows = '';
        foreach ($c['details'] as $label => $value) {
            $rows .= '<tr><td style="padding:9px 14px;border-top:1px solid ' . $t['line'] . ';' . $font . 'font-size:12px;letter-spacing:1px;text-transform:uppercase;color:' . $t['muted'] . ';">' . $e($label) . '</td>'
                . '<td align="right" style="padding:9px 14px;border-top:1px solid ' . $t['line'] . ';' . $font . 'font-size:14px;font-weight:600;color:' . $t['heading'] . ';">' . $e($value) . '</td></tr>';
        }
        $body .= '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 20px;border:1px solid ' . $t['line'] . ';border-top:0;border-radius:8px;">' . $rows . '</table>';
    }
    if (!empty($c['button'])) {
        [$label, $url] = $c['button'];
        $body .= '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;"><tr>'
            . '<td bgcolor="' . $t['accent'] . '" style="border-radius:8px;">'
            . '<a href="' . $e($url) . '" style="display:inline-block;padding:13px 26px;' . $font . 'font-size:15px;font-weight:700;color:' . $t['on_accent'] . ';text-decoration:none;border-radius:8px;">' . $e($label) . '</a>'
            . '</td></tr></table>'
            . '<p style="margin:0 0 16px;' . $font . 'font-size:12px;line-height:19px;color:' . $t['muted'] . ';">If the button does not work, copy this link into your browser:<br>'
            . '<a href="' . $e($url) . '" style="color:' . $t['accent'] . ';text-decoration:underline;word-break:break-all;">' . $e($url) . '</a></p>';
    }
    if (!empty($c['note'])) {
        $body .= '<p style="margin:0;' . $font . 'font-size:13px;line-height:20px;color:' . $t['muted'] . ';">' . nl2br($e($c['note'])) . '</p>';
    }

    $dark = $t['page'] === MAIL_THEMES['ares']['page'] ? 'dark' : 'light';
    return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">'
        . '<meta name="viewport" content="width=device-width,initial-scale=1">'
        . '<meta name="color-scheme" content="' . $dark . '"><meta name="supported-color-schemes" content="' . $dark . '">'
        . '<title>' . $e($c['heading'] ?? $t['name']) . '</title></head>'
        . '<body style="margin:0;padding:0;background:' . $t['page'] . ';">'
        . (!empty($c['preheader']) ? '<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:' . $t['page'] . ';">' . $e($c['preheader']) . '</div>' : '')
        . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="' . $t['page'] . '" style="background:' . $t['page'] . ';"><tr><td align="center" style="padding:32px 16px;">'
        . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">'
        // logo
        . '<tr><td align="center" style="padding:8px 0 26px;">' . $header . '</td></tr>'
        // card
        . '<tr><td bgcolor="' . $t['card'] . '" style="background:' . $t['card'] . ';border:1px solid ' . $t['line'] . ';border-top:3px solid ' . $t['accent'] . ';border-radius:12px;padding:34px 32px 30px;">'
        . (!empty($c['heading']) ? '<h1 style="margin:0 0 18px;' . $font . 'font-size:23px;line-height:30px;font-weight:700;color:' . $t['heading'] . ';">' . $e($c['heading']) . '</h1>' : '')
        . $body
        . '</td></tr>'
        // footer
        . '<tr><td align="center" style="padding:22px 16px 8px;' . $font . 'font-size:12px;line-height:19px;color:' . $t['muted'] . ';">'
        . '<span style="color:' . $t['accent'] . ';font-weight:600;letter-spacing:1px;">' . $e($t['legal']) . '</span><br>'
        . 'This is an automated message from an unattended mailbox. Please do not reply to it.'
        . '</td></tr>'
        . '</table></td></tr></table></body></html>';
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
