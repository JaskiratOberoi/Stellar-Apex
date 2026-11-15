<?php
// Send one test email from an entity's mailbox, to check the SMTP settings.
//   php api/tools/mail-test.php ares someone@example.com
// CLI only.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }

require_once __DIR__ . '/../src/mail.php';

[$entity, $to] = [$argv[1] ?? '', $argv[2] ?? ''];
if ($entity === '' || $to === '') {
    fwrite(STDERR, "Usage: php api/tools/mail-test.php <entity> <recipient>\n");
    exit(2);
}

$m = mail_settings($entity);
if (!$m) {
    fwrite(STDERR, "[mail] not configured for '$entity' (no mailbox password set)\n");
    exit(1);
}
echo "[mail] {$m['from']} via {$m['host']}:{$m['port']} ({$m['secure']}) -> $to\n";

try {
    send_mail(
        $entity, $to, 'Stellar Apex test email',
        "This is a test email from the Stellar Apex HR portal.\n\nIf you received it, outgoing email is working.\n",
        '<p>This is a test email from the <strong>Stellar Apex</strong> HR portal.</p><p>If you received it, outgoing email is working.</p>'
    );
    echo "[mail] accepted by the mail server\n";
} catch (RuntimeException $e) {
    fwrite(STDERR, '[mail] FAILED: ' . $e->getMessage() . "\n");
    exit(1);
}
