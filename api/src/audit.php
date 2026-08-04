<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/http.php';

// Append-only audit. `detail` must never contain full sensitive values.
function audit(?int $userId, ?string $entityId, ?string $employeeId, string $action, ?string $field = null, ?array $detail = null): void {
    try {
        $stmt = db()->prepare(
            'INSERT INTO audit_log (user_id, entity_id, employee_id, action, field, detail, ip)
             VALUES (?, ?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([
            $userId, $entityId, $employeeId, $action, $field,
            $detail !== null ? json_encode($detail) : null,
            client_ip(),
        ]);
    } catch (Throwable $e) {
        error_log('[audit] failed: ' . $e->getMessage());
    }
}
