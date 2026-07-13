# Stellar Apex — People OS

Modern HR platform for the Stellar group of companies (Noble, Ares, and future entities).

**Phase 1: Employee Master** — directory, profiles, lifecycle states, Indian statutory
data (Aadhaar/PAN/UAN/ESI, bank + IFSC) with privacy-first masking, profile completeness
(payroll readiness), and a multi-step add-employee wizard.

See [docs/ROADMAP.md](docs/ROADMAP.md) for the full feature plan (attendance, shifts,
payroll, documents).

> **Setting up the backend?** Data is currently browser-local (`localStorage`). To make
> it shared and multi-user, follow **[docs/BACKEND.md](docs/BACKEND.md)** — a complete,
> self-contained brief (schema, API contract, entity isolation, DPDP security, Hostinger
> deploy) you can hand to a Claude Code session on the server.

## Stack

- Vite + React 19, React Router
- Tailwind CSS v4 (design tokens in `src/index.css` `@theme`)
- Framer Motion, Lucide icons
- Phase 1 persistence: localStorage (`src/store/EmployeeStore.jsx`) — production ships
  empty; a demo roster seeds in dev only. Swap for an API when the backend lands
  (see [docs/BACKEND.md](docs/BACKEND.md))

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
