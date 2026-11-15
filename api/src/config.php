<?php
// Config loader. Resolution order per key:
//   1. api/config.php   (hand-created on Hostinger; returns an overrides array)
//   2. environment vars (set by docker-compose in local dev)
//   3. built-in dev defaults
// So the SAME code runs on Hostinger (config.php) and in Docker (env) unchanged.

function app_config(): array {
    static $cfg = null;
    if ($cfg !== null) return $cfg;

    $overridesFile = __DIR__ . '/../config.php';
    $overrides = is_file($overridesFile) ? (require $overridesFile) : [];

    $env = function (string $k, $default = null) {
        $v = getenv($k);
        return $v !== false ? $v : $default;
    };

    $defaults = [
        'db_host'     => $env('DB_HOST', 'localhost'),
        'db_port'     => (int) $env('DB_PORT', 3306),
        'db_name'     => $env('DB_NAME', 'stellar_apex'),
        'db_user'     => $env('DB_USER', 'apex'),
        'db_pass'     => $env('DB_PASSWORD', 'apexpass'),
        // Secrets — override in production.
        'jwt_secret'  => $env('JWT_SECRET', 'dev-only-change-me-jwt-secret'),
        'jwt_ttl'     => (int) $env('JWT_TTL', 28800), // seconds (8h)
        // 32-byte AES key as 64 hex chars. Generate: openssl rand -hex 32
        'enc_key_hex' => $env('ENC_KEY', '0f1e2d3c4b5a69788796a5b4c3d2e1f00f1e2d3c4b5a69788796a5b4c3d2e1f0'),
        // Onboarding photo storage — MUST be outside the web root. Docker sets
        // UPLOADS_DIR=/var/uploads; the fallback suits a Hostinger-style layout
        // (one level above public_html/.../api).
        'uploads_dir' => $env('UPLOADS_DIR', __DIR__ . '/../../uploads'),
        // Public address of the web app, used for links in emails. Falls back
        // to the first CORS_ORIGIN (the frontend origin in a cross-origin deploy).
        'app_url'     => rtrim($env('APP_URL', trim(explode(',', (string) $env('CORS_ORIGIN', ''))[0])), '/'),
        // Outgoing email, one mailbox per entity (see src/mail.php). An entity
        // is switched on by giving it a password: MAIL_ARES_PASSWORD etc.
        'mail' => [
            'ares' => [
                'host'      => $env('MAIL_ARES_HOST', 'smtp.hostinger.com'),
                'port'      => (int) $env('MAIL_ARES_PORT', 465),
                'secure'    => $env('MAIL_ARES_SECURE'), // ssl | tls | none; default follows the port
                'user'      => $env('MAIL_ARES_USER', 'no-reply@ares-labs.com'),
                'pass'      => $env('MAIL_ARES_PASSWORD', ''),
                'from_name' => $env('MAIL_ARES_FROM_NAME', 'Ares Labs'),
                'reply_to'  => $env('MAIL_ARES_REPLY_TO'),
            ],
        ],
    ];

    $cfg = array_merge($defaults, $overrides);
    return $cfg;
}

// Reference data validated on write (mirrors src/data/seed.js).
const DEPARTMENTS = [
    'Lab Operations', 'Phlebotomy', 'Pathology', 'Radiology', 'Front Office',
    'Customer Support', 'Sales & Marketing', 'Finance & Accounts',
    'Human Resources', 'IT & Systems', 'Logistics', 'Admin & Facilities',
];
const STATUSES = ['probation', 'active', 'notice', 'exited'];
