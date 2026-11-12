<?php
// Apply pending database migrations, once each, in filename order.
//   php api/tools/migrate.php
// Migrations live in api/sql/migrations/ as NN-name.sql (statements separated
// by ";" at end of line) or NN-name.php (returns function (PDO $pdo): void).
// Applied names are recorded in schema_migrations. CLI only.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }

require_once __DIR__ . '/../src/db.php';

$pdo = db();
$pdo->exec('CREATE TABLE IF NOT EXISTS schema_migrations (
    name       VARCHAR(128) PRIMARY KEY,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)');
$applied = array_column($pdo->query('SELECT name FROM schema_migrations')->fetchAll(), 'name');

$files = glob(__DIR__ . '/../sql/migrations/*.{sql,php}', GLOB_BRACE) ?: [];
sort($files);
$ran = 0;
foreach ($files as $file) {
    $name = basename($file);
    if (in_array($name, $applied, true)) continue;
    echo "[migrate] applying $name\n";
    if (str_ends_with($name, '.php')) {
        $fn = require $file;
        $fn($pdo);
    } else {
        $sql = preg_replace('/^\s*--.*$/m', '', file_get_contents($file));
        foreach (preg_split('/;\s*(\r?\n|$)/', $sql) as $stmt) {
            if (trim($stmt) !== '') $pdo->exec($stmt);
        }
    }
    $pdo->prepare('INSERT INTO schema_migrations (name) VALUES (?)')->execute([$name]);
    $ran++;
}
echo $ran ? "[migrate] $ran migration(s) applied\n" : "[migrate] up to date\n";
