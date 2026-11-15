<?php
// Emailed onboarding invites and the email addresses collected by the form.
//   onboarding_invites: one row per emailed link, so the form can pre-fill
//     the address it was sent to without putting it in the URL.
//   onboarding_submissions: personal and official email, and the invite used.
// Additive only; safe to run more than once.
return function (PDO $pdo): void {
    $pdo->exec('CREATE TABLE IF NOT EXISTS onboarding_invites (
        id            CHAR(32)     PRIMARY KEY,          -- random token carried in the link
        entity_id     VARCHAR(16)  NOT NULL,
        email         VARCHAR(160) NOT NULL,
        name          VARCHAR(96)  NULL,
        created_by    INT          NULL,
        created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
        submission_id CHAR(26)     NULL,                 -- set when the form is submitted
        submitted_at  TIMESTAMP    NULL,
        INDEX (entity_id, created_at)
    )');

    $cols = array_column($pdo->query('SHOW COLUMNS FROM onboarding_submissions')->fetchAll(), 'Field');
    $add = function (string $col, string $def) use ($pdo, $cols): void {
        if (!in_array($col, $cols, true)) $pdo->exec("ALTER TABLE onboarding_submissions ADD COLUMN $col $def");
    };
    $add('personal_email', 'VARCHAR(160) NULL');
    $add('official_email', 'VARCHAR(160) NULL');
    $add('invite_id', 'CHAR(32) NULL');
};
