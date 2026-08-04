# Stellar Apex — People OS

Modern HR platform for the Stellar group of companies (Noble, Ares, and future entities).

**Phase 1: Employee Master** — directory, profiles, lifecycle states, Indian statutory
data (Aadhaar/PAN/UAN/ESI, bank + IFSC) with privacy-first masking, profile completeness
(payroll readiness), and a multi-step add-employee wizard.

See [docs/ROADMAP.md](docs/ROADMAP.md) for the full feature plan (attendance, shifts,
payroll, documents).

> **Backend:** implemented as a same-origin **PHP + MySQL** API under `/api`
> ([`api/`](api/README.md)) — server-enforced entity isolation, AES-256-GCM
> encryption at rest, masking + audited reveal, JWT auth, atomic code generation,
> and an audit log. Runs locally in Docker and deploys to Hostinger unchanged.
> Design brief: [docs/BACKEND.md](docs/BACKEND.md) · Deploy:
> [docs/DEPLOY-HOSTINGER.md](docs/DEPLOY-HOSTINGER.md).

## Stack

- Vite + React 19, React Router
- Tailwind CSS v4 (design tokens in `src/index.css` `@theme`)
- Framer Motion, Lucide icons
- Persistence: the PHP + MySQL API (`src/store/EmployeeStore.jsx` → `/api`); auth via
  a signed-in user whose entity scopes all data. Production ships empty; a demo roster
  seeds in local dev only.

## Develop

```sh
docker compose up -d --build   # backend: MySQL + PHP API on :8080 (see api/README.md)
npm install
npm run dev                    # http://localhost:5173 (proxies /api -> :8080)
```

Sign in with a seeded account, e.g. `hr@noblediagnostics.in` / `Apex@1234`.

## Structure

```
src/
  data/seed.js          # companies, departments, branches, demo roster, document types
  store/EmployeeStore.jsx  # context + localStorage store
  lib/utils.js          # formatting, masking, tenure, completeness scoring
  components/           # AppLayout (rail + topbar), ui.jsx primitives
  pages/                # Directory, Profile, AddEmployee
```
