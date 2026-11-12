<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/http.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/audit.php';
require_once __DIR__ . '/crypto.php';
require_once __DIR__ . '/mask.php';
require_once __DIR__ . '/org.php';
require_once __DIR__ . '/attendance.php';

/* Payroll: salary structures, monthly runs (the salary sheet) and disbursal.
   A run is built from locked attendance, stays editable as a draft, and is
   frozen once finalised. Statutory rates come from entity settings. */

const EARNING_KEYS = ['basic', 'hra', 'conveyance', 'specialAllowance', 'otherAllowance'];
const OVERRIDE_KEYS = ['pfEmployee', 'esiEmployee', 'pt', 'expenseReimbursement'];

/* ---------- pure calculation ---------- */

// Professional tax for a monthly gross from a state's slabs.
function pt_for(float $gross, ?array $slabs): float {
    foreach ($slabs ?? [] as $slab) {
        if ($slab['upTo'] === null || $gross <= $slab['upTo']) return (float) $slab['amount'];
    }
    return 0.0;
}

/**
 * One salary line.
 *  $s    structure (monthly amounts + applicability flags, API shape)
 *  $att  ['daysInMonth' => n, 'paidDays' => n]
 *  $pay  entity payroll settings
 *  $adj  ['arrears','incentive','advance','otherDeduction','tds' (null = structure),
 *         'overrides' => [pfEmployee, esiEmployee, pt, expenseReimbursement]]
 *  $ptSlabs  slabs for the employee's work state, or null
 */
function calc_line(array $s, array $att, array $pay, array $adj = [], ?array $ptSlabs = null): array {
    $dim = (float) $att['daysInMonth'];
    $factor = $dim > 0 ? min(1.0, max(0.0, (float) $att['paidDays'] / $dim)) : 0.0;
    $rupee = fn(float $x): float => (float) round($x);

    $out = [];
    $earned = 0.0;
    $fullGross = 0.0;
    foreach (EARNING_KEYS as $k) {
        $monthly = (float) ($s[$k] ?? 0);
        $out[$k] = $rupee($monthly * $factor);
        $earned += $out[$k];
        $fullGross += $monthly;
    }
    $out['arrears'] = $rupee((float) ($adj['arrears'] ?? 0));
    $out['incentive'] = $rupee((float) ($adj['incentive'] ?? 0));
    $out['gross'] = $earned + $out['arrears'] + $out['incentive'];

    // PF: employee and employer share, on basic up to the wage ceiling.
    $ceiling = (float) ($pay['pfWageCeiling'] ?? 0);
    $out['pfWages'] = !empty($s['pfApplicable']) ? ($ceiling > 0 ? min($out['basic'], $ceiling) : $out['basic']) : 0.0;
    $out['pfEmployee'] = $rupee($out['pfWages'] * (float) ($pay['pfRate'] ?? 0) / 100);
    $out['pfEmployer'] = $out['pfEmployee'];

    // ESI: eligibility on the full monthly gross, contribution on what was earned.
    $esiOn = !empty($s['esiApplicable']) && $fullGross > 0 && $fullGross <= (float) ($pay['esiWageCeiling'] ?? 0);
    $out['esiEmployee'] = $esiOn ? (float) ceil($out['gross'] * (float) ($pay['esiEmployeeRate'] ?? 0) / 100) : 0.0;
    $out['esiEmployer'] = $esiOn ? (float) ceil($out['gross'] * (float) ($pay['esiEmployerRate'] ?? 0) / 100) : 0.0;

    $out['pt'] = !empty($s['ptApplicable']) && $out['gross'] > 0 ? pt_for($out['gross'], $ptSlabs) : 0.0;
    $out['tds'] = $rupee((float) (($adj['tds'] ?? null) !== null ? $adj['tds'] : ($s['tdsMonthly'] ?? 0)));
    $out['advance'] = $rupee((float) ($adj['advance'] ?? 0));
    $out['otherDeduction'] = $rupee((float) ($adj['otherDeduction'] ?? 0));
    $out['expenseReimbursement'] = $rupee((float) ($s['expenseComponent'] ?? 0) * $factor);

    foreach (OVERRIDE_KEYS as $k) {
        if (isset($adj['overrides'][$k]) && is_numeric($adj['overrides'][$k])) {
            $out[$k] = $rupee((float) $adj['overrides'][$k]);
            if ($k === 'pfEmployee') $out['pfEmployer'] = $out[$k];
        }
    }

    $out['totalDeductions'] = $out['pfEmployee'] + $out['esiEmployee'] + $out['pt'] + $out['tds']
                            + $out['advance'] + $out['otherDeduction'];
    $out['netPay'] = $out['gross'] - $out['totalDeductions'] + $out['expenseReimbursement'];
    return $out;
}

