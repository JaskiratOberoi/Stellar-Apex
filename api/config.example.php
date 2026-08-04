<?php
// Copy to api/config.php ON THE SERVER and fill in real values.
// config.php is gitignored and must never be committed.
// On Hostinger: hPanel → MySQL Databases gives you the DB name/user/host/pass.
//
// Generate a fresh AES key:  openssl rand -hex 32
// Generate a JWT secret:     openssl rand -hex 32

return [
    'db_host'     => 'localhost',
    'db_port'     => 3306,
    'db_name'     => 'uXXXXXXXX_stellarapex',
    'db_user'     => 'uXXXXXXXX_apex',
    'db_pass'     => 'REPLACE_WITH_DB_PASSWORD',

    'jwt_secret'  => 'REPLACE_WITH_A_LONG_RANDOM_STRING',
    'jwt_ttl'     => 28800, // 8 hours, in seconds
    'enc_key_hex' => 'REPLACE_WITH_64_HEX_CHARS_FROM_openssl_rand_hex_32',
];
