/* ------------------------------------------------------------------ */
/*  Stellar Apex — static portal identity and fixed option lists.      */
/*  Branches, departments and designations come from the API           */
/*  (GET /reference), not from this file.                              */
/*                                                                     */
/*  Stellar is the owner of the software (branding only) — it is NOT  */
/*  an entity here. Each company is a separate portal; entities never  */
/*  see each other's data.                                             */
/* ------------------------------------------------------------------ */

export const COMPANIES = {
  noble: {
    id: 'noble',
    name: 'Noble',
    brand: 'Noble Diagnostics',
    legalName: 'Qugen Pathlabs Pvt. Ltd.',
    code: 'NBL',
    hue: 'noble', // maps to --color-noble tokens
  },
  ares: {
    id: 'ares',
    name: 'Ares',
    brand: null,
    legalName: 'Ares Labs LLP',
    code: 'ARS',
    hue: 'ares',
  },
}

export const EMPLOYMENT_TYPES = [
  'Full-time',
  'Part-time',
  'Contract',
  'Consultant',
  'Intern',
]

/**
 * Lifecycle states for an employee.
 * probation → active (confirmed) → notice → exited
 */
export const STATUSES = {
  active: { id: 'active', label: 'Active', tone: 'mint' },
  probation: { id: 'probation', label: 'Probation', tone: 'amber' },
  notice: { id: 'notice', label: 'Notice Period', tone: 'rose' },
  exited: { id: 'exited', label: 'Exited', tone: 'slate' },
}

export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']

/* Documents checklist per employee — Phase 1 placeholder */
export const DOCUMENT_TYPES = [
  { id: 'appointment', label: 'Appointment Letter', category: 'Employment' },
  { id: 'offer', label: 'Offer Letter', category: 'Employment' },
  { id: 'pan', label: 'PAN Card', category: 'Identity' },
  { id: 'aadhaar', label: 'Aadhaar Card', category: 'Identity' },
  { id: 'photo', label: 'Passport Photo', category: 'Identity' },
  { id: 'edu', label: 'Educational Certificates', category: 'Qualifications' },
  { id: 'reg', label: 'Registration Certificates', category: 'Qualifications' },
  { id: 'experience', label: 'Experience Letters', category: 'Employment' },
  { id: 'bank', label: 'Cancelled Cheque / Passbook', category: 'Banking' },
]
