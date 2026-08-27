<?php
// Stellar Apex — API front controller. All /api/* requests route here.
// Same-origin with the SPA on Hostinger, so no CORS is needed.

require_once __DIR__ . '/src/config.php';
require_once __DIR__ . '/src/db.php';
require_once __DIR__ . '/src/http.php';
require_once __DIR__ . '/src/auth.php';
require_once __DIR__ . '/src/audit.php';
require_once __DIR__ . '/src/employees.php';
require_once __DIR__ . '/src/onboarding.php';

set_exception_handler(function (Throwable $e) {
    error_log('[api] ' . $e->getMessage());
    json_error('Internal error', 500);
});

// CORS — only when configured (cross-origin prod, e.g. a tunnelled backend).
// Same-origin deploys leave CORS_ORIGIN empty and emit no headers.
$corsEnv = getenv('CORS_ORIGIN');
if ($corsEnv) {
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    $allowed = array_map('trim', explode(',', $corsEnv));
    if (in_array($origin, $allowed, true)) {
        header("Access-Control-Allow-Origin: $origin");
        header('Vary: Origin');
        header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Entity');
        header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    }
    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

// ---- Resolve route: strip everything up to and including '/api' ----
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?? '/';
$pos = strpos($uri, '/api');
$path = $pos !== false ? substr($uri, $pos + 4) : $uri;   // e.g. '/employees/123'
$path = '/' . trim($path, '/');
$method = $_SERVER['REQUEST_METHOD'];
$segments = $path === '/' ? [] : explode('/', ltrim($path, '/'));

// ---- Router ----
if ($method === 'GET' && $path === '/health') {
    db()->query('SELECT 1');
    json_response(['ok' => true]);
}

/* ---- PUBLIC field onboarding (no auth; multipart/form-data) ----
   Writes to the pending queue only — never to employees. Photos stored
   outside the web root; IP rate-limited. */
if ($method === 'POST' && $path === '/onboard') {
    $ip = client_ip() ?? '0.0.0.0';
    if (onboard_rate_limited($ip)) json_error('Too many submissions from this connection. Try again later.', 429);

    $name = trim($_POST['name'] ?? '');
    $designation = strtoupper(trim($_POST['designation'] ?? ''));
    if ($name === '' || mb_strlen($name) > 96) json_error('Name is required', 422);
    if (!in_array($designation, ONBOARD_DESIGNATIONS, true)) json_error('Designation must be TM, ASM, RSM, or ZSM', 422);

    $num = function ($k) {
        $v = trim($_POST[$k] ?? '');
        if ($v === '') return null;
        $v = str_replace([',', ' '], '', $v);
        if (!is_numeric($v) || (float) $v < 0 || (float) $v > 99999999) json_error("Invalid amount for $k", 422);
        return (float) $v;
    };
    $fixedSalary = $num('fixedSalary');
    $expense = $num('expenseComponent');

    // Both sides of both documents are required.
    $labels = [
        'aadhaarFront' => 'Aadhaar front photo', 'aadhaarBack' => 'Aadhaar back photo',
        'panFront' => 'PAN front photo', 'panBack' => 'PAN back photo',
    ];
    foreach (ONBOARD_PHOTOS as $field => $stem) {
        if (empty($_FILES[$field]['tmp_name'])) json_error($labels[$field] . ' is required', 422);
    }

    $id = ulid();
    $stored = [];
    foreach (ONBOARD_PHOTOS as $field => $stem) {
        $fn = store_photo($_FILES[$field], $id, $stem);
        if (str_starts_with($fn, '!')) json_error($labels[$field] . ': ' . substr($fn, 1), 422);
        $stored[$stem] = $fn;
    }

    db()->prepare(
        'INSERT INTO onboarding_submissions
           (id, entity_id, name, designation, area, location, fixed_salary, expense_component,
            aadhaar_front_photo, aadhaar_back_photo, pan_front_photo, pan_back_photo, ip)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )->execute([
        $id, 'noble', $name, $designation,
        trim($_POST['area'] ?? '') ?: null,
        trim($_POST['location'] ?? '') ?: null,
        $fixedSalary, $expense,
        $stored['aadhaar_front'], $stored['aadhaar_back'], $stored['pan_front'], $stored['pan_back'], $ip,
    ]);
    audit(null, 'noble', null, 'onboard_submit', null, ['submission' => $id, 'name' => $name]);
    json_response(['ok' => true, 'id' => $id], 201);
}

/* ---- Onboarding queue (auth-gated) ---- */
if ($method === 'GET' && $path === '/onboarding') {
    $user = require_auth();
    require_role($user, 'super_admin', 'entity_admin', 'entity_hr');
    json_response(list_onboarding());
}

if (count($segments) === 4 && $segments[0] === 'onboarding' && $segments[2] === 'photo' && $method === 'GET') {
    $user = require_auth();
    require_role($user, 'super_admin', 'entity_admin', 'entity_hr');
    $row = get_onboarding_row($segments[1]);
    if (!$row) json_error('Not found', 404);
    $which = $segments[3]; // aadhaar_front | aadhaar_back | pan_front | pan_back
    if (!in_array($which, array_values(ONBOARD_PHOTOS), true)) json_error('Not found', 404);
    $file = $row[$which . '_photo'] ?? null;
    if (!$file) json_error('Not found', 404);
    $full = uploads_dir() . '/' . basename($file); // basename: no traversal
    if (!is_file($full)) json_error('Not found', 404);
    audit((int) $user['id'], $row['entity_id'], null, 'onboard_photo_view', $segments[3], ['submission' => $row['id']]);
    $mime = match (pathinfo($full, PATHINFO_EXTENSION)) {
        'png' => 'image/png', 'webp' => 'image/webp', default => 'image/jpeg',
    };
    header('Content-Type: ' . $mime);
    header('Content-Length: ' . filesize($full));
    header('Cache-Control: private, no-store');
    readfile($full);
    exit;
}

if ($method === 'POST' && $path === '/auth/login') {
    $b = json_body();
    $email = strtolower(trim($b['email'] ?? ''));
    $password = $b['password'] ?? '';
    if (!$email || !$password) json_error('email and password required', 400);
    $stmt = db()->prepare('SELECT * FROM users WHERE email = ? AND is_active = 1');
    $stmt->execute([$email]);
    $user = $stmt->fetch();
    if (!$user || !password_verify($password, $user['password_hash'])) {
        json_error('Invalid credentials', 401);
    }
    audit((int) $user['id'], $user['entity_id'], null, 'login');
    json_response([
        'token' => issue_token($user),
        'user'  => ['name' => $user['name'], 'role' => $user['role'], 'entity' => $user['entity_id']],
    ]);
}

if ($method === 'POST' && $path === '/auth/logout') {
    require_auth();
    json_response(['ok' => true]); // stateless — client drops the token
}

if ($method === 'GET' && $path === '/me') {
    $user = require_auth();
    json_response(['user' => ['name' => $user['name'], 'role' => $user['role'], 'entity' => $user['entity_id']]]);
}

if ($method === 'GET' && $path === '/reference') {
    require_auth();
    $entities = db()->query('SELECT * FROM entities')->fetchAll();
    $branches = db()->query('SELECT entity_id, name, is_head_office FROM branches')->fetchAll();
    json_response(['entities' => $entities, 'branches' => $branches]);
}

// ---- /employees ----
if ($path === '/employees' && $method === 'GET') {
    $user = require_auth();
    $entityId = resolve_entity($user);
    json_response(list_employees($entityId, [
        'status'     => $_GET['status'] ?? null,
        'branch'     => $_GET['branch'] ?? null,
        'department' => $_GET['department'] ?? null,
        'q'          => $_GET['q'] ?? null,
    ]));
}

if ($path === '/employees' && $method === 'POST') {
    $user = require_auth();
    require_role($user, 'super_admin', 'entity_admin', 'entity_hr');
    $entityId = resolve_entity($user);
    $body = json_body();
    if ($err = validate_employee($body, $entityId)) json_error($err, 422);
    $stmt = db()->prepare('SELECT code FROM entities WHERE id = ?');
    $stmt->execute([$entityId]);
    $prefix = $stmt->fetch()['code'];
    $created = create_employee($entityId, $prefix, $body);
    audit((int) $user['id'], $entityId, $created['id'], 'create', null, ['code' => $created['code']]);
    json_response($created, 201);
}

if (count($segments) >= 2 && $segments[0] === 'employees') {
    $id = $segments[1];
    $sub = $segments[2] ?? null;

    if ($sub === 'reveal' && $method === 'POST') {
        $user = require_auth();
        require_role($user, 'super_admin', 'entity_admin', 'entity_hr');
        $entityId = resolve_entity($user);
        $field = json_body()['field'] ?? '';
        if (!in_array($field, ['aadhaar', 'pan', 'bank'], true)) json_error('field must be aadhaar | pan | bank', 400);
        $row = get_row($entityId, $id);
        if (!$row) json_error('Not found', 404);
        $value = reveal_field($row, $field);
        audit((int) $user['id'], $entityId, $id, "reveal_$field", $field);
        json_response(['field' => $field, 'value' => $value]);
    }

    if ($sub === null && $method === 'GET') {
        $user = require_auth();
        $entityId = resolve_entity($user);
        $row = get_row($entityId, $id);
        if (!$row) json_error('Not found', 404); // cross-entity => 404, never 403
        json_response(row_to_api($row));
    }

    if ($sub === null && $method === 'PUT') {
        $user = require_auth();
        require_role($user, 'super_admin', 'entity_admin', 'entity_hr');
        $entityId = resolve_entity($user);
        $existing = get_row($entityId, $id);
        if (!$existing) json_error('Not found', 404);
        $body = json_body();
        if ($err = validate_employee($body, $entityId, true)) json_error($err, 422);
        // Merge over existing IN CLEARTEXT so a partial PUT preserves omitted
        // sensitive fields (row_to_api alone would carry masks).
        $base = array_merge(row_to_api($existing), decrypt_sensitive($existing));
        $merged = array_merge($base, $body);
        foreach (['bank', 'address', 'emergencyContact'] as $grp) {
            if (isset($body[$grp]) && is_array($body[$grp])) {
                $merged[$grp] = array_merge($base[$grp] ?? [], $body[$grp]);
            }
        }
        $updated = update_employee($entityId, $id, $merged);
        audit((int) $user['id'], $entityId, $id, 'update');
        json_response($updated);
    }

    if ($sub === null && $method === 'DELETE') {
        $user = require_auth();
        require_role($user, 'super_admin', 'entity_admin');
        $entityId = resolve_entity($user);
        $existing = get_row($entityId, $id);
        if (!$existing) json_error('Not found', 404);
        db()->prepare("UPDATE employees SET status = 'exited', exit_date = COALESCE(exit_date, CURDATE()) WHERE id = ? AND entity_id = ?")
            ->execute([$id, $entityId]);
        audit((int) $user['id'], $entityId, $id, 'delete');
        json_response(['ok' => true]);
    }
}

json_error('Not found', 404);
