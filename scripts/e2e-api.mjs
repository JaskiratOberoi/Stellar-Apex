// End-to-end API check against the DEV stack: org masters, attendance,
// payroll, disbursal, and cross-entity isolation.
//   node scripts/e2e-api.mjs [baseUrl]        (default http://localhost:8080/api)
// Uses the seeded dev accounts. Refuses to run against the prod port.
const BASE = process.argv[2] || 'http://localhost:8080/api'
if (/:8090\b/.test(BASE)) throw new Error('Refusing to run against the production stack')
const MONTH = process.argv[3] || '2031-03' // far-future month so reruns never collide with real data

let failures = 0
const check = (label, cond, extra = '') => {
  if (!cond) failures++
  console.log(`${cond ? '  ok  ' : '  FAIL'} ${label}${cond ? '' : ' ' + extra}`)
}

async function call(token, method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let data = null
  try { data = text ? JSON.parse(text) : null } catch { data = text }
  return { status: res.status, data }
}
const login = async (email) => (await call(null, 'POST', '/auth/login', { email, password: 'Apex@1234' })).data.token

const noble = await login('hr@noblediagnostics.in')
const ares = await login('hr@areshealthcare.in')
const N = (m, p, b) => call(noble, m, p, b)
const A = (m, p, b) => call(ares, m, p, b)

console.log('Reference and org masters')
let ref = (await N('GET', '/reference')).data
check('entity legal name corrected', ref.entity.legal_name === 'Qugen Pathlabs Pvt. Ltd.', ref.entity.legal_name)
check('departments seeded', ref.departments.length >= 12)
const depName = `QA Dept ${Date.now()}`
let r = await N('POST', '/org/departments', { name: depName })
check('create department', r.status === 201)
const dep = r.data.departments.find((d) => d.name === depName)
r = await N('POST', '/org/departments', { name: depName })
check('duplicate department rejected', r.status === 409)
const emps = (await N('GET', '/employees')).data
const [e1, e2] = emps
r = await N('PUT', `/org/departments/${dep.id}`, { headId: e1.id })
check('assign department head', r.data.departments.find((d) => d.id === dep.id).headId === e1.id)
r = await A('PUT', `/org/departments/${dep.id}`, { name: 'hijack' })
check('other entity cannot edit department', r.status === 404)
r = await N('PUT', `/employees/${e2.id}`, { department: depName })
check('employee moved to new department', r.status === 200 && r.data.department === depName, JSON.stringify(r.data))
r = await N('PUT', `/org/departments/${dep.id}`, { name: depName + ' R' })
check('rename cascades to employees', (await N('GET', `/employees/${e2.id}`)).data.department === depName + ' R')
r = await N('DELETE', `/org/departments/${dep.id}`)
check('in-use department cannot be deleted', r.status === 409)
await N('PUT', `/employees/${e2.id}`, { department: 'Lab Operations' })
r = await N('DELETE', `/org/departments/${dep.id}`)
check('unused department deleted', r.status === 200)

console.log('Reporting loop')
await N('PUT', `/employees/${e2.id}`, { reportsTo: e1.id })
r = await N('PUT', `/employees/${e1.id}`, { reportsTo: e2.id })
check('reporting loop rejected', r.status === 422, JSON.stringify(r.data))

console.log('Settings')
r = await N('PUT', '/settings', { weeklyOff: [0], payroll: { ptSlabs: { Delhi: [{ upTo: 15000, amount: 0 }, { upTo: null, amount: 200 }] } } })
check('settings saved', r.status === 200 && r.data.payroll.ptSlabs.Delhi.length === 2)

