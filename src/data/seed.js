/* ------------------------------------------------------------------ */
/*  Stellar Apex — seed data                                           */
/*  Employee Master reference data + demo roster                       */
/*                                                                     */
/*  Stellar is the owner of the software (branding only) — it is NOT  */
/*  an entity here. Each company is a separate portal; entities never  */
/*  see each other's data.                                             */
/* ------------------------------------------------------------------ */

export const COMPANIES = {
  noble: {
    id: 'noble',
    name: 'Noble',
    brand: 'Qugen',
    legalName: 'Noble Diagnostics Pvt. Ltd.',
    code: 'NBL',
    hue: 'noble', // maps to --color-noble tokens
    headOffice: 'Qugen (Delhi)',
    branches: [
      'Qugen (Delhi)',
      'Zirakpur',
      'Khetarpal',
      'Karnal',
      'Srinagar',
      'Samarpan',
      'Agra',
      'Rajasthan',
      'Gorakhpur',
      'Jhansi',
      'Amroha',
      'Jammu',
      'Lucknow',
      'Medsky',
      'Rohtak',
      'Dehradun',
      'Haldwani',
      'Medicare',
    ],
  },
  ares: {
    id: 'ares',
    name: 'Ares',
    brand: null,
    legalName: 'Ares Healthcare Pvt. Ltd.',
    code: 'ARS',
    hue: 'ares',
    headOffice: 'Head Office',
    // TODO: replace with Ares' real branch list when available
    branches: ['Head Office', 'Collection Centre'],
  },
}

export const DEPARTMENTS = [
  'Lab Operations',
  'Phlebotomy',
  'Pathology',
  'Radiology',
  'Front Office',
  'Customer Support',
  'Sales & Marketing',
  'Finance & Accounts',
  'Human Resources',
  'IT & Systems',
  'Logistics',
  'Admin & Facilities',
]

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
