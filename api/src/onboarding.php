<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/employees.php'; // ulid(), get_row()
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/audit.php';

/* Public field-onboarding submissions. Photos are stored OUTSIDE the web root
   (uploads_dir) and are only ever served through the auth-gated photo route. */

const ONBOARD_DESIGNATIONS = ['TM', 'ASM', 'RSM', 'ZSM'];
const ONBOARD_MAX_PHOTO_BYTES = 8 * 1024 * 1024; // 8 MB
const ONBOARD_IP_HOURLY_LIMIT = 15;
// form field name => db column stem; both sides of both documents are required
const ONBOARD_PHOTOS = [
    'aadhaarFront' => 'aadhaar_front',
    'aadhaarBack'  => 'aadhaar_back',
    'panFront'     => 'pan_front',
    'panBack'      => 'pan_back',
];

function uploads_dir(): string {
    $dir = app_config()['uploads_dir'];
    if (!is_dir($dir)) @mkdir($dir, 0770, true);
    return $dir;
}

// Validate + store one uploaded photo. Returns stored filename, or an error
// string prefixed with '!'. Never trusts the client's filename or MIME type.
function store_photo(array $file, string $submissionId, string $which) {
    if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) return '!upload failed';
    if ($file['size'] > ONBOARD_MAX_PHOTO_BYTES) return '!photo too large (max 8 MB)';
    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);
    $ext = match ($mime) {
        'image/jpeg' => 'jpg',
        'image/png'  => 'png',
        'image/webp' => 'webp',
        default      => null,
    };
    if (!$ext) return '!photo must be a JPEG, PNG, or WebP image';
    $name = $submissionId . '_' . $which . '.' . $ext;
    if (!move_uploaded_file($file['tmp_name'], uploads_dir() . '/' . $name)) return '!could not store photo';
    return $name;
}

function onboard_rate_limited(string $ip): bool {
    $stmt = db()->prepare(
        'SELECT COUNT(*) AS n FROM onboarding_submissions
         WHERE ip = ? AND created_at > NOW() - INTERVAL 1 HOUR'
    );
    $stmt->execute([$ip]);
    return (int) $stmt->fetch()['n'] >= ONBOARD_IP_HOURLY_LIMIT;
}

function onboarding_row_to_api(array $r): array {
    return [
        'id'               => $r['id'],
        'entity'           => $r['entity_id'],
        'name'             => $r['name'],
        'designation'      => $r['designation'],
        'area'             => $r['area'],
        'location'         => $r['location'],
        'fixedSalary'      => $r['fixed_salary'] !== null ? (float) $r['fixed_salary'] : null,
        'expenseComponent' => $r['expense_component'] !== null ? (float) $r['expense_component'] : null,
        'photos'           => [
            'aadhaarFront' => !empty($r['aadhaar_front_photo']),
            'aadhaarBack'  => !empty($r['aadhaar_back_photo']),
            'panFront'     => !empty($r['pan_front_photo']),
            'panBack'      => !empty($r['pan_back_photo']),
        ],
        'status'           => $r['status'],
        'employeeId'       => $r['employee_id'] ?? null,
        'createdAt'        => $r['created_at'],
    ];
}

// Both lookups take the caller's entity: a submission (and its Aadhaar/PAN
// photos) is only ever visible inside the portal it was submitted to.
// $entityId is optional only so a request racing a deploy cannot fatal.
function list_onboarding(?string $entityId = null): array {
    if ($entityId === null) return [];
    $stmt = db()->prepare('SELECT * FROM onboarding_submissions WHERE entity_id = ? ORDER BY created_at DESC LIMIT 500');
    $stmt->execute([$entityId]);
    return array_map('onboarding_row_to_api', $stmt->fetchAll());
}

function get_onboarding_row(string $entityId, ?string $id = null): ?array {
    if ($id === null) return null;
    $stmt = db()->prepare('SELECT * FROM onboarding_submissions WHERE id = ? AND entity_id = ?');
    $stmt->execute([$id, $entityId]);
    return $stmt->fetch() ?: null;
}

/* ---- Emailing the form link ---- */

const ONBOARD_INVITE_HOURLY_LIMIT = 40; // per entity

// Address of this entity's public form. Noble keeps the original /onboard.
function onboarding_form_url(string $entityId): ?string {
    $base = app_config()['app_url'];
    if ($base === '') {
        // Local dev is same-origin through the Vite proxy: trust a localhost Origin only.
        $origin = request_header('Origin') ?? '';
        if (!preg_match('#^https?://(localhost|127\.0\.0\.1)(:\d+)?$#', $origin)) return null;
        $base = $origin;
    }
    return $base . '/onboard' . ($entityId === 'noble' ? '' : '/' . rawurlencode($entityId));
}