/* ---------- salary structures ---------- */

function structure_to_api(array $r): array {
    $s = [
        'id'               => (int) $r['id'],
        'employeeId'       => $r['employee_id'],
        'effectiveFrom'    => $r['effective_from'],
        'basic'            => (float) $r['basic'],
        'hra'              => (float) $r['hra'],
        'conveyance'       => (float) $r['conveyance'],
        'specialAllowance' => (float) $r['special_allowance'],
        'otherAllowance'   => (float) $r['other_allowance'],
        'expenseComponent' => (float) $r['expense_component'],
        'pfApplicable'     => (bool) $r['pf_applicable'],
        'esiApplicable'    => (bool) $r['esi_applicable'],
        'ptApplicable'     => (bool) $r['pt_applicable'],
        'tdsMonthly'       => (float) $r['tds_monthly'],
        'note'             => $r['note'],
        'createdAt'        => $r['created_at'],
    ];
    $s['gross'] = $s['basic'] + $s['hra'] + $s['conveyance'] + $s['specialAllowance'] + $s['otherAllowance'];
    return $s;
}

// Structure in force for each employee on $asOf (YYYY-MM-DD), keyed by employee id.
function structures_as_of(string $entityId, string $asOf): array {
    $stmt = db()->prepare(
        'SELECT s.* FROM salary_structures s
           JOIN (SELECT employee_id, MAX(effective_from) AS ef FROM salary_structures
                  WHERE entity_id = ? AND effective_from <= ? GROUP BY employee_id) latest
             ON latest.employee_id = s.employee_id AND latest.ef = s.effective_from
          WHERE s.entity_id = ?'
    );
    $stmt->execute([$entityId, $asOf, $entityId]);
    $out = [];
    foreach ($stmt->fetchAll() as $r) $out[$r['employee_id']] = structure_to_api($r);
    return $out;
}

function employee_structures(string $entityId, string $employeeId): array {
    $stmt = db()->prepare('SELECT * FROM salary_structures WHERE entity_id = ? AND employee_id = ? ORDER BY effective_from DESC');
    $stmt->execute([$entityId, $employeeId]);
    return array_map('structure_to_api', $stmt->fetchAll());
}

/* ---------- runs ---------- */

function find_run(string $entityId, string $period): ?array {
    $stmt = db()->prepare('SELECT * FROM payroll_runs WHERE entity_id = ? AND period = ?');
    $stmt->execute([$entityId, $period]);
    return $stmt->fetch() ?: null;
}

function line_to_api(array $r): array {
    $paid = $r['payout_status'] === 'paid';
    $account = decrypt_value($paid ? $r['paid_account_enc'] : ($r['bank_account_enc'] ?? null));
    return [
        'id' => (int) $r['id'], 'employeeId' => $r['employee_id'],
        'code' => $r['emp_code'], 'name' => $r['emp_name'],
        'designation' => $r['designation'], 'department' => $r['department'], 'branch' => $r['branch'],
        'structure' => json_decode($r['structure'], true),
        'adjustments' => json_decode($r['adjustments'] ?? 'null', true) ?: new stdClass(),
        'daysInMonth' => (float) $r['days_in_month'], 'payableDays' => (float) $r['payable_days'],
        'paidDays' => (float) $r['paid_days'], 'lopDays' => (float) $r['lop_days'],
        'basic' => (float) $r['basic'], 'hra' => (float) $r['hra'], 'conveyance' => (float) $r['conveyance'],
        'specialAllowance' => (float) $r['special_allowance'], 'otherAllowance' => (float) $r['other_allowance'],
        'arrears' => (float) $r['arrears'], 'incentive' => (float) $r['incentive'], 'gross' => (float) $r['gross'],
        'pfWages' => (float) $r['pf_wages'], 'pfEmployee' => (float) $r['pf_employee'],
        'esiEmployee' => (float) $r['esi_employee'], 'pt' => (float) $r['pt'], 'tds' => (float) $r['tds'],
        'advance' => (float) $r['advance'], 'otherDeduction' => (float) $r['other_deduction'],
        'totalDeductions' => (float) $r['total_deductions'],
        'expenseReimbursement' => (float) $r['expense_reimbursement'], 'netPay' => (float) $r['net_pay'],
        'pfEmployer' => (float) $r['pf_employer'], 'esiEmployer' => (float) $r['esi_employer'],
        'remarks' => $r['remarks'],
        'payMode' => $r['pay_mode'], 'payoutStatus' => $r['payout_status'], 'holdReason' => $r['hold_reason'],
        'paidOn' => $r['paid_on'], 'paymentRef' => $r['payment_ref'], 'batchId' => $r['batch_id'] !== null ? (int) $r['batch_id'] : null,
        'bank' => [
            'accountName' => $paid ? $r['paid_account_name'] : ($r['bank_account_name'] ?? null),
            'bankName'    => $paid ? $r['paid_bank_name'] : ($r['bank_name'] ?? null),
            'ifsc'        => $paid ? $r['paid_ifsc'] : ($r['bank_ifsc'] ?? null),
            'accountNumber' => mask_account($account),
            'complete'    => (bool) $account && (bool) ($paid ? $r['paid_ifsc'] : ($r['bank_ifsc'] ?? null)),
        ],
    ];
}

