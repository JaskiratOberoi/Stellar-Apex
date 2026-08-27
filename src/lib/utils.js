/* Shared helpers: formatting, masking, derived employee facts */

export const cx = (...parts) => parts.filter(Boolean).join(' ')

export const initials = (name) =>
  name
    .replace(/^Dr\.\s+/i, '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')

/* Deterministic avatar hue per person — muted, ledger-harmonised */
const AVATAR_TONES = [
  ['#e3e9e2', '#33523f'],
  ['#e6e5f0', '#3c3a6e'],
  ['#efe8d9', '#77571a'],
  ['#eee4e2', '#8a4436'],
  ['#e0eae9', '#22585c'],
  ['#ece7ef', '#5d4470'],
]
export const avatarTone = (name) => {
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 997
  return AVATAR_TONES[h % AVATAR_TONES.length]
}

export const fmtDate = (iso) => {
  if (!iso) return '—'
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export const tenure = (joiningDate, until) => {
  if (!joiningDate) return '—'
  const start = new Date(joiningDate)
  const end = until ? new Date(until) : new Date()
  let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())
  if (months < 1) return '< 1 mo'
  const y = Math.floor(months / 12)
  const m = months % 12
  return [y ? `${y} yr${y > 1 ? 's' : ''}` : null, m ? `${m} mo${m > 1 ? 's' : ''}` : null]
    .filter(Boolean)
    .join(' ')
}

export const age = (dob) => {
  if (!dob) return null
  const d = new Date(dob)
  const now = new Date()
  let a = now.getFullYear() - d.getFullYear()
  if (now < new Date(now.getFullYear(), d.getMonth(), d.getDate())) a--
  return a
}

/* ---- Privacy-first masking (DPDP-style, greytHR pattern) ---- */
export const maskAadhaar = (v) => (v ? `XXXX XXXX ${v.slice(-4)}` : '—')
export const maskPan = (v) => (v ? `${v.slice(0, 2)}XXXXX${v.slice(-3)}` : '—')
export const maskAccount = (v) => (v ? `••••••${v.slice(-4)}` : '—')
export const groupAadhaar = (v) => (v ? v.replace(/(\d{4})(?=\d)/g, '$1 ') : '—')

/* ---- Profile completeness (payroll-readiness meter) ---- */
const COMPLETENESS_CHECKS = [
  ['Photo', (e) => !!e.photo, false],
  ['Mobile', (e) => !!e.mobile],
  ['Work email', (e) => !!e.email],
  ['Date of birth', (e) => !!e.dob],
  ['Blood group', (e) => !!e.bloodGroup],
  ['Address', (e) => !!e.address?.line],
  ['Emergency contact', (e) => !!e.emergencyContact?.phone],
  ['Aadhaar', (e) => !!e.aadhaar],
  ['PAN', (e) => !!e.pan],
  ['UAN (PF)', (e) => !!e.uan || e.employmentType === 'Consultant' || e.employmentType === 'Intern'],
  ['Bank account', (e) => !!e.bank?.accountNumber],
  ['IFSC', (e) => !!e.bank?.ifsc],
  ['Reporting manager', (e) => !!e.reportsTo || e.designation === 'Group CEO'],
]

export const completeness = (e) => {
  const missing = []
  let done = 0
  let total = 0
  for (const [label, check, counts = true] of COMPLETENESS_CHECKS) {
    if (!counts && check(e)) continue
    total++
    if (check(e)) done++
    else missing.push(label)
  }
  return { pct: Math.round((done / total) * 100), missing }
}