function onboarding_invite_email(array $entity, string $url, string $name): array {
    $company = $entity['brand'] ?: $entity['legal_name'];
    $hello = $name !== '' ? "Hello $name," : 'Hello,';
    $text = "$hello\n\n"
        . "Welcome to $company. To complete your joining formalities, please fill in the onboarding form:\n\n"
        . "$url\n\n"
        . "It takes about two minutes. Keep your Aadhaar and PAN cards handy, as the form asks for a photo of both sides of each.\n\n"
        . "This is an automated message from an unattended mailbox. For any question, please contact the HR team.\n\n"
        . "{$entity['legal_name']}\n";
    $e = fn (string $s) => htmlspecialchars($s, ENT_QUOTES, 'UTF-8');
    $html = '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#1c1c1c;max-width:520px">'
        . '<p>' . $e($hello) . '</p>'
        . '<p>Welcome to ' . $e($company) . '. To complete your joining formalities, please fill in the onboarding form.</p>'
        . '<p style="margin:24px 0"><a href="' . $e($url) . '" style="background:' . ($entity['id'] === 'noble' ? '#3b3897' : '#8f6b1d') . ';color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:8px;display:inline-block">Open the onboarding form</a></p>'
        . '<p>It takes about two minutes. Keep your Aadhaar and PAN cards handy, as the form asks for a photo of both sides of each.</p>'
        . '<p style="font-size:13px;color:#666666">If the button does not work, copy this link into your browser:<br>' . $e($url) . '</p>'
        . '<p style="font-size:13px;color:#666666">This is an automated message from an unattended mailbox. For any question, please contact the HR team.</p>'
        . '<p style="font-size:13px;color:#666666">' . $e($entity['legal_name']) . '</p>'
        . '</div>';
    return ["$company: your onboarding form", $text, $html];
}

// GET  /onboarding/invite            → { enabled, from }
// POST /onboarding/invite { email, name? } → emails this portal's form link
function route_onboarding_invite(string $method, array $segments): void {
    if ($segments !== ['onboarding', 'invite'] || !in_array($method, ['GET', 'POST'], true)) return;
    require_once __DIR__ . '/mail.php';
    $user = require_auth();
    require_role($user, 'super_admin', 'entity_admin', 'entity_hr');
    $entityId = resolve_entity($user);
    $m = mail_settings($entityId);

    if ($method === 'GET') json_response(['enabled' => $m !== null, 'from' => $m['from'] ?? null]);

    if (!$m) json_error('Email is not set up for this portal yet', 409);
    $b = json_body();
    $email = trim((string) ($b['email'] ?? ''));
    $name = trim(preg_replace('/\s+/', ' ', (string) ($b['name'] ?? '')));
    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 190) json_error('Enter a valid email address', 422);
    if (mb_strlen($name) > 96) json_error('Name is too long', 422);

    $sent = db()->prepare("SELECT COUNT(*) AS n FROM audit_log WHERE entity_id = ? AND action = 'onboard_invite' AND created_at > NOW() - INTERVAL 1 HOUR");
    $sent->execute([$entityId]);
    if ((int) $sent->fetch()['n'] >= ONBOARD_INVITE_HOURLY_LIMIT) json_error('Too many invites sent in the last hour. Try again later.', 429);

    $url = onboarding_form_url($entityId);
    if (!$url) json_error('The app address (APP_URL) is not configured on the server', 500);
    $stmt = db()->prepare('SELECT * FROM entities WHERE id = ?');
    $stmt->execute([$entityId]);
    [$subject, $text, $html] = onboarding_invite_email($stmt->fetch(), $url, $name);

    try {
        send_mail($entityId, $email, $subject, $text, $html, ['to_name' => $name]);
    } catch (RuntimeException $e) {
        error_log('[mail] onboarding invite failed: ' . $e->getMessage());
        audit((int) $user['id'], $entityId, null, 'onboard_invite_failed', null, ['to' => $email]);
        json_error('The email could not be sent. Check the address, or try again in a minute.', 502);
    }
    audit((int) $user['id'], $entityId, null, 'onboard_invite', null, ['to' => $email, 'name' => $name ?: null]);
    json_response(['ok' => true, 'to' => $email]);
}

// PUT /onboarding/:id { status, employeeId? } — mark a submission processed
// (optionally linking the employee created from it), rejected, or pending again.
function route_onboarding_actions(string $method, string $path, array $segments): void {
    route_onboarding_invite($method, $segments);
    if (count($segments) !== 2 || $segments[0] !== 'onboarding' || $method !== 'PUT') return;
    $user = require_auth();
    require_role($user, 'super_admin', 'entity_admin', 'entity_hr');
    $entityId = resolve_entity($user);
    $row = get_onboarding_row($entityId, $segments[1]);
    if (!$row) json_error('Not found', 404);
    $b = json_body();
    $status = $b['status'] ?? '';
    if (!in_array($status, ['pending', 'processed', 'rejected'], true)) json_error('Invalid status', 422);
    $employeeId = $b['employeeId'] ?? null;
    if ($employeeId !== null && !get_row($entityId, $employeeId)) json_error('Unknown employee', 422);
    if (array_key_exists('employee_id', $row)) {
        db()->prepare('UPDATE onboarding_submissions SET status = ?, employee_id = COALESCE(?, employee_id) WHERE id = ?')
            ->execute([$status, $employeeId, $row['id']]);
    } else {
        db()->prepare('UPDATE onboarding_submissions SET status = ? WHERE id = ?')->execute([$status, $row['id']]);
    }
    audit((int) $user['id'], $entityId, $employeeId, "onboard_$status", null, ['submission' => $row['id']]);
    json_response(onboarding_row_to_api(get_onboarding_row($entityId, $row['id'])));
}