function run_lines(int $runId, ?array $onlyIds = null): array {
    $sql = 'SELECT l.*, e.bank_account_name, e.bank_name, e.bank_ifsc, e.bank_account_enc
              FROM payroll_lines l JOIN employees e ON e.id = l.employee_id WHERE l.run_id = ?';
    $params = [$runId];
    if ($onlyIds !== null) {
        if (!$onlyIds) return [];
        $sql .= ' AND l.id IN (' . implode(', ', array_fill(0, count($onlyIds), '?')) . ')';
        $params = array_merge($params, $onlyIds);
    }
    $stmt = db()->prepare($sql . ' ORDER BY l.emp_code');
    $stmt->execute($params);
    return $stmt->fetchAll();
}

function run_payload(string $entityId, array $run): array {
    $lines = array_map('line_to_api', run_lines((int) $run['id']));
    $batches = db()->prepare('SELECT * FROM disbursal_batches WHERE run_id = ? ORDER BY id');
    $batches->execute([(int) $run['id']]);
    $out = [
        'id' => (int) $run['id'], 'period' => $run['period'], 'status' => $run['status'],
        'createdAt' => $run['created_at'], 'finalisedAt' => $run['finalised_at'],
        'lines' => $lines,
        'batches' => array_map(fn($b) => [
            'id' => (int) $b['id'], 'paidOn' => $b['paid_on'], 'reference' => $b['reference'], 'note' => $b['note'],
            'lineCount' => (int) $b['line_count'], 'amount' => (float) $b['amount'], 'createdAt' => $b['created_at'],
        ], $batches->fetchAll()),
        'missingStructure' => [],
    ];
    if ($run['status'] === 'draft') $out['missingStructure'] = missing_structure($entityId, $run['period'], $lines);
    return $out;
}

// Employees employed in the period who have no salary structure in force.
function missing_structure(string $entityId, string $period, array $lines): array {
    $have = array_flip(array_column($lines, 'employeeId'));
    $out = [];
    foreach (period_employees($entityId, $period) as $e) {
        if (!isset($have[$e['id']])) $out[] = ['id' => $e['id'], 'code' => $e['code'], 'name' => $e['name']];
    }
    return $out;
}

function branch_states(string $entityId): array {
    $stmt = db()->prepare('SELECT name, state FROM branches WHERE entity_id = ?');
    $stmt->execute([$entityId]);
    $out = [];
    foreach ($stmt->fetchAll() as $r) $out[$r['name']] = $r['state'];
    return $out;
}

// DB column => calc_line key, for writing a computed line.
const LINE_COLUMNS = [
    'basic' => 'basic', 'hra' => 'hra', 'conveyance' => 'conveyance',
    'special_allowance' => 'specialAllowance', 'other_allowance' => 'otherAllowance',
    'arrears' => 'arrears', 'incentive' => 'incentive', 'gross' => 'gross',
    'pf_wages' => 'pfWages', 'pf_employee' => 'pfEmployee', 'esi_employee' => 'esiEmployee',
    'pt' => 'pt', 'tds' => 'tds', 'advance' => 'advance', 'other_deduction' => 'otherDeduction',
    'total_deductions' => 'totalDeductions', 'expense_reimbursement' => 'expenseReimbursement',
    'net_pay' => 'netPay', 'pf_employer' => 'pfEmployer', 'esi_employer' => 'esiEmployer',
];