console.log(`Attendance ${MONTH}`)
// start clean so the script can be re-run
await N('POST', `/payroll/runs/${MONTH}/payout`, { action: 'unpay', lineIds: ((await N('GET', `/payroll/runs/${MONTH}`)).data?.lines || []).map((l) => l.id) })
await N('POST', `/payroll/runs/${MONTH}/reopen`)
await N('DELETE', `/payroll/runs/${MONTH}`)
await N('POST', '/attendance/unlock', { month: MONTH })
let att = (await N('GET', `/attendance?month=${MONTH}`)).data
check('roster returned', att.employees.length >= 3)
const dim = new Date(+MONTH.slice(0, 4), +MONTH.slice(5), 0).getDate()
const cells = []
for (const e of att.employees) {
  for (let d = 1; d <= dim; d++) {
    const date = `${MONTH}-${String(d).padStart(2, '0')}`
    if (new Date(date + 'T00:00:00').getDay() === 0) continue
    // e1: 2 absences, e2: one half day, others full
    let status = 'P'
    if (e.id === e1.id && (d === 3 || d === 4)) status = 'A'
    if (e.id === e2.id && d === 5) status = 'HD'
    cells.push({ employeeId: e.id, date, status })
  }
}
const holdOut = cells.pop() // leave one day unmarked
await N('PUT', '/attendance', { month: MONTH, cells: [{ ...holdOut, status: null }] }) // clear it if a previous run filled it
r = await N('PUT', '/attendance', { month: MONTH, cells })
check('marks saved', r.status === 200 && r.data.saved === cells.length, JSON.stringify(r.data).slice(0, 200))
r = await N('POST', '/attendance/lock', { month: MONTH })
check('lock blocked while a day is unmarked', r.status === 409)
r = await N('PUT', '/attendance', { month: MONTH, cells: [holdOut, { employeeId: 'nope', date: `${MONTH}-01`, status: 'P' }, { employeeId: e1.id, date: '1999-01-01', status: 'P' }] })
check('bad cells skipped, good one saved', r.data.saved === 1 && r.data.skipped === 2, JSON.stringify(r.data).slice(0, 120))
att = (await N('GET', `/attendance?month=${MONTH}`)).data
check('LOP for two absences', att.totals[e1.id].lopDays === 2, JSON.stringify(att.totals[e1.id]))
check('half day counts as 0.5 LOP', att.totals[e2.id].lopDays === 0.5)
check('other entity sees none of these employees', !(await A('GET', `/attendance?month=${MONTH}`)).data.employees.some((x) => x.id === e1.id))
r = await A('PUT', '/attendance', { month: MONTH, cells: [{ employeeId: e1.id, date: `${MONTH}-02`, status: 'A' }] })
check('other entity cannot mark these employees', r.data.saved === 0 && r.data.skipped === 1)
r = await N('POST', '/payroll/runs', { period: MONTH })
check('payroll blocked until attendance is locked', r.status === 409)
r = await N('POST', '/attendance/lock', { month: MONTH })
check('month locked', r.status === 200 && r.data.status === 'locked', JSON.stringify(r.data).slice(0, 120))
r = await N('PUT', '/attendance', { month: MONTH, cells: [holdOut] })
check('locked month rejects edits', r.status === 409)

console.log('Salary structures')
const from = '2020-01-01'
r = await N('POST', `/employees/${e1.id}/salary`, { effectiveFrom: from, basic: 40000, hra: 20000, conveyance: 1600, specialAllowance: 18400, pfApplicable: true, esiApplicable: true, ptApplicable: true, tdsMonthly: 5000 })
check('structure saved', r.status === 201 && r.data[0].gross === 80000, JSON.stringify(r.data).slice(0, 160))
await N('POST', `/employees/${e2.id}/salary`, { effectiveFrom: from, basic: 10000, hra: 5000, conveyance: 1600, specialAllowance: 1400, expenseComponent: 3000, pfApplicable: true, esiApplicable: true, ptApplicable: true })
r = await A('GET', `/employees/${e1.id}/salary`)
check('other entity cannot read salary', r.status === 404)
r = await A('POST', `/employees/${e1.id}/salary`, { effectiveFrom: from, basic: 1 })
check('other entity cannot write salary', r.status === 404)

