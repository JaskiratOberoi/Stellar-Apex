<?php
// Correct the entity names and repair onboarding photo columns on databases
// created before the front/back photo change.
return function (PDO $pdo): void {
    $pdo->exec("UPDATE entities SET name = 'Noble', brand = 'Noble Diagnostics',
                legal_name = 'Qugen Pathlabs Pvt. Ltd.' WHERE id = 'noble'");
    $pdo->exec("UPDATE entities SET name = 'Ares', brand = NULL,
                legal_name = 'Ares Labs LLP' WHERE id = 'ares'");

    $cols = array_column($pdo->query('SHOW COLUMNS FROM onboarding_submissions')->fetchAll(), 'Field');
    $has = fn(string $c) => in_array($c, $cols, true);
    foreach (['aadhaar', 'pan'] as $doc) {
        if ($has("{$doc}_photo") && !$has("{$doc}_front_photo")) {
            $pdo->exec("ALTER TABLE onboarding_submissions CHANGE {$doc}_photo {$doc}_front_photo VARCHAR(255) NULL");
        } elseif (!$has("{$doc}_front_photo")) {
            $pdo->exec("ALTER TABLE onboarding_submissions ADD COLUMN {$doc}_front_photo VARCHAR(255) NULL");
        }
        if (!$has("{$doc}_back_photo")) {
            $pdo->exec("ALTER TABLE onboarding_submissions ADD COLUMN {$doc}_back_photo VARCHAR(255) NULL");
        }
    }
    if (!$has('employee_id')) {
        $pdo->exec('ALTER TABLE onboarding_submissions ADD COLUMN employee_id CHAR(26) NULL');
    }
};
