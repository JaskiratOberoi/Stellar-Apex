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

// PUT /onboarding/:id { status, employeeId? } — mark a submission processed
// (optionally linking the employee created from it), rejected, or pending again.
function route_onboarding_actions(string $method, string $path, array $segments): void {
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
