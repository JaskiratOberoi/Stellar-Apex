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
