# Stellar Apex — People OS

Modern HR platform for the Stellar group of companies (Noble, Ares, and future entities).

**Phase 1: Employee Master** — directory, profiles, lifecycle states, Indian statutory
data (Aadhaar/PAN/UAN/ESI, bank + IFSC) with privacy-first masking, profile completeness
(payroll readiness), and a multi-step add-employee wizard.

See [docs/ROADMAP.md](docs/ROADMAP.md) for the full feature plan (attendance, shifts,
payroll, documents).

## Stack

- Vite + React 19, React Router
- Tailwind CSS v4 (design tokens in `src/index.css` `@theme`)
- Framer Motion, Lucide icons
- Phase 1 persistence: seeded demo data + localStorage (`src/store/EmployeeStore.jsx`) —
  swap for an API when the backend lands

## Develop

```sh
npm install
npm run dev   # http://localhost:5173
```

## Structure

```
src/
  data/seed.js          # companies, departments, branches, demo roster, document types
  store/EmployeeStore.jsx  # context + localStorage store
  lib/utils.js          # formatting, masking, tenure, completeness scoring
  components/           # AppLayout (rail + topbar), ui.jsx primitives
  pages/                # Directory, Profile, AddEmployee
```
