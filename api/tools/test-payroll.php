<?php
// Checks calc_line() and attendance_totals() against fixed cases.
//   php api/tools/test-payroll.php      (exit code 1 on any failure)
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/../src/payroll.php';

$fail = 0;
function check(string $label, $actual, $expected): void {
    global $fail;
    $ok = is_float($expected) || is_float($actual) ? abs($actual - $expected) < 0.005 : $actual === $expected;
    if (!$ok) $fail++;
    echo ($ok ? '  ok   ' : '  FAIL ') . $label . ($ok ? '' : "  got " . json_encode($actual) . ", want " . json_encode($expected)) . "\n";
}

$pay = ['pfRate' => 12, 'pfWageCeiling' => 15000, 'esiEmployeeRate' => 0.75, 'esiEmployerRate' => 3.25, 'esiWageCeiling' => 21000];
$low = ['basic' => 10000, 'hra' => 5000, 'conveyance' => 1600, 'specialAllowance' => 1400, 'otherAllowance' => 0,
        'expenseComponent' => 3000, 'pfApplicable' => true, 'esiApplicable' => true, 'ptApplicable' => true, 'tdsMonthly' => 0];
$high = ['basic' => 40000, 'hra' => 20000, 'conveyance' => 1600, 'specialAllowance' => 18400, 'otherAllowance' => 0,
         'expenseComponent' => 0, 'pfApplicable' => true, 'esiApplicable' => true, 'ptApplicable' => true, 'tdsMonthly' => 5000];
$slabs = [['upTo' => 15000, 'amount' => 0], ['upTo' => null, 'amount' => 200]];

echo "Full month, ESI-eligible\n";
$r = calc_line($low, ['daysInMonth' => 30, 'paidDays' => 30], $pay, [], $slabs);
check('gross', $r['gross'], 18000.0);
check('pf employee 12% of basic', $r['pfEmployee'], 1200.0);
check('esi employee 0.75% rounded up', $r['esiEmployee'], 135.0);
check('esi employer 3.25%', $r['esiEmployer'], 585.0);
check('pt from slab', $r['pt'], 200.0);
check('expense reimbursement', $r['expenseReimbursement'], 3000.0);
check('net pay', $r['netPay'], 18000.0 - 1200 - 135 - 200 + 3000);

echo "Loss of pay: 27 of 30 days paid\n";
$r = calc_line($low, ['daysInMonth' => 30, 'paidDays' => 27], $pay, [], $slabs);
check('basic prorated', $r['basic'], 9000.0);
check('gross prorated', $r['gross'], 16200.0);
check('pf on earned basic', $r['pfEmployee'], 1080.0);
check('esi on earned gross', $r['esiEmployee'], 122.0); // 121.5 rounds up
check('expense prorated', $r['expenseReimbursement'], 2700.0);

echo "High earner: PF ceiling, outside ESI, structure TDS\n";
$r = calc_line($high, ['daysInMonth' => 31, 'paidDays' => 31], $pay, []);
check('pf wages capped', $r['pfWages'], 15000.0);
check('pf employee', $r['pfEmployee'], 1800.0);
check('no esi above ceiling', $r['esiEmployee'], 0.0);
check('pt zero without slabs', $r['pt'], 0.0);
check('tds from structure', $r['tds'], 5000.0);
check('net pay', $r['netPay'], 80000.0 - 1800 - 5000);

echo "Adjustments and overrides\n";
$r = calc_line($high, ['daysInMonth' => 31, 'paidDays' => 31], $pay,
    ['arrears' => 2000, 'incentive' => 1000, 'advance' => 10000, 'tds' => 6000, 'overrides' => ['pfEmployee' => 0]]);
check('gross with arrears + incentive', $r['gross'], 83000.0);
check('pf override', $r['pfEmployee'], 0.0);
check('employer pf follows override', $r['pfEmployer'], 0.0);
check('tds adjustment wins', $r['tds'], 6000.0);
check('net pay', $r['netPay'], 83000.0 - 6000 - 10000);

echo "PF / ESI / PT switched off\n";
$r = calc_line(array_merge($low, ['pfApplicable' => false, 'esiApplicable' => false, 'ptApplicable' => false]),
    ['daysInMonth' => 30, 'paidDays' => 30], $pay, [], $slabs);
check('no deductions', $r['totalDeductions'], 0.0);

echo "Zero paid days\n";
$r = calc_line($low, ['daysInMonth' => 30, 'paidDays' => 0], $pay, [], $slabs);
check('net pay zero', $r['netPay'], 0.0);

echo "Attendance totals: mid-month joiner, Sunday off, one holiday\n";
// November 2026: 30 days, Sundays on 1, 8, 15, 22, 29. Joined on the 16th.
$marks = ['2026-11-16' => 'P', '2026-11-17' => 'P', '2026-11-18' => 'A', '2026-11-19' => 'HD', '2026-11-20' => 'PL',
          '2026-11-21' => 'UL', '2026-11-23' => 'P', '2026-11-25' => 'P', '2026-11-26' => 'P', '2026-11-27' => 'P',
          '2026-11-28' => 'P', '2026-11-30' => 'P'];
$t = attendance_totals('2026-11', ['joining_date' => '2026-11-16', 'end_date' => null], $marks, ['2026-11-24' => true], [0]);
check('payable days from joining', $t['payableDays'], 15);
check('week offs defaulted', $t['WO'], 2);
check('holiday defaulted', $t['H'], 1);
check('nothing unmarked', $t['unmarked'], 0);
check('paid days', $t['paidDays'], 8 + 1 + 2 + 1 + 0.5);
check('lop days', $t['lopDays'], 1 + 1 + 0.5);

echo "Attendance totals: unmarked working days are counted\n";
$t = attendance_totals('2026-11', ['joining_date' => null, 'end_date' => '2026-11-10'], [], [], [0]);
check('payable until last working day', $t['payableDays'], 10);
check('unmarked', $t['unmarked'], 8);

echo $fail ? "\n$fail check(s) FAILED\n" : "\nAll checks passed\n";
exit($fail ? 1 : 0);
