<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/crypto.php';
require_once __DIR__ . '/mask.php';
require_once __DIR__ . '/config.php';

/* ---------- ULID (Crockford base32, dependency-free) ---------- */
function ulid(): string {
    $enc = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
    $time = (int) (microtime(true) * 1000);
    $ts = '';
    for ($i = 9; $i >= 0; $i--) { $ts = $enc[$time % 32] . $ts; $time = intdiv($time, 32); }
    $rand = '';
    for ($i = 0; $i < 16; $i++) { $rand .= $enc[random_int(0, 31)]; }
    return $ts . $rand;
}

/* ---------- helpers ---------- */
function null_if_empty(array $obj): ?array {
    foreach ($obj as $v) { if ($v !== null && $v !== '') return $obj; }
    return null;
}

/* ---------- row <-> API shape (docs/BACKEND.md §3) ---------- */
function row_to_api(array $r): array {
    $aadhaar = decrypt_value($r['aadhaar_enc'] ?? null);
    $pan     = decrypt_value($r['pan_enc'] ?? null);
    $account = decrypt_value($r['bank_account_enc'] ?? null);
    return [
        'id'             => $r['id'],
        'code'           => $r['code'],
        'company'        => $r['entity_id'],
        'name'           => $r['name'],
        'photo'          => $r['photo_url'],
        'gender'         => $r['gender'],
        'dob'            => $r['dob'],
        'bloodGroup'     => $r['blood_group'],
        'maritalStatus'  => $r['marital_status'],
        'email'          => $r['email'],
        'personalEmail'  => $r['personal_email'],
        'mobile'         => $r['mobile'],
        'address'        => null_if_empty([
            'line'    => $r['address_line'],
            'city'    => $r['address_city'],
            'state'   => $r['address_state'],
            'pincode' => $r['address_pincode'],
        ]),
        'emergencyContact' => null_if_empty([
            'name'     => $r['ec_name'],
            'relation' => $r['ec_relation'],
            'phone'    => $r['ec_phone'],
        ]),
        'designation'      => $r['designation'],
        'department'       => $r['department'],
        'branch'           => $r['branch'],
        'employmentType'   => $r['employment_type'],
        'workMode'         => $r['work_mode'],
        'reportsTo'        => $r['reports_to'],
        'status'           => $r['status'],
        'joiningDate'      => $r['joining_date'],
        'confirmationDate' => $r['confirmation_date'],
        'lastWorkingDay'   => $r['last_working_day'],
        'exitDate'         => $r['exit_date'],
        'aadhaar'          => mask_aadhaar($aadhaar),
        'pan'              => mask_pan($pan),
        'uan'              => $r['uan'],
        'esiNumber'        => $r['esi_number'],
        'bank'             => null_if_empty([
            'accountName'   => $r['bank_account_name'],
            'accountNumber' => mask_account($account),
            'bankName'      => $r['bank_name'],
            'ifsc'          => $r['bank_ifsc'],
        ]),
    ];
}

// Cleartext sensitive fields (API shape) — for merging a partial PUT. Never sent.
function decrypt_sensitive(array $r): array {
    return [
        'aadhaar' => decrypt_value($r['aadhaar_enc'] ?? null),
        'pan'     => decrypt_value($r['pan_enc'] ?? null),
        'bank'    => [
            'accountName'   => $r['bank_account_name'],
            'accountNumber' => decrypt_value($r['bank_account_enc'] ?? null),
            'bankName'      => $r['bank_name'],
            'ifsc'          => $r['bank_ifsc'],
        ],
    ];
}

// API payload -> DB columns (encrypts sensitive fields).
function api_to_columns(array $b): array {
    $addr = $b['address'] ?? [];
    $ec   = $b['emergencyContact'] ?? [];
    $bank = $b['bank'] ?? [];
    $g = fn($a, $k) => (is_array($a) && isset($a[$k]) && $a[$k] !== '') ? $a[$k] : null;
    $pan = $g($b, 'pan');
    $ifsc = $g($bank, 'ifsc');
    return [
        'name'            => $b['name'] ?? null,
        'photo_url'       => $g($b, 'photo'),
        'gender'          => $g($b, 'gender'),
        'dob'             => $g($b, 'dob'),
        'blood_group'     => $g($b, 'bloodGroup'),
        'marital_status'  => $g($b, 'maritalStatus'),
        'email'           => $g($b, 'email'),
        'personal_email'  => $g($b, 'personalEmail'),
        'mobile'          => $g($b, 'mobile'),
        'address_line'    => $g($addr, 'line'),
        'address_city'    => $g($addr, 'city'),
        'address_state'   => $g($addr, 'state'),
        'address_pincode' => $g($addr, 'pincode'),
        'ec_name'         => $g($ec, 'name'),
        'ec_relation'     => $g($ec, 'relation'),
        'ec_phone'        => $g($ec, 'phone'),
        'designation'     => $g($b, 'designation'),
        'department'      => $g($b, 'department'),
        'branch'          => $g($b, 'branch'),
        'employment_type' => $g($b, 'employmentType'),
        'work_mode'       => $g($b, 'workMode'),
        'reports_to'      => $g($b, 'reportsTo'),
        'status'          => $b['status'] ?? 'probation',
        'joining_date'    => $g($b, 'joiningDate'),
        'confirmation_date' => $g($b, 'confirmationDate'),
        'last_working_day'  => $g($b, 'lastWorkingDay'),
        'exit_date'         => $g($b, 'exitDate'),
        'aadhaar_enc'       => encrypt_value($g($b, 'aadhaar')),
        'pan_enc'           => encrypt_value($pan ? strtoupper($pan) : null),
        'uan'               => $g($b, 'uan'),
        'esi_number'        => $g($b, 'esiNumber'),
        'bank_account_name' => $g($bank, 'accountName'),
        'bank_account_enc'  => encrypt_value($g($bank, 'accountNumber')),
        'bank_name'         => $g($bank, 'bankName'),
        'bank_ifsc'         => $ifsc ? strtoupper($ifsc) : null,
    ];
}

