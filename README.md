# Stellar Apex — People OS

HR portal for two entities, each a separate portal whose data never mixes:

| Portal | Legal entity | Code |
|---|---|---|
| Noble Diagnostics | Qugen Pathlabs Pvt. Ltd. | `NBL` |
| Ares | Ares Labs LLP | `ARS` |

## What it does

- **People**: directory, profiles, add/edit, lifecycle states, Indian statutory data
  (Aadhaar/PAN/UAN/ESI, bank + IFSC) encrypted at rest, masked, with audited reveal.
- **Organisation**: reporting tree, plus department, branch and designation masters
  (heads, managers, branch type and state).
- **Attendance**: monthly register. Mark by click, drag or keyboard, import from
  Excel/CSV, holidays and weekly off, month lock.
- **Payroll**: per-employee salary structures (effective-dated), a monthly salary sheet
  calculated from locked attendance (LOP, PF, ESI, professional tax, TDS, adjustments,
  overrides), finalise, payslips, Excel export.
- **Disbursal**: bank transfer sheet, payment mode, hold/release, mark paid in batches
  with date and bank reference.
- **Onboarding**: public field form (`/onboard`) with Aadhaar/PAN photos; HR turns a
  submission into an employee record with its salary, or rejects it.

The monthly loop is: **lock attendance → draft salary sheet → finalise → pay out**.

## Stack

- Vite + React 19, React Router, Tailwind CSS v4 (tokens in `src/index.css`)
- Framer Motion (shared motion vocabulary in `src/lib/motion.js`), Phosphor icons
- ExcelJS, loaded on demand, for imports and exports
- Backend: plain PHP 8.2 + MySQL 8 under `/api` ([`api/README.md`](api/README.md)):
  server-enforced entity isolation, AES-256-GCM encryption at rest, JWT auth, audit log

## Develop

```sh
docker compose -p stellar-apex-dev up -d --build   # dev MySQL + PHP API on :8080
npm install
npm run dev                                        # http://localhost:5173, proxies /api to :8080
```

Sign in with a seeded dev account (see `api/README.md`). The dev stack seeds a small
demo roster and applies database migrations on start.

> **Two stacks share this folder.** The production API container
> (`docker-compose.prod.yml`, port 8090) mounts `api/` directly, so a saved change to
> any file under `api/` is live in production immediately. The dev stack above has its
> own database; the `-p` flag keeps the two apart. Never point `VITE_API_PROXY` at 8090.

## Database migrations

Schema changes live in `api/sql/migrations/` as numbered `.sql` or `.php` files and run
once each, tracked in `schema_migrations`:

```sh
docker exec apex_php php /var/www/html/api/tools/migrate.php        # dev
docker exec apex_php_prod php /var/www/html/api/tools/migrate.php   # production
```

On Hostinger, import the files in order through phpMyAdmin. Code that depends on a
migration answers "needs a database update" until it has been applied.

## Checks

```sh
npm run lint && npm run build
docker exec apex_php php /var/www/html/api/tools/test-payroll.php   # pay and attendance maths
node scripts/e2e-api.mjs                                            # API flow + entity isolation (dev stack only)
```

## Structure

```
src/
  data/seed.js             # portal identity and fixed option lists
  lib/                     # api client, utils, motion vocabulary, org helpers, Excel helpers
  store/                   # Auth, Entity, Reference (masters + settings), Employee stores
  components/kit.jsx       # buttons, fields, dialog, toasts, tabs, skeletons, month picker
  components/              # AppLayout, ui primitives, charts, SalaryStructure, OrgRelations
  pages/                   # Dashboard, People, Profile, AddEmployee, Organisation, Attendance,
                           # Payroll (+ payroll/Disbursal, payroll/Settings), Payslips,
                           # OnboardingQueue, Onboard (public), Documents
api/
  index.php                # router
  src/                     # auth, employees, org, attendance, payroll, onboarding, crypto, audit
  sql/                     # base schema + migrations/
  tools/                   # migrate, test-payroll, seeds (command line only)
```

## Payroll settings need an accountant's sign-off

PF and ESI rates, wage ceilings and professional-tax slabs are editable under
Payroll → Settings and ship with common defaults (PF 12% on basic up to ₹15,000; ESI
0.75% / 3.25% up to ₹21,000 gross; no professional-tax slabs). Confirm them, and how the
new wage code affects your PF base, before the first live run.
