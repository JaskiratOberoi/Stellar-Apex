<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/http.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/audit.php';
require_once __DIR__ . '/org.php';

/* Monthly attendance.
   Stored marks win; an unmarked day falls back to H (holiday) or WO (weekly
   off); any other unmarked day inside the employment window is "unmarked" and
   must be filled before the month can be locked.
     paid days = P + PL + WO + H + ½·HD      LOP days = A + UL + ½·HD */

const ATT_STATUSES = ['P', 'A', 'HD', 'PL', 'UL', 'WO', 'H'];

function valid_period(?string $p): bool {
    return is_string($p) && preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $p) === 1;
}

function require_period(?string $p): string {
    if (!valid_period($p)) json_error('month must be YYYY-MM', 400);
    return $p;
}

function period_days(string $period): int {
    return (int) date('t', strtotime($period . '-01'));
}

function month_state(string $entityId, string $period): array {
    $stmt = db()->prepare('SELECT status, locked_at FROM attendance_months WHERE entity_id = ? AND period = ?');
    $stmt->execute([$entityId, $period]);
    $row = $stmt->fetch();
    return ['status' => $row['status'] ?? 'open', 'lockedAt' => $row['locked_at'] ?? null];
}

// Employees who were employed on at least one day of the month.
function period_employees(string $entityId, string $period): array {
    $first = $period . '-01';
    $last = $period . '-' . str_pad((string) period_days($period), 2, '0', STR_PAD_LEFT);
    $stmt = db()->prepare(
        'SELECT id, code, name, designation, department, branch, status, joining_date,
                COALESCE(last_working_day, exit_date) AS end_date
           FROM employees
          WHERE entity_id = ?
            AND (joining_date IS NULL OR joining_date <= ?)
            AND (COALESCE(last_working_day, exit_date) IS NULL OR COALESCE(last_working_day, exit_date) >= ?)
            AND NOT (status = \'exited\' AND COALESCE(last_working_day, exit_date) IS NULL)
          ORDER BY code'
    );
    $stmt->execute([$entityId, $last, $first]);
    return $stmt->fetchAll();
}

function period_holidays(string $entityId, string $period): array {
    $stmt = db()->prepare('SELECT id, day, name FROM holidays WHERE entity_id = ? AND day LIKE ? ORDER BY day');
    $stmt->execute([$entityId, $period . '-%']);
    return array_map(fn($r) => ['id' => (int) $r['id'], 'date' => $r['day'], 'name' => $r['name']], $stmt->fetchAll());
}

function period_marks(string $entityId, string $period): array {
    $stmt = db()->prepare('SELECT employee_id, day, status FROM attendance_days WHERE entity_id = ? AND day LIKE ?');
    $stmt->execute([$entityId, $period . '-%']);
    $out = [];
    foreach ($stmt->fetchAll() as $r) $out[$r['employee_id']][$r['day']] = $r['status'];
    return $out;
}

/**
 * Per-employee totals for a month. Pure: takes everything it needs.
 * $emp: [joining_date, end_date]; $marks: [date => status];
 * $holidays: [date => true]; $weeklyOff: [weekday ints, 0 = Sunday].
 */
function attendance_totals(string $period, array $emp, array $marks, array $holidays, array $weeklyOff): array {
    $days = period_days($period);
    $t = ['daysInMonth' => $days, 'payableDays' => 0, 'P' => 0, 'A' => 0, 'HD' => 0, 'PL' => 0,
          'UL' => 0, 'WO' => 0, 'H' => 0, 'unmarked' => 0];
    for ($d = 1; $d <= $days; $d++) {
        $date = sprintf('%s-%02d', $period, $d);
        if (!empty($emp['joining_date']) && $date < $emp['joining_date']) continue;
        if (!empty($emp['end_date']) && $date > $emp['end_date']) continue;
        $t['payableDays']++;
        $s = $marks[$date] ?? null;
        if ($s === null) {
            if (isset($holidays[$date])) $s = 'H';
            elseif (in_array((int) date('w', strtotime($date)), $weeklyOff, true)) $s = 'WO';
        }
        if ($s === null) $t['unmarked']++;
        else $t[$s]++;
    }
    $t['paidDays'] = $t['P'] + $t['PL'] + $t['WO'] + $t['H'] + 0.5 * $t['HD'];
    $t['lopDays']  = $t['A'] + $t['UL'] + 0.5 * $t['HD'];
    return $t;
}

// Totals for every employee in the month, keyed by employee id.
function attendance_summary(string $entityId, string $period): array {
    $settings = entity_settings($entityId);
    $holidays = [];
    foreach (period_holidays($entityId, $period) as $h) $holidays[$h['date']] = true;
    $marks = period_marks($entityId, $period);
    $out = [];
    foreach (period_employees($entityId, $period) as $e) {
        $out[$e['id']] = attendance_totals($period, $e, $marks[$e['id']] ?? [], $holidays, $settings['weeklyOff']);
    }
    return $out;
}

function payroll_finalised(string $entityId, string $period): bool {
    if (!table_exists('payroll_runs')) return false;
    $stmt = db()->prepare("SELECT 1 FROM payroll_runs WHERE entity_id = ? AND period = ? AND status <> 'draft'");
    $stmt->execute([$entityId, $period]);
    return (bool) $stmt->fetch();
}

function attendance_payload(string $entityId, string $period): array {
    $state = month_state($entityId, $period);
    return [
        'month'      => $period,
        'status'     => $state['status'],
        'lockedAt'   => $state['lockedAt'],
        'payrollFinalised' => payroll_finalised($entityId, $period),
        'weeklyOff'  => entity_settings($entityId)['weeklyOff'],
        'holidays'   => period_holidays($entityId, $period),
        'employees'  => array_map(fn($e) => [
            'id' => $e['id'], 'code' => $e['code'], 'name' => $e['name'],
            'designation' => $e['designation'], 'department' => $e['department'], 'branch' => $e['branch'],
            'joiningDate' => $e['joining_date'], 'endDate' => $e['end_date'],
        ], period_employees($entityId, $period)),
        'marks'      => (object) period_marks($entityId, $period),
        'totals'     => (object) attendance_summary($entityId, $period),
    ];
}

function route_attendance(string $method, string $path, array $segments): void {
    $root = $segments[0] ?? '';
    if ($root !== 'attendance' && $root !== 'holidays') return;
    $user = require_auth();
    require_tables('attendance_days', 'holidays', 'attendance_months', 'entity_settings');
    $entityId = resolve_entity($user);
    $pdo = db();
    $canWrite = fn() => require_role($user, 'super_admin', 'entity_admin', 'entity_hr');

    if ($path === '/attendance' && $method === 'GET') {
        json_response(attendance_payload($entityId, require_period($_GET['month'] ?? null)));
    }

    // Batch upsert. cells: [{ employeeId, date, status | null }]; null clears.
    if ($path === '/attendance' && $method === 'PUT') {
        $canWrite();
        $b = json_body();
        $period = require_period($b['month'] ?? null);
        if (month_state($entityId, $period)['status'] === 'locked') json_error('This month is locked. Unlock it to make changes.', 409);
        $cells = $b['cells'] ?? [];
        if (!is_array($cells) || count($cells) > 20000) json_error('cells must be a list (20,000 at most)', 422);

        $allowed = [];
        foreach (period_employees($entityId, $period) as $e) $allowed[$e['id']] = $e;
        $days = period_days($period);
        $upserts = [];
        $deletes = [];
        $skipped = 0;
        foreach ($cells as $c) {
            $eid = $c['employeeId'] ?? '';
            $date = $c['date'] ?? '';
            $status = $c['status'] ?? null;
            $emp = $allowed[$eid] ?? null;
            $ok = $emp
                && is_string($date) && str_starts_with($date, $period . '-')
                && preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) && (int) substr($date, 8) >= 1 && (int) substr($date, 8) <= $days
                && ($status === null || in_array($status, ATT_STATUSES, true))
                && (empty($emp['joining_date']) || $date >= $emp['joining_date'])
                && (empty($emp['end_date']) || $date <= $emp['end_date']);
            if (!$ok) { $skipped++; continue; }
            if ($status === null) $deletes[] = [$eid, $date];
            else $upserts[] = [$eid, $date, $entityId, $status, (int) $user['id']];
        }

        $pdo->beginTransaction();
        try {
            foreach (array_chunk($upserts, 500) as $chunk) {
                $ph = implode(', ', array_fill(0, count($chunk), '(?, ?, ?, ?, ?)'));
                $pdo->prepare("INSERT INTO attendance_days (employee_id, day, entity_id, status, updated_by) VALUES $ph
                               ON DUPLICATE KEY UPDATE status = VALUES(status), updated_by = VALUES(updated_by)")
                    ->execute(array_merge(...$chunk));
            }
            $del = $pdo->prepare('DELETE FROM attendance_days WHERE employee_id = ? AND day = ? AND entity_id = ?');
            foreach ($deletes as [$eid, $date]) $del->execute([$eid, $date, $entityId]);
            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
        audit((int) $user['id'], $entityId, null, ($b['source'] ?? '') === 'import' ? 'attendance_import' : 'attendance_mark', $period,
            ['saved' => count($upserts), 'cleared' => count($deletes), 'skipped' => $skipped]);
        json_response(['saved' => count($upserts), 'cleared' => count($deletes), 'skipped' => $skipped,
                       'totals' => (object) attendance_summary($entityId, $period)]);
    }

    if ($path === '/attendance/lock' && $method === 'POST') {
        $canWrite();
        $period = require_period(json_body()['month'] ?? null);
        $unmarked = array_sum(array_column(attendance_summary($entityId, $period), 'unmarked'));
        if ($unmarked > 0) json_error("$unmarked working day(s) are still unmarked. Fill them before locking.", 409);
        $pdo->prepare("INSERT INTO attendance_months (entity_id, period, status, locked_by, locked_at) VALUES (?, ?, 'locked', ?, NOW())
                       ON DUPLICATE KEY UPDATE status = 'locked', locked_by = VALUES(locked_by), locked_at = NOW()")
            ->execute([$entityId, $period, (int) $user['id']]);
        audit((int) $user['id'], $entityId, null, 'attendance_lock', $period);
        json_response(attendance_payload($entityId, $period));
    }

    if ($path === '/attendance/unlock' && $method === 'POST') {
        require_role($user, 'super_admin', 'entity_admin');
        $period = require_period(json_body()['month'] ?? null);
        if (payroll_finalised($entityId, $period)) json_error('Payroll for this month is finalised. Reopen the payroll run first.', 409);
        $pdo->prepare("UPDATE attendance_months SET status = 'open', locked_by = NULL, locked_at = NULL WHERE entity_id = ? AND period = ?")
            ->execute([$entityId, $period]);
        audit((int) $user['id'], $entityId, null, 'attendance_unlock', $period);
        json_response(attendance_payload($entityId, $period));
    }

    if ($path === '/holidays' && $method === 'GET') {
        $year = preg_match('/^\d{4}$/', $_GET['year'] ?? '') ? $_GET['year'] : date('Y');
        $stmt = $pdo->prepare('SELECT id, day, name FROM holidays WHERE entity_id = ? AND day LIKE ? ORDER BY day');
        $stmt->execute([$entityId, $year . '-%']);
        json_response(array_map(fn($r) => ['id' => (int) $r['id'], 'date' => $r['day'], 'name' => $r['name']], $stmt->fetchAll()));
    }

    if ($path === '/holidays' && $method === 'POST') {
        $canWrite();
        $b = json_body();
        $date = $b['date'] ?? '';
        $name = trim((string) ($b['name'] ?? ''));
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || !strtotime($date)) json_error('date must be YYYY-MM-DD', 422);
        if ($name === '' || mb_strlen($name) > 96) json_error('Holiday name is required', 422);
        if (month_state($entityId, substr($date, 0, 7))['status'] === 'locked') json_error('That month is locked.', 409);
        $pdo->prepare('INSERT INTO holidays (entity_id, day, name) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name)')
            ->execute([$entityId, $date, $name]);
        audit((int) $user['id'], $entityId, null, 'holiday_add', $date, ['name' => $name]);
        json_response(['ok' => true], 201);
    }

    if (count($segments) === 2 && $root === 'holidays' && $method === 'DELETE') {
        $canWrite();
        $stmt = $pdo->prepare('SELECT day FROM holidays WHERE id = ? AND entity_id = ?');
        $stmt->execute([(int) $segments[1], $entityId]);
        $row = $stmt->fetch();
        if (!$row) json_error('Not found', 404);
        if (month_state($entityId, substr($row['day'], 0, 7))['status'] === 'locked') json_error('That month is locked.', 409);
        $pdo->prepare('DELETE FROM holidays WHERE id = ? AND entity_id = ?')->execute([(int) $segments[1], $entityId]);
        audit((int) $user['id'], $entityId, null, 'holiday_remove', $row['day']);
        json_response(['ok' => true]);
    }
}