console.log('Payroll run')
r = await N('POST', '/payroll/runs', { period: MONTH })
check('run created', r.status === 201, JSON.stringify(r.data).slice(0, 200))
let run = r.data
const l1 = run.lines.find((l) => l.employeeId === e1.id)
const l2 = run.lines.find((l) => l.employeeId === e2.id)
{
  // Everyone on the register is either paid or listed as missing a salary, never both.
  const paid = new Set(run.lines.map((l) => l.employeeId))
  const missing = new Set(run.missingStructure.map((m) => m.id))
  check('everyone is either on the sheet or listed as missing a salary', att.employees.every((e) => paid.has(e.id) !== missing.has(e.id)))
}
check('LOP reduces gross', l1.gross === Math.round(40000 * (dim - 2) / dim) + Math.round(20000 * (dim - 2) / dim) + Math.round(1600 * (dim - 2) / dim) + Math.round(18400 * (dim - 2) / dim), String(l1.gross))
check('PF capped at ceiling', l1.pfEmployee === 1800)
check('no ESI for high earner', l1.esiEmployee === 0)
check('PT from Delhi slab', l1.pt === 200)
check('ESI for low earner', l2.esiEmployee === Math.ceil(l2.gross * 0.0075), String(l2.esiEmployee))
check('net = gross - deductions + expenses', l2.netPay === l2.gross - l2.totalDeductions + l2.expenseReimbursement)
r = await N('PUT', `/payroll/runs/${MONTH}/lines/${l2.id}`, { incentive: 1500, advance: 500, remarks: 'Diwali incentive' })
check('adjustment recalculates line', r.status === 200 && r.data.gross === l2.gross + 1500 && r.data.advance === 500, JSON.stringify(r.data).slice(0, 200))
r = await N('POST', `/payroll/runs/${MONTH}/recalculate`)
check('recalculate keeps adjustments', r.data.lines.find((l) => l.id === l2.id).incentive === 1500)
check('other entity has no such run', (await A('GET', `/payroll/runs/${MONTH}`)).data === null)
r = await N('POST', `/payroll/runs/${MONTH}/payout`, { action: 'pay', lineIds: [l1.id], paidOn: `${MONTH}-28` })
check('cannot pay a draft', r.status === 409)
r = await N('POST', `/payroll/runs/${MONTH}/finalise`)
check('finalised', r.data.status === 'finalised')
r = await N('PUT', `/payroll/runs/${MONTH}/lines/${l2.id}`, { incentive: 1 })
check('finalised sheet rejects edits', r.status === 409)
r = await N('POST', '/attendance/unlock', { month: MONTH })
check('attendance cannot unlock after finalise', r.status === 409)

console.log('Disbursal')
r = await N('POST', `/payroll/runs/${MONTH}/payout`, { action: 'hold', lineIds: [l2.id], reason: 'Documents pending' })
check('salary held', r.data.lines.find((l) => l.id === l2.id).payoutStatus === 'held')
r = await N('POST', `/payroll/runs/${MONTH}/payout`, { action: 'pay', lineIds: [l1.id, l2.id], paidOn: `${MONTH}-28` })
check('held salary cannot be paid', r.status === 409)
r = await N('POST', `/payroll/runs/${MONTH}/payout`, { action: 'pay', lineIds: [l1.id], paidOn: `${MONTH}-28`, reference: 'UTR123' })
check('paid with reference', r.data.lines.find((l) => l.id === l1.id).paymentRef === 'UTR123' && r.data.status === 'finalised' && r.data.batches.length === 1)
r = await N('GET', `/payroll/runs/${MONTH}/bank-sheet`)
check('bank sheet has full account numbers', r.status === 200 && /^\d{9,18}$/.test(r.data.find((x) => x.id === l1.id).accountNumber))
check('run payload only carries masked accounts', run.lines.every((l) => !/^\d{6,}$/.test(l.bank.accountNumber || '')))
r = await A('POST', `/payroll/runs/${MONTH}/payout`, { action: 'pay', lineIds: [l2.id], paidOn: `${MONTH}-28` })
check('other entity cannot touch payout', r.status === 404)
r = await N('POST', `/payroll/runs/${MONTH}/payout`, { action: 'release', lineIds: [l2.id] })
const rest = r.data.lines.filter((l) => l.payoutStatus === 'pending').map((l) => l.id) // l2 plus anyone else on the dev roster
r = await N('POST', `/payroll/runs/${MONTH}/payout`, { action: 'pay', lineIds: rest, paidOn: `${MONTH}-30`, reference: 'UTR456' })
check('released salary paid in a second batch; run closes', r.data.status === 'paid' && r.data.batches.length === 2, r.data.status)
r = await N('POST', `/payroll/runs/${MONTH}/reopen`)
check('paid run cannot be reopened', r.status === 409)
const runs = (await N('GET', '/payroll/runs')).data
check('run appears in history', runs.some((x) => x.period === MONTH && x.status === 'paid'))

console.log('Onboarding isolation')
check('noble queue visible to noble', (await N('GET', '/onboarding')).status === 200)
check('ares queue never lists noble submissions', (await A('GET', '/onboarding')).data.every((s) => s.entity === 'ares'))

console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll checks passed')
process.exit(failures ? 1 : 0)
