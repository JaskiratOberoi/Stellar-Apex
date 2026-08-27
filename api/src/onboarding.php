<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/employees.php'; // ulid()

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
        'createdAt'        => $r['created_at'],
    ];
}

function list_onboarding(): array {
    $rows = db()->query('SELECT * FROM onboarding_submissions ORDER BY created_at DESC LIMIT 500')->fetchAll();
    return array_map('onboarding_row_to_api', $rows);
}

function get_onboarding_row(string $id): ?array {
    $stmt = db()->prepare('SELECT * FROM onboarding_submissions WHERE id = ?');
    $stmt->execute([$id]);
    return $stmt->fetch() ?: null;
}
