<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/http.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/audit.php';

/* Organisation structure: department, designation and branch masters, plus
   per-entity settings. Employees refer to masters by name, so a rename
   cascades to the employee rows. */

const BRANCH_TYPES = ['head_office', 'lab', 'collection_centre', 'branch'];

// True once the given table exists (i.e. its migration has been applied).
// Lets code that is deployed ahead of a migration degrade instead of failing.
function table_exists(string $table): bool {
    static $cache = [];
    if (isset($cache[$table])) return $cache[$table];
    $stmt = db()->prepare('SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?');
    $stmt->execute([$table]);
    return $cache[$table] = (bool) $stmt->fetch();
}

function require_tables(string ...$tables): void {
    foreach ($tables as $t) {
        if (!table_exists($t)) json_error('This feature needs a database update. Run api/tools/migrate.php.', 503);
    }
}

/* ---------- settings ---------- */
function default_settings(): array {
    return [
        'weeklyOff' => [0], // 0 = Sunday … 6 = Saturday
        'payroll' => [
            'pfRate'          => 12,
            'pfWageCeiling'   => 15000,
            'esiEmployeeRate' => 0.75,
            'esiEmployerRate' => 3.25,
            'esiWageCeiling'  => 21000,
            // state => [{ upTo: monthly gross or null for "and above", amount }]
            'ptSlabs'         => new stdClass(),
        ],
    ];
}

function entity_settings(string $entityId): array {
    $defaults = json_decode(json_encode(default_settings()), true);
    if (!table_exists('entity_settings')) return $defaults;
    $stmt = db()->prepare('SELECT settings FROM entity_settings WHERE entity_id = ?');
    $stmt->execute([$entityId]);
    $row = $stmt->fetch();
    $saved = $row ? (json_decode($row['settings'], true) ?: []) : [];
    $out = array_merge($defaults, $saved);
    $out['payroll'] = array_merge($defaults['payroll'], $saved['payroll'] ?? []);
    return $out;
}

