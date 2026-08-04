<?php
// Generate a bcrypt hash for a password, to paste into the users table.
// Usage (CLI):  php api/tools/hash.php 'MyNewPassword'
if (PHP_SAPI !== 'cli') { http_response_code(403); exit('CLI only'); }
$pw = $argv[1] ?? null;
if (!$pw) { fwrite(STDERR, "Usage: php hash.php '<password>'\n"); exit(1); }
echo password_hash($pw, PASSWORD_BCRYPT), "\n";