// (Re)build every line of a draft run from attendance + structures, keeping
// each line's adjustments. Adds new joiners, drops people no longer in scope.
function compute_run(string $entityId, array $run): void {
    $pdo = db();
    $period = $run['period'];
    $runId = (int) $run['id'];
    $lastDay = sprintf('%s-%02d', $period, period_days($period));
    $pay = entity_settings($entityId)['payroll'];
    $structures = structures_as_of($entityId, $lastDay);
    $totals = attendance_summary($entityId, $period);
    $states = branch_states($entityId);

    $existing = [];
    $stmt = $pdo->prepare('SELECT id, employee_id, adjustments, remarks FROM payroll_lines WHERE run_id = ?');
    $stmt->execute([$runId]);
    foreach ($stmt->fetchAll() as $r) $existing[$r['employee_id']] = $r;

    $keep = [];
    foreach (period_employees($entityId, $period) as $e) {
        $s = $structures[$e['id']] ?? null;
        $att = $totals[$e['id']] ?? null;
        if (!$s || !$att) continue;
        $keep[$e['id']] = true;
        $adj = isset($existing[$e['id']]) ? (json_decode($existing[$e['id']]['adjustments'] ?? 'null', true) ?: []) : [];
        $state = $states[$e['branch'] ?? ''] ?? null;
        $calc = calc_line($s, $att, $pay, $adj, $state ? ($pay['ptSlabs'][$state] ?? null) : null);

        $cols = [
            'run_id' => $runId, 'entity_id' => $entityId, 'employee_id' => $e['id'],
            'emp_code' => $e['code'], 'emp_name' => $e['name'], 'designation' => $e['designation'],
            'department' => $e['department'], 'branch' => $e['branch'],
            'structure' => json_encode($s), 'adjustments' => $adj ? json_encode($adj) : null,
            'days_in_month' => $att['daysInMonth'], 'payable_days' => $att['payableDays'],
            'paid_days' => $att['paidDays'], 'lop_days' => $att['lopDays'],
        ];
        foreach (LINE_COLUMNS as $col => $key) $cols[$col] = $calc[$key];
        $names = array_keys($cols);
        $update = implode(', ', array_map(fn($c) => "$c = VALUES($c)", array_diff($names, ['run_id', 'employee_id'])));
        $pdo->prepare('INSERT INTO payroll_lines (' . implode(', ', $names) . ') VALUES (' . implode(', ', array_fill(0, count($names), '?')) . ")
                       ON DUPLICATE KEY UPDATE $update")->execute(array_values($cols));
    }
    foreach ($existing as $eid => $r) {
        if (!isset($keep[$eid])) $pdo->prepare('DELETE FROM payroll_lines WHERE id = ?')->execute([(int) $r['id']]);
    }
}

function clean_adjustments(array $b): array {
    $adj = [];
    foreach (['arrears', 'incentive', 'advance', 'otherDeduction'] as $k) {
        if (isset($b[$k]) && is_numeric($b[$k]) && (float) $b[$k] > 0) $adj[$k] = (float) $b[$k];
    }
    if (isset($b['tds']) && is_numeric($b['tds']) && (float) $b['tds'] >= 0) $adj['tds'] = (float) $b['tds'];
    $ov = [];
    foreach (OVERRIDE_KEYS as $k) {
        if (isset($b['overrides'][$k]) && is_numeric($b['overrides'][$k]) && (float) $b['overrides'][$k] >= 0) {
            $ov[$k] = (float) $b['overrides'][$k];
        }
    }
    if ($ov) $adj['overrides'] = $ov;
    return $adj;
}

/* ---------- routing ---------- */

function route_payroll(string $method, string $path, array $segments): void {
    $root = $segments[0] ?? '';
    $isSalary = $root === 'employees' && ($segments[2] ?? '') === 'salary';
    if ($root !== 'payroll' && $root !== 'salary-structures' && !$isSalary) return;

    $user = require_auth();
    require_role($user, 'super_admin', 'entity_admin', 'entity_hr');
    require_tables('salary_structures', 'payroll_runs', 'payroll_lines', 'disbursal_batches', 'attendance_months', 'entity_settings');
    $entityId = resolve_entity($user);
    $uid = (int) $user['id'];
    $pdo = db();

    /* ---- salary structures ---- */
    if ($path === '/salary-structures' && $method === 'GET') {
        $asOf = preg_match('/^\d{4}-\d{2}-\d{2}$/', $_GET['asOf'] ?? '') ? $_GET['asOf'] : date('Y-m-d');
        json_response((object) structures_as_of($entityId, $asOf));
    }

    if ($isSalary) {
        $employeeId = $segments[1];
        $check = $pdo->prepare('SELECT 1 FROM employees WHERE id = ? AND entity_id = ?');
        $check->execute([$employeeId, $entityId]);
        if (!$check->fetch()) json_error('Not found', 404);

        if (count($segments) === 3 && $method === 'GET') {
            json_response(employee_structures($entityId, $employeeId));
        }
        if (count($segments) === 3 && $method === 'POST') {
            $b = json_body();
            $from = $b['effectiveFrom'] ?? '';
            if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $from) || !strtotime($from)) json_error('Effective date is required', 422);
            $amt = function (string $k) use ($b): float {
                $v = $b[$k] ?? 0;
                if ($v === '' || $v === null) return 0.0;
                if (!is_numeric($v) || (float) $v < 0 || (float) $v > 99999999) json_error("Invalid amount for $k", 422);
                return round((float) $v, 2);
            };
            $basic = $amt('basic');
            if ($basic <= 0) json_error('Basic pay must be more than zero', 422);
            $pdo->prepare(
                'INSERT INTO salary_structures
                   (entity_id, employee_id, effective_from, basic, hra, conveyance, special_allowance, other_allowance,
                    expense_component, pf_applicable, esi_applicable, pt_applicable, tds_monthly, note, created_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE basic = VALUES(basic), hra = VALUES(hra), conveyance = VALUES(conveyance),
                   special_allowance = VALUES(special_allowance), other_allowance = VALUES(other_allowance),
                   expense_component = VALUES(expense_component), pf_applicable = VALUES(pf_applicable),
                   esi_applicable = VALUES(esi_applicable), pt_applicable = VALUES(pt_applicable),
                   tds_monthly = VALUES(tds_monthly), note = VALUES(note), created_by = VALUES(created_by)'
            )->execute([
                $entityId, $employeeId, $from, $basic, $amt('hra'), $amt('conveyance'), $amt('specialAllowance'),
                $amt('otherAllowance'), $amt('expenseComponent'),
                !empty($b['pfApplicable']) ? 1 : 0, !empty($b['esiApplicable']) ? 1 : 0, !empty($b['ptApplicable']) ? 1 : 0,
                $amt('tdsMonthly'), trim((string) ($b['note'] ?? '')) ?: null, $uid,
            ]);
            audit($uid, $entityId, $employeeId, 'salary_structure_set', $from);
            json_response(employee_structures($entityId, $employeeId), 201);
        }
        if (count($segments) === 4 && $method === 'DELETE') {
            require_role($user, 'super_admin', 'entity_admin');
            $pdo->prepare('DELETE FROM salary_structures WHERE id = ? AND employee_id = ? AND entity_id = ?')
                ->execute([(int) $segments[3], $employeeId, $entityId]);
            audit($uid, $entityId, $employeeId, 'salary_structure_delete');
            json_response(employee_structures($entityId, $employeeId));
        }
        json_error('Not found', 404);
    }

    if ($root !== 'payroll' || ($segments[1] ?? '') !== 'runs') return;

    /* ---- run list ---- */
    if (count($segments) === 2 && $method === 'GET') {
        $stmt = $pdo->prepare(
            "SELECT r.period, r.status, r.finalised_at, COUNT(l.id) AS headcount,
                    COALESCE(SUM(l.gross), 0) AS gross, COALESCE(SUM(l.net_pay), 0) AS net,
                    COALESCE(SUM(l.payout_status = 'paid'), 0) AS paid,
                    COALESCE(SUM(l.payout_status = 'held'), 0) AS held
               FROM payroll_runs r LEFT JOIN payroll_lines l ON l.run_id = r.id
              WHERE r.entity_id = ? GROUP BY r.id ORDER BY r.period DESC"
        );
        $stmt->execute([$entityId]);
        json_response(array_map(fn($r) => [
            'period' => $r['period'], 'status' => $r['status'], 'finalisedAt' => $r['finalised_at'],
            'headcount' => (int) $r['headcount'], 'gross' => (float) $r['gross'], 'net' => (float) $r['net'],
            'paid' => (int) $r['paid'], 'held' => (int) $r['held'],
        ], $stmt->fetchAll()));
    }

    /* ---- create ---- */
    if (count($segments) === 2 && $method === 'POST') {
        $period = require_period(json_body()['period'] ?? null);
        if (month_state($entityId, $period)['status'] !== 'locked') json_error('Lock attendance for this month before running payroll.', 409);
        if (find_run($entityId, $period)) json_error('A payroll run already exists for this month.', 409);
        $pdo->prepare('INSERT INTO payroll_runs (entity_id, period, created_by) VALUES (?, ?, ?)')->execute([$entityId, $period, $uid]);
        $run = find_run($entityId, $period);
        compute_run($entityId, $run);
        audit($uid, $entityId, null, 'payroll_run_create', $period);
        json_response(run_payload($entityId, $run), 201);
    }

    if (count($segments) < 3) return;
    $period = require_period($segments[2]);
    $run = find_run($entityId, $period);
    // Reading a month with no run is a normal state, not an error.
    if (!$run && $method === 'GET' && !isset($segments[3])) json_response(null);
    if (!$run) json_error('No payroll run for this month', 404);
    $runId = (int) $run['id'];
    $action = $segments[3] ?? null;
    $needDraft = function () use ($run) {
        if ($run['status'] !== 'draft') json_error('This salary sheet is finalised. Reopen it to make changes.', 409);
    };

    if ($action === null && $method === 'GET') json_response(run_payload($entityId, $run));

    if ($action === null && $method === 'DELETE') {
        $needDraft();
        $pdo->prepare('DELETE FROM payroll_runs WHERE id = ?')->execute([$runId]);
        audit($uid, $entityId, null, 'payroll_run_delete', $period);
        json_response(['ok' => true]);
    }

    if ($action === 'recalculate' && $method === 'POST') {
        $needDraft();
        compute_run($entityId, $run);
        audit($uid, $entityId, null, 'payroll_recalculate', $period);
        json_response(run_payload($entityId, $run));
    }

    // PUT /payroll/runs/:period/lines/:id — adjustments, overrides, remarks.
    if ($action === 'lines' && isset($segments[4]) && $method === 'PUT') {
        $needDraft();
        $stmt = $pdo->prepare('SELECT * FROM payroll_lines WHERE id = ? AND run_id = ?');
        $stmt->execute([(int) $segments[4], $runId]);
        $line = $stmt->fetch();
        if (!$line) json_error('Not found', 404);
        $b = json_body();
        $adj = clean_adjustments($b);
        $states = branch_states($entityId);
        $pay = entity_settings($entityId)['payroll'];
        $state = $states[$line['branch'] ?? ''] ?? null;
        $calc = calc_line(
            json_decode($line['structure'], true),
            ['daysInMonth' => (float) $line['days_in_month'], 'paidDays' => (float) $line['paid_days']],
            $pay, $adj, $state ? ($pay['ptSlabs'][$state] ?? null) : null
        );
        $sets = ['adjustments = ?', 'remarks = ?'];
        $vals = [$adj ? json_encode($adj) : null, trim((string) ($b['remarks'] ?? '')) ?: null];
        foreach (LINE_COLUMNS as $col => $key) { $sets[] = "$col = ?"; $vals[] = $calc[$key]; }
        $vals[] = (int) $line['id'];
        $pdo->prepare('UPDATE payroll_lines SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($vals);
        audit($uid, $entityId, $line['employee_id'], 'payroll_line_adjust', $period, ['adjustments' => $adj]);
        json_response(line_to_api(run_lines($runId, [(int) $line['id']])[0]));
    }

    if ($action === 'finalise' && $method === 'POST') {
        $needDraft();
        $count = $pdo->prepare('SELECT COUNT(*) AS n FROM payroll_lines WHERE run_id = ?');
        $count->execute([$runId]);
        if ((int) $count->fetch()['n'] === 0) json_error('There are no salary lines to finalise.', 409);
        // Default payment mode: bank when account + IFSC are on file, else cash.
        $pdo->prepare(
            "UPDATE payroll_lines l JOIN employees e ON e.id = l.employee_id
                SET l.pay_mode = IF(e.bank_account_enc IS NOT NULL AND e.bank_ifsc IS NOT NULL AND e.bank_ifsc <> '', 'bank', 'cash')
              WHERE l.run_id = ? AND l.payout_status = 'pending'"
        )->execute([$runId]);
        $pdo->prepare("UPDATE payroll_runs SET status = 'finalised', finalised_by = ?, finalised_at = NOW() WHERE id = ?")->execute([$uid, $runId]);
        audit($uid, $entityId, null, 'payroll_finalise', $period);
        json_response(run_payload($entityId, find_run($entityId, $period)));
    }

    if ($action === 'reopen' && $method === 'POST') {
        require_role($user, 'super_admin', 'entity_admin');
        if ($run['status'] === 'draft') json_error('This run is already a draft.', 409);
        $paid = $pdo->prepare("SELECT COUNT(*) AS n FROM payroll_lines WHERE run_id = ? AND payout_status = 'paid'");
        $paid->execute([$runId]);
        if ((int) $paid->fetch()['n'] > 0) json_error('Some salaries are already marked paid. Undo those payments first.', 409);
        $pdo->prepare("UPDATE payroll_runs SET status = 'draft', finalised_by = NULL, finalised_at = NULL WHERE id = ?")->execute([$runId]);
        $pdo->prepare("UPDATE payroll_lines SET payout_status = 'pending', hold_reason = NULL WHERE run_id = ?")->execute([$runId]);
        audit($uid, $entityId, null, 'payroll_reopen', $period);
        json_response(run_payload($entityId, find_run($entityId, $period)));
    }

    /* ---- disbursal ---- */
    // Full account numbers for the bank transfer sheet. Admin only, audited.
    if ($action === 'bank-sheet' && $method === 'GET') {
        require_role($user, 'super_admin', 'entity_admin');
        if ($run['status'] === 'draft') json_error('Finalise the salary sheet first.', 409);
        $rows = [];
        foreach (run_lines($runId) as $r) {
            $paid = $r['payout_status'] === 'paid';
            $rows[] = [
                'id' => (int) $r['id'], 'code' => $r['emp_code'], 'name' => $r['emp_name'], 'branch' => $r['branch'],
                'accountName' => $paid ? $r['paid_account_name'] : $r['bank_account_name'],
                'accountNumber' => decrypt_value($paid ? $r['paid_account_enc'] : $r['bank_account_enc']),
                'bankName' => $paid ? $r['paid_bank_name'] : $r['bank_name'],
                'ifsc' => $paid ? $r['paid_ifsc'] : $r['bank_ifsc'],
                'netPay' => (float) $r['net_pay'], 'payMode' => $r['pay_mode'], 'payoutStatus' => $r['payout_status'],
                'paidOn' => $r['paid_on'], 'paymentRef' => $r['payment_ref'], 'holdReason' => $r['hold_reason'],
            ];
        }
        audit($uid, $entityId, null, 'disbursal_export', $period, ['rows' => count($rows)]);
        json_response($rows);
    }

    // POST /payroll/runs/:period/payout { action, lineIds, ... }
    if ($action === 'payout' && $method === 'POST') {
        if ($run['status'] === 'draft') json_error('Finalise the salary sheet first.', 409);
        $b = json_body();
        $ids = array_values(array_unique(array_map('intval', is_array($b['lineIds'] ?? null) ? $b['lineIds'] : [])));
        if (!$ids) json_error('Select at least one salary line.', 422);
        $lines = run_lines($runId, $ids);
        if (count($lines) !== count($ids)) json_error('Some selected lines are not part of this run.', 422);
        $in = implode(', ', array_fill(0, count($ids), '?'));
        $do = $b['action'] ?? '';
        $statuses = array_unique(array_column($lines, 'payout_status'));

        if ($do === 'hold') {
            $reason = trim((string) ($b['reason'] ?? ''));
            if ($reason === '') json_error('Give a reason for holding the salary.', 422);
            if (in_array('paid', $statuses, true)) json_error('A paid salary cannot be put on hold.', 409);
            $pdo->prepare("UPDATE payroll_lines SET payout_status = 'held', hold_reason = ? WHERE run_id = ? AND id IN ($in)")
                ->execute(array_merge([$reason, $runId], $ids));
        } elseif ($do === 'release') {
            $pdo->prepare("UPDATE payroll_lines SET payout_status = 'pending', hold_reason = NULL WHERE run_id = ? AND payout_status = 'held' AND id IN ($in)")
                ->execute(array_merge([$runId], $ids));
        } elseif ($do === 'mode') {
            $mode = $b['mode'] ?? '';
            if (!in_array($mode, ['bank', 'cash', 'cheque'], true)) json_error('Invalid payment mode', 422);
            if (in_array('paid', $statuses, true)) json_error('A paid salary cannot change payment mode.', 409);
            $pdo->prepare("UPDATE payroll_lines SET pay_mode = ? WHERE run_id = ? AND id IN ($in)")
                ->execute(array_merge([$mode, $runId], $ids));
        } elseif ($do === 'pay') {
            $paidOn = $b['paidOn'] ?? '';
            if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $paidOn) || !strtotime($paidOn)) json_error('Payment date is required', 422);
            if ($statuses !== ['pending']) json_error('Only pending salaries can be marked paid. Release held ones first.', 409);
            foreach ($lines as $l) {
                if ($l['pay_mode'] === 'bank' && (empty($l['bank_account_enc']) || empty($l['bank_ifsc']))) {
                    json_error("{$l['emp_name']} has no bank details on file. Add them or change the payment mode.", 409);
                }
            }
            $ref = trim((string) ($b['reference'] ?? '')) ?: null;
            $pdo->beginTransaction();
            try {
                $pdo->prepare('INSERT INTO disbursal_batches (run_id, entity_id, paid_on, reference, note, line_count, amount, created_by)
                               VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
                    ->execute([$runId, $entityId, $paidOn, $ref, trim((string) ($b['note'] ?? '')) ?: null,
                               count($lines), array_sum(array_map(fn($l) => (float) $l['net_pay'], $lines)), $uid]);
                $batchId = (int) $pdo->lastInsertId();
                $pdo->prepare(
                    "UPDATE payroll_lines l JOIN employees e ON e.id = l.employee_id
                        SET l.payout_status = 'paid', l.paid_on = ?, l.payment_ref = ?, l.batch_id = ?,
                            l.paid_account_name = e.bank_account_name, l.paid_bank_name = e.bank_name,
                            l.paid_ifsc = e.bank_ifsc, l.paid_account_enc = e.bank_account_enc
                      WHERE l.run_id = ? AND l.id IN ($in)"
                )->execute(array_merge([$paidOn, $ref, $batchId, $runId], $ids));
                $pdo->commit();
            } catch (Throwable $e) {
                $pdo->rollBack();
                throw $e;
            }
        } elseif ($do === 'unpay') {
            require_role($user, 'super_admin', 'entity_admin');
            $pdo->prepare(
                "UPDATE payroll_lines SET payout_status = 'pending', paid_on = NULL, payment_ref = NULL, batch_id = NULL,
                        paid_account_name = NULL, paid_bank_name = NULL, paid_ifsc = NULL, paid_account_enc = NULL
                  WHERE run_id = ? AND payout_status = 'paid' AND id IN ($in)"
            )->execute(array_merge([$runId], $ids));
            $pdo->prepare('DELETE b FROM disbursal_batches b LEFT JOIN payroll_lines l ON l.batch_id = b.id WHERE b.run_id = ? AND l.id IS NULL')
                ->execute([$runId]);
            $pdo->prepare('UPDATE disbursal_batches b SET
                             line_count = (SELECT COUNT(*) FROM payroll_lines l WHERE l.batch_id = b.id),
                             amount = (SELECT COALESCE(SUM(l.net_pay), 0) FROM payroll_lines l WHERE l.batch_id = b.id)
                           WHERE b.run_id = ?')->execute([$runId]);
        } else {
            json_error('Unknown payout action', 422);
        }

        // The run is "paid" once every line is.
        $left = $pdo->prepare("SELECT COUNT(*) AS n FROM payroll_lines WHERE run_id = ? AND payout_status <> 'paid'");
        $left->execute([$runId]);
        $pdo->prepare('UPDATE payroll_runs SET status = ? WHERE id = ?')
            ->execute([(int) $left->fetch()['n'] === 0 ? 'paid' : 'finalised', $runId]);
        audit($uid, $entityId, null, "disbursal_$do", $period, ['lines' => count($ids)]);
        json_response(run_payload($entityId, find_run($entityId, $period)));
    }
}