function save_entity_settings(string $entityId, array $body): array {
    $cur = entity_settings($entityId);
    if (isset($body['weeklyOff']) && is_array($body['weeklyOff'])) {
        $cur['weeklyOff'] = array_values(array_unique(array_filter(
            array_map('intval', $body['weeklyOff']), fn($d) => $d >= 0 && $d <= 6
        )));
    }
    if (isset($body['payroll']) && is_array($body['payroll'])) {
        foreach (['pfRate', 'pfWageCeiling', 'esiEmployeeRate', 'esiEmployerRate', 'esiWageCeiling'] as $k) {
            if (isset($body['payroll'][$k]) && is_numeric($body['payroll'][$k]) && $body['payroll'][$k] >= 0) {
                $cur['payroll'][$k] = (float) $body['payroll'][$k];
            }
        }
        if (isset($body['payroll']['ptSlabs']) && is_array($body['payroll']['ptSlabs'])) {
            $slabs = [];
            foreach ($body['payroll']['ptSlabs'] as $state => $rows) {
                $state = trim((string) $state);
                if ($state === '' || !is_array($rows)) continue;
                $clean = [];
                foreach ($rows as $r) {
                    if (!is_array($r) || !isset($r['amount']) || !is_numeric($r['amount'])) continue;
                    $upTo = isset($r['upTo']) && is_numeric($r['upTo']) ? (float) $r['upTo'] : null;
                    $clean[] = ['upTo' => $upTo, 'amount' => (float) $r['amount']];
                }
                usort($clean, fn($a, $b) => ($a['upTo'] ?? PHP_FLOAT_MAX) <=> ($b['upTo'] ?? PHP_FLOAT_MAX));
                if ($clean) $slabs[$state] = $clean;
            }
            $cur['payroll']['ptSlabs'] = $slabs;
        }
    }
    db()->prepare('INSERT INTO entity_settings (entity_id, settings) VALUES (?, ?)
                   ON DUPLICATE KEY UPDATE settings = VALUES(settings)')
        ->execute([$entityId, json_encode($cur)]);
    return $cur;
}

/* ---------- reference (masters for the active entity) ---------- */
function reference_data(string $entityId): array {
    $pdo = db();
    $ent = $pdo->prepare('SELECT * FROM entities WHERE id = ?');
    $ent->execute([$entityId]);
    $e = $ent->fetch();

    if (!table_exists('departments')) {
        // Pre-migration fallback: the original hard-coded lists.
        $b = $pdo->prepare('SELECT id, name, is_head_office FROM branches WHERE entity_id = ? ORDER BY is_head_office DESC, name');
        $b->execute([$entityId]);
        return [
            'entity' => $e,
            'branches' => array_map(fn($r) => [
                'id' => (int) $r['id'], 'name' => $r['name'],
                'type' => $r['is_head_office'] ? 'head_office' : 'branch',
                'city' => null, 'state' => null, 'managerId' => null, 'isActive' => true,
            ], $b->fetchAll()),
            'departments' => array_map(fn($n, $i) => ['id' => $i + 1, 'name' => $n, 'headId' => null, 'isActive' => true], DEPARTMENTS, array_keys(DEPARTMENTS)),
            'designations' => [],
            'settings' => entity_settings($entityId),
            'migrated' => false,
        ];
    }

    $b = $pdo->prepare("SELECT * FROM branches WHERE entity_id = ? ORDER BY (type = 'head_office') DESC, name");
    $b->execute([$entityId]);
    $d = $pdo->prepare('SELECT * FROM departments WHERE entity_id = ? ORDER BY name');
    $d->execute([$entityId]);
    $g = $pdo->prepare('SELECT * FROM designations WHERE entity_id = ? ORDER BY level, name');
    $g->execute([$entityId]);
    return [
        'entity' => $e,
        'branches' => array_map(fn($r) => [
            'id' => (int) $r['id'], 'name' => $r['name'], 'type' => $r['type'],
            'city' => $r['city'], 'state' => $r['state'],
            'managerId' => $r['manager_employee_id'], 'isActive' => (bool) $r['is_active'],
        ], $b->fetchAll()),
        'departments' => array_map(fn($r) => [
            'id' => (int) $r['id'], 'name' => $r['name'],
            'headId' => $r['head_employee_id'], 'isActive' => (bool) $r['is_active'],
        ], $d->fetchAll()),
        'designations' => array_map(fn($r) => [
            'id' => (int) $r['id'], 'name' => $r['name'],
            'level' => (int) $r['level'], 'isActive' => (bool) $r['is_active'],
        ], $g->fetchAll()),
        'settings' => entity_settings($entityId),
        'migrated' => true,
    ];
}

// Active master names for validating an employee write.
function active_names(string $table, string $entityId): array {
    $stmt = db()->prepare("SELECT name FROM $table WHERE entity_id = ? AND is_active = 1");
    $stmt->execute([$entityId]);
    return array_column($stmt->fetchAll(), 'name');
}

// Remember a designation typed on an employee so it shows up as a suggestion.
function remember_designation(string $entityId, ?string $name): void {
    $name = trim((string) $name);
    if ($name === '' || !table_exists('designations')) return;
    db()->prepare('INSERT IGNORE INTO designations (entity_id, name) VALUES (?, ?)')->execute([$entityId, $name]);
}

// Would setting $employeeId's manager to $managerId create a loop?
function creates_reporting_cycle(string $entityId, string $employeeId, string $managerId): bool {
    if ($employeeId === $managerId) return true;
    $stmt = db()->prepare('SELECT reports_to FROM employees WHERE id = ? AND entity_id = ?');
    $seen = [];
    $cur = $managerId;
    while ($cur !== null && !isset($seen[$cur])) {
        $seen[$cur] = true;
        $stmt->execute([$cur, $entityId]);
        $row = $stmt->fetch();
        $cur = $row ? $row['reports_to'] : null;
        if ($cur === $employeeId) return true;
    }
    return false;
}

/* ---------- master CRUD ---------- */
// kind => [table, employee column that stores the name, employee-link column]
const ORG_MASTERS = [
    'departments'  => ['departments', 'department', 'head_employee_id'],
    'designations' => ['designations', 'designation', null],
    'branches'     => ['branches', 'branch', 'manager_employee_id'],
];

function employee_in_entity(string $entityId, ?string $id): bool {
    if ($id === null || $id === '') return true;
    $stmt = db()->prepare('SELECT 1 FROM employees WHERE id = ? AND entity_id = ?');
    $stmt->execute([$id, $entityId]);
    return (bool) $stmt->fetch();
}

function master_columns(string $kind, array $b, string $entityId): array {
    $cols = [];
    if (array_key_exists('name', $b)) {
        $name = trim((string) $b['name']);
        if ($name === '' || mb_strlen($name) > 64) json_error('Name is required (64 characters at most)', 422);
        $cols['name'] = $name;
    }
    if (array_key_exists('isActive', $b)) $cols['is_active'] = $b['isActive'] ? 1 : 0;
    if ($kind === 'departments' && array_key_exists('headId', $b)) {
        if (!employee_in_entity($entityId, $b['headId'])) json_error('Head must be an employee of this entity', 422);
        $cols['head_employee_id'] = $b['headId'] ?: null;
    }
    if ($kind === 'designations' && array_key_exists('level', $b)) {
        $cols['level'] = max(1, min(20, (int) $b['level']));
    }
    if ($kind === 'branches') {
        if (array_key_exists('type', $b)) {
            if (!in_array($b['type'], BRANCH_TYPES, true)) json_error('Invalid branch type', 422);
            $cols['type'] = $b['type'];
            $cols['is_head_office'] = $b['type'] === 'head_office' ? 1 : 0;
        }
        foreach (['city', 'state'] as $k) {
            if (array_key_exists($k, $b)) $cols[$k] = trim((string) $b[$k]) ?: null;
        }
        if (array_key_exists('managerId', $b)) {
            if (!employee_in_entity($entityId, $b['managerId'])) json_error('Manager must be an employee of this entity', 422);
            $cols['manager_employee_id'] = $b['managerId'] ?: null;
        }
    }
    return $cols;
}

function route_org(string $method, string $path, array $segments): void {
    if ($path === '/reference' && $method === 'GET') {
        $user = require_auth();
        json_response(reference_data(resolve_entity($user)));
    }

    if ($path === '/settings' && $method === 'PUT') {
        $user = require_auth();
        require_role($user, 'super_admin', 'entity_admin');
        require_tables('entity_settings');
        $entityId = resolve_entity($user);
        $saved = save_entity_settings($entityId, json_body());
        audit((int) $user['id'], $entityId, null, 'settings_update');
        json_response($saved);
    }

    if (($segments[0] ?? '') !== 'org' || !isset(ORG_MASTERS[$segments[1] ?? ''])) return;
    $kind = $segments[1];
    [$table, $empCol] = ORG_MASTERS[$kind];
    $user = require_auth();
    require_role($user, 'super_admin', 'entity_admin');
    require_tables('departments', 'designations');
    $entityId = resolve_entity($user);
    $pdo = db();

    if (count($segments) === 2 && $method === 'POST') {
        $cols = master_columns($kind, json_body(), $entityId);
        if (!isset($cols['name'])) json_error('Name is required', 422);
        $dup = $pdo->prepare("SELECT 1 FROM $table WHERE entity_id = ? AND name = ?");
        $dup->execute([$entityId, $cols['name']]);
        if ($dup->fetch()) json_error("\"{$cols['name']}\" already exists", 409);
        $fields = array_merge(['entity_id'], array_keys($cols));
        $pdo->prepare("INSERT INTO $table (" . implode(', ', $fields) . ') VALUES (' . implode(', ', array_fill(0, count($fields), '?')) . ')')
            ->execute(array_merge([$entityId], array_values($cols)));
        audit((int) $user['id'], $entityId, null, "org_create_$kind", null, ['name' => $cols['name']]);
        json_response(reference_data($entityId), 201);
    }

    if (count($segments) === 3) {
        $id = (int) $segments[2];
        $find = $pdo->prepare("SELECT * FROM $table WHERE id = ? AND entity_id = ?");
        $find->execute([$id, $entityId]);
        $row = $find->fetch();
        if (!$row) json_error('Not found', 404);

        if ($method === 'PUT') {
            $cols = master_columns($kind, json_body(), $entityId);
            if (!$cols) json_response(reference_data($entityId));
            $renamed = isset($cols['name']) && $cols['name'] !== $row['name'];
            if ($renamed) {
                $dup = $pdo->prepare("SELECT 1 FROM $table WHERE entity_id = ? AND name = ? AND id <> ?");
                $dup->execute([$entityId, $cols['name'], $id]);
                if ($dup->fetch()) json_error("\"{$cols['name']}\" already exists", 409);
            }
            $pdo->beginTransaction();
            try {
                $sets = implode(', ', array_map(fn($k) => "$k = ?", array_keys($cols)));
                $pdo->prepare("UPDATE $table SET $sets WHERE id = ? AND entity_id = ?")
                    ->execute(array_merge(array_values($cols), [$id, $entityId]));
                if ($renamed) {
                    $pdo->prepare("UPDATE employees SET $empCol = ? WHERE entity_id = ? AND $empCol = ?")
                        ->execute([$cols['name'], $entityId, $row['name']]);
                }
                $pdo->commit();
            } catch (Throwable $e) {
                $pdo->rollBack();
                throw $e;
            }
            audit((int) $user['id'], $entityId, null, "org_update_$kind", null, ['name' => $cols['name'] ?? $row['name']]);
            json_response(reference_data($entityId));
        }

        if ($method === 'DELETE') {
            $used = $pdo->prepare("SELECT COUNT(*) AS n FROM employees WHERE entity_id = ? AND $empCol = ?");
            $used->execute([$entityId, $row['name']]);
            $n = (int) $used->fetch()['n'];
            if ($n > 0) json_error("$n employee record(s) still use \"{$row['name']}\". Move them first, or mark it inactive.", 409);
            $pdo->prepare("DELETE FROM $table WHERE id = ? AND entity_id = ?")->execute([$id, $entityId]);
            audit((int) $user['id'], $entityId, null, "org_delete_$kind", null, ['name' => $row['name']]);
            json_response(reference_data($entityId));
        }
    }
}
