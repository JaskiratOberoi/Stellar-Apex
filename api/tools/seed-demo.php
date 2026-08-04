<?php
// DEV ONLY — seed a small demo roster (encrypted) so the local app isn't empty.
// Idempotent: skips an entity that already has employees. Prod ships EMPTY and
// must never run this. Invoked by the Docker dev entrypoint.
require_once __DIR__ . '/../src/employees.php';
require_once __DIR__ . '/../src/db.php';

$DEMO = [
    'noble' => [
        [
            'name' => 'Dr. Aruna Nair', 'designation' => 'Medical Director', 'department' => 'Pathology',
            'branch' => 'Qugen (Delhi)', 'email' => 'aruna.nair@noblediagnostics.in', 'mobile' => '+91 98120 33445',
            'gender' => 'Female', 'dob' => '1975-11-02', 'bloodGroup' => 'A+', 'maritalStatus' => 'Married',
            'employmentType' => 'Full-time', 'workMode' => 'On-site', 'status' => 'active',
            'joiningDate' => '2015-02-16', 'confirmationDate' => '2015-08-16',
            'aadhaar' => '745689123456', 'pan' => 'CMRPN3456H', 'uan' => '100456789012',
            'bank' => ['accountName' => 'Aruna Nair', 'accountNumber' => '50100456789123', 'bankName' => 'SBI', 'ifsc' => 'SBIN0000789'],
        ],
        [
            'name' => 'Harpreet Singh Gill', 'designation' => 'Lab Operations Manager', 'department' => 'Lab Operations',
            'branch' => 'Qugen (Delhi)', 'email' => 'harpreet.gill@noblediagnostics.in', 'mobile' => '+91 98130 44556',
            'gender' => 'Male', 'dob' => '1988-01-26', 'bloodGroup' => 'B+', 'maritalStatus' => 'Married',
            'employmentType' => 'Full-time', 'workMode' => 'On-site', 'status' => 'active',
            'joiningDate' => '2019-06-03', 'confirmationDate' => '2019-12-03',
            'aadhaar' => '523489761234', 'pan' => 'BXGPS7654K', 'uan' => '100567890123',
            'bank' => ['accountName' => 'Harpreet Singh Gill', 'accountNumber' => '3910200456123', 'bankName' => 'HDFC Bank', 'ifsc' => 'HDFC0000391'],
        ],
        [
            'name' => 'Meera Krishnan', 'designation' => 'Lab Technician', 'department' => 'Lab Operations',
            'branch' => 'Zirakpur', 'email' => 'meera.k@noblediagnostics.in', 'mobile' => '+91 98140 55667',
            'gender' => 'Female', 'dob' => '1996-07-19', 'bloodGroup' => 'O+', 'maritalStatus' => 'Single',
            'employmentType' => 'Full-time', 'workMode' => 'On-site', 'status' => 'probation',
            'joiningDate' => '2026-06-20',
            'aadhaar' => '881234567890', 'pan' => 'FKLPM1234N', 'esiNumber' => '3100456789',
            'bank' => ['accountName' => 'Meera Krishnan', 'accountNumber' => '7712004561', 'bankName' => 'ICICI Bank', 'ifsc' => 'ICIC0000771'],
        ],
    ],
    'ares' => [
        [
            'name' => 'Rohan Mehta', 'designation' => 'Branch Head', 'department' => 'Front Office',
            'branch' => 'Head Office', 'email' => 'rohan.mehta@areshealthcare.in', 'mobile' => '+91 99200 11223',
            'gender' => 'Male', 'dob' => '1985-03-11', 'bloodGroup' => 'B-', 'maritalStatus' => 'Married',
            'employmentType' => 'Full-time', 'workMode' => 'On-site', 'status' => 'active',
            'joiningDate' => '2020-01-15', 'confirmationDate' => '2020-07-15',
            'aadhaar' => '661234987650', 'pan' => 'AQRPM9087L', 'uan' => '100987654321',
            'bank' => ['accountName' => 'Rohan Mehta', 'accountNumber' => '9911004567', 'bankName' => 'Axis Bank', 'ifsc' => 'UTIB0000991'],
        ],
        [
            'name' => 'Sana Qureshi', 'designation' => 'Phlebotomist', 'department' => 'Phlebotomy',
            'branch' => 'Collection Centre', 'email' => 'sana.q@areshealthcare.in', 'mobile' => '+91 99210 22334',
            'gender' => 'Female', 'dob' => '1998-12-05', 'bloodGroup' => 'AB+', 'maritalStatus' => 'Single',
            'employmentType' => 'Full-time', 'workMode' => 'On-site', 'status' => 'active',
            'joiningDate' => '2023-09-01', 'confirmationDate' => '2024-03-01',
            'aadhaar' => '774512389066', 'pan' => 'DLKPS5643M', 'esiNumber' => '3100998877',
            'bank' => ['accountName' => 'Sana Qureshi', 'accountNumber' => '8811004599', 'bankName' => 'Kotak', 'ifsc' => 'KKBK0000881'],
        ],
    ],
];

foreach ($DEMO as $entityId => $roster) {
    $stmt = db()->prepare('SELECT COUNT(*) AS n FROM employees WHERE entity_id = ?');
    $stmt->execute([$entityId]);
    if ((int) $stmt->fetch()['n'] > 0) { echo "[seed] $entityId already has employees, skipping\n"; continue; }
    $stmt = db()->prepare('SELECT code FROM entities WHERE id = ?');
    $stmt->execute([$entityId]);
    $prefix = $stmt->fetch()['code'];
    foreach ($roster as $emp) {
        $created = create_employee($entityId, $prefix, $emp);
        echo "[seed] $entityId: created {$created['code']} {$created['name']}\n";
    }
}
echo "[seed] demo roster done\n";
