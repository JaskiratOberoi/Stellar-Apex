<?php
// Seeds exactly ONE sample employee under Noble, for a clean production start
// (so the app isn't empty on first login). Idempotent: does nothing if any
// employee already exists. Deliberately carries NO real-looking statutory/bank
// data — HR replaces or deletes this record and adds real people via the UI.
require_once __DIR__ . '/../src/employees.php';
require_once __DIR__ . '/../src/db.php';

$total = (int) db()->query('SELECT COUNT(*) AS n FROM employees')->fetch()['n'];
if ($total > 0) {
    echo "[seed] employees already present ($total), skipping sample\n";
    return;
}

$stmt = db()->prepare('SELECT code FROM entities WHERE id = ?');
$stmt->execute(['noble']);
$prefix = $stmt->fetch()['code'];

$sample = [
    'name'           => 'Sample Employee',
    'designation'    => 'HR Executive',
    'department'     => 'Human Resources',
    'branch'         => 'Qugen (Delhi)',
    'email'          => 'sample@noblediagnostics.in',
    'mobile'         => '+91 90000 00000',
    'gender'         => 'Female',
    'maritalStatus'  => 'Single',
    'employmentType' => 'Full-time',
    'workMode'       => 'On-site',
    'status'         => 'active',
    'joiningDate'    => '2026-01-01',
    'confirmationDate' => '2026-07-01',
    // No aadhaar / pan / bank — this is a placeholder, not real PII.
];

$created = create_employee('noble', $prefix, $sample);
echo "[seed] created sample {$created['code']} {$created['name']} (noble)\n";