/* ---------- validation ---------- */
function branches_for(string $entityId): array {
    $stmt = db()->prepare('SELECT name FROM branches WHERE entity_id = ?');
    $stmt->execute([$entityId]);
    return array_column($stmt->fetchAll(), 'name');
}

// Returns an error string, or null if valid.
function validate_employee(array $b, string $entityId, bool $partial = false): ?string {
    if (!$partial || array_key_exists('name', $b)) {
        if (empty($b['name']) || trim($b['name']) === '') return 'name is required';
    }
    if (isset($b['department']) && $b['department'] !== null) {
        if (!in_array($b['department'], DEPARTMENTS, true)) return "invalid department: {$b['department']}";
    }
    if (isset($b['branch']) && $b['branch'] !== null && $b['branch'] !== '') {
        if (!in_array($b['branch'], branches_for($entityId), true)) return "invalid branch for entity: {$b['branch']}";
    }
    if (isset($b['status']) && $b['status'] !== null) {
        if (!in_array($b['status'], STATUSES, true)) return "invalid status: {$b['status']}";
    }
    if (!empty($b['reportsTo'])) {
        $stmt = db()->prepare('SELECT id FROM employees WHERE id = ? AND entity_id = ?');
        $stmt->execute([$b['reportsTo'], $entityId]);
        if (!$stmt->fetch()) return 'reportsTo must reference an employee in the same entity';
    }
    return null;
}

/* ---------- queries (ALWAYS scoped by entityId) ---------- */
function list_employees(string $entityId, array $filters = []): array {
    $where = ['entity_id = ?'];
    $params = [$entityId];
    if (!empty($filters['status']))     { $where[] = 'status = ?';     $params[] = $filters['status']; }
    if (!empty($filters['branch']))     { $where[] = 'branch = ?';     $params[] = $filters['branch']; }
    if (!empty($filters['department'])) { $where[] = 'department = ?'; $params[] = $filters['department']; }
    if (!empty($filters['q'])) {
        $where[] = '(name LIKE ? OR code LIKE ? OR designation LIKE ?)';
        $like = '%' . $filters['q'] . '%';
        array_push($params, $like, $like, $like);
    }
    $sql = 'SELECT * FROM employees WHERE ' . implode(' AND ', $where) . ' ORDER BY code';
    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    return array_map('row_to_api', $stmt->fetchAll());
}

function get_row(string $entityId, string $id): ?array {
    $stmt = db()->prepare('SELECT * FROM employees WHERE id = ? AND entity_id = ?');
    $stmt->execute([$id, $entityId]);
    return $stmt->fetch() ?: null;
}

// Create with atomic per-entity code generation (SELECT ... FOR UPDATE).
function create_employee(string $entityId, string $codePrefix, array $body): array {
    $pdo = db();
    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare('SELECT next_seq FROM code_counters WHERE entity_id = ? FOR UPDATE');
        $stmt->execute([$entityId]);
        $row = $stmt->fetch();
        $seq = $row ? (int) $row['next_seq'] : 1;
        $code = $codePrefix . '-' . str_pad((string) $seq, 4, '0', STR_PAD_LEFT);
        $pdo->prepare('UPDATE code_counters SET next_seq = next_seq + 1 WHERE entity_id = ?')->execute([$entityId]);

        $id = ulid();
        $cols = api_to_columns($body);
        $fields = array_merge(['id', 'entity_id', 'code'], array_keys($cols));
        $values = array_merge([$id, $entityId, $code], array_values($cols));
        $placeholders = implode(', ', array_fill(0, count($fields), '?'));
        $sql = 'INSERT INTO employees (' . implode(', ', $fields) . ") VALUES ($placeholders)";
        $pdo->prepare($sql)->execute($values);
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }
    return row_to_api(get_row($entityId, $id));
}

function update_employee(string $entityId, string $id, array $body): ?array {
    $cols = api_to_columns($body);
    $sets = implode(', ', array_map(fn($k) => "$k = ?", array_keys($cols)));
    $values = array_merge(array_values($cols), [$id, $entityId]);
    db()->prepare("UPDATE employees SET $sets WHERE id = ? AND entity_id = ?")->execute($values);
    $row = get_row($entityId, $id);
    return $row ? row_to_api($row) : null;
}

function reveal_field(array $row, string $field): ?string {
    return match ($field) {
        'aadhaar' => decrypt_value($row['aadhaar_enc'] ?? null),
        'pan'     => decrypt_value($row['pan_enc'] ?? null),
        'bank'    => decrypt_value($row['bank_account_enc'] ?? null),
        default   => null,
    };
}
