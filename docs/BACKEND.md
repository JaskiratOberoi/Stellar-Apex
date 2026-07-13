# Stellar Apex — Backend Brief

**Read this first, then build.** This document is a self-contained brief for setting
up the Stellar Apex backend. It is written so a Claude Code session running on the
server can implement it without access to the original design conversation.

> **What exists today:** a finished React SPA (the "People OS" — Phase 1 Employee
> Master). It currently stores all data in the browser's `localStorage`, so data is
> **per-browser and not shared**. Your job is to replace that with a real, shared,
> server-side backend + database, with proper multi-entity isolation and auth.

---

## 1. Context — what the app is

Stellar Apex is a multi-company HR platform for the **Stellar group**. "Stellar" is
the software owner (branding only) — it is **not** a data entity. There are two real
**entities**, each of which must be a fully isolated tenant:

| Entity | Brand | Legal name | Code prefix | Head office |
|---|---|---|---|---|
| `noble` | Qugen | Noble Diagnostics Pvt. Ltd. | `NBL` | Qugen (Delhi) |
| `ares` | — | Ares Healthcare Pvt. Ltd. | `ARS` | Head Office |

**The single most important rule: a Noble user must never be able to read or write
Ares data, and vice-versa.** The frontend has a "portal picker" today, but that is
**cosmetic, not security** — the real isolation must be enforced on the server, from
the authenticated user's entity, on every query.

Frontend stack (already built): Vite + React 19, React Router, Tailwind v4. Deployed
as static files to Hostinger at `apexhr.stellarinfomatica.com` (see `docs/ROADMAP.md`).

---

## 2. Recommended stack (decide based on the server)

**Step 0 — detect the environment before choosing.** Run on the server:

```sh
php -v            # PHP available? (Hostinger shared hosting → almost always yes)
node -v           # Node available and can you run a long-lived process? (usually only on VPS)
mysql --version   # MySQL/MariaDB client
```

- **Hostinger shared hosting (most likely):** you cannot run a persistent Node
  daemon. Use **PHP 8.x + MySQL/MariaDB**, served under the same domain at `/api`.
  This is the recommended path — same-origin (no CORS), no build step, no daemon.
- **VPS / can run Node:** **Node 20 + Express + MySQL (or Postgres)** is fine too;
  reverse-proxy `/api` to it. The schema and API contract below are stack-agnostic.

The rest of this doc assumes **PHP + MySQL under `/api` on the same subdomain**, and
notes deltas where a Node/VPS setup differs.

---

## 3. Data model

The frontend's canonical employee object (camelCase, nested) is the contract your API
must produce and accept. This is the shape the SPA already renders:

```jsonc
{
  "id": "e_01hf...",                // server-generated (ULID/UUID)
  "code": "NBL-0001",               // server-generated per entity, see §5
  "company": "noble",               // entity id — set by server from auth, NOT trusted from client
  "name": "Full Name",
  "photo": null,                    // URL or null
  "gender": "Female",
  "dob": "1990-04-14",              // ISO date
  "bloodGroup": "O+",
  "maritalStatus": "Married",
  "email": "name@noblediagnostics.in",
  "personalEmail": "name@gmail.com",
  "mobile": "+91 98xxx xxxxx",
  "address":          { "line": "", "city": "", "state": "", "pincode": "" },
  "emergencyContact": { "name": "", "relation": "", "phone": "" },
  "designation": "Lab Technician",
  "department": "Lab Operations",
  "branch": "Qugen (Delhi)",
  "employmentType": "Full-time",    // Full-time|Part-time|Contract|Consultant|Intern
  "workMode": "On-site",
  "reportsTo": "e_01hf...",         // another employee id in the SAME entity, or null
  "status": "probation",            // probation|active|notice|exited
  "joiningDate": "2026-07-20",
  "confirmationDate": null,
  "lastWorkingDay": null,           // set when status = notice
  "exitDate": null,                 // set when status = exited
  // ---- SENSITIVE (see §6) ----
  "aadhaar": "XXXX XXXX 1234",      // masked by default; full only via reveal endpoint
  "pan":     "ABXXXXX34F",          // masked by default
  "uan": "100234567890",
  "esiNumber": "3100456789",
  "bank": {
    "accountName": "Name As Per Bank",
    "accountNumber": "••••••1234",  // masked by default
    "bankName": "HDFC Bank",
    "ifsc": "HDFC0000123"
  }
}
```

**Reference data** (entities, branches, departments, employment types, statuses,
blood groups) currently lives in the frontend at `src/data/seed.js` as static config.
You may keep it frontend-only for now, or move it server-side later. The DB schema
below includes `entities`/`branches` so the server can validate them and generate codes.

### MySQL schema (`schema.sql`)

```sql
CREATE TABLE entities (
  id          VARCHAR(16)  PRIMARY KEY,          -- 'noble','ares'
  name        VARCHAR(64)  NOT NULL,
  brand       VARCHAR(64)  NULL,
  legal_name  VARCHAR(128) NOT NULL,
  code        VARCHAR(8)   NOT NULL UNIQUE,      -- 'NBL','ARS'
  head_office VARCHAR(64)  NULL
);

CREATE TABLE branches (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  entity_id      VARCHAR(16) NOT NULL,
  name           VARCHAR(64) NOT NULL,
  is_head_office TINYINT(1)  NOT NULL DEFAULT 0,
  UNIQUE (entity_id, name),
  FOREIGN KEY (entity_id) REFERENCES entities(id)
);

-- HR/admin logins. Every account is scoped to exactly one entity (or is a
-- super_admin with entity_id NULL who may act across entities).
CREATE TABLE users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  email         VARCHAR(160) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,           -- bcrypt/argon2
  name          VARCHAR(96)  NOT NULL,
  role          ENUM('super_admin','entity_admin','entity_hr','viewer') NOT NULL,
  entity_id     VARCHAR(16)  NULL,               -- NULL only for super_admin
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (entity_id) REFERENCES entities(id)
);

CREATE TABLE employees (
  id              CHAR(26)     PRIMARY KEY,       -- ULID (or UUID)
  entity_id       VARCHAR(16)  NOT NULL,          -- tenant key — filter EVERY query by this
  code            VARCHAR(16)  NOT NULL,          -- 'NBL-0001'
  name            VARCHAR(96)  NOT NULL,
  photo_url       VARCHAR(255) NULL,
  gender          VARCHAR(24)  NULL,
  dob             DATE         NULL,
  blood_group     VARCHAR(4)   NULL,
  marital_status  VARCHAR(24)  NULL,
  email           VARCHAR(160) NULL,
  personal_email  VARCHAR(160) NULL,
  mobile          VARCHAR(24)  NULL,
  address_line    VARCHAR(255) NULL,
  address_city    VARCHAR(64)  NULL,
  address_state   VARCHAR(64)  NULL,
  address_pincode VARCHAR(12)  NULL,
  ec_name         VARCHAR(96)  NULL,
  ec_relation     VARCHAR(48)  NULL,
  ec_phone        VARCHAR(24)  NULL,
  designation     VARCHAR(96)  NULL,
  department      VARCHAR(64)  NULL,
  branch          VARCHAR(64)  NULL,
  employment_type VARCHAR(32)  NULL,
  work_mode       VARCHAR(32)  NULL,
  reports_to      CHAR(26)     NULL,
  status          ENUM('probation','active','notice','exited') NOT NULL DEFAULT 'probation',
  joining_date       DATE NULL,
  confirmation_date  DATE NULL,
  last_working_day   DATE NULL,
  exit_date          DATE NULL,
  -- SENSITIVE: store encrypted, never plaintext (see §6)
  aadhaar_enc      VARBINARY(255) NULL,
  pan_enc          VARBINARY(255) NULL,
  uan              VARCHAR(20)    NULL,
  esi_number       VARCHAR(20)    NULL,
  bank_account_name VARCHAR(96)   NULL,
  bank_account_enc  VARBINARY(255) NULL,
  bank_name         VARCHAR(64)   NULL,
  bank_ifsc         VARCHAR(16)   NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE (entity_id, code),
  INDEX  (entity_id, status),
  FOREIGN KEY (entity_id)  REFERENCES entities(id),
  FOREIGN KEY (reports_to) REFERENCES employees(id)
);

-- Per-entity code counter (atomic — see §5)
CREATE TABLE code_counters (
  entity_id VARCHAR(16) PRIMARY KEY,
  next_seq  INT NOT NULL DEFAULT 1,
  FOREIGN KEY (entity_id) REFERENCES entities(id)
);

-- Append-only audit trail (DPDP + who-changed-what). Log every write and every
-- sensitive-field reveal.
CREATE TABLE audit_log (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT         NULL,
  entity_id   VARCHAR(16)  NULL,
  employee_id CHAR(26)     NULL,
  action      VARCHAR(48)  NOT NULL,   -- 'create','update','delete','reveal_aadhaar','reveal_pan','reveal_bank','login'
  field       VARCHAR(48)  NULL,
  detail      JSON         NULL,       -- {old, new} for updates (never log full sensitive values)
  ip          VARCHAR(45)  NULL,
  created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);
```

### Seed reference data (`seed.sql`)

```sql
INSERT INTO entities (id, name, brand, legal_name, code, head_office) VALUES
  ('noble','Noble','Qugen','Noble Diagnostics Pvt. Ltd.','NBL','Qugen (Delhi)'),
  ('ares','Ares',NULL,'Ares Healthcare Pvt. Ltd.','ARS','Head Office');

INSERT INTO code_counters (entity_id, next_seq) VALUES ('noble',1),('ares',1);

-- Noble (Qugen) — 18 real branches; Qugen (Delhi) is head office
INSERT INTO branches (entity_id, name, is_head_office) VALUES
  ('noble','Qugen (Delhi)',1),
  ('noble','Zirakpur',0),('noble','Khetarpal',0),('noble','Karnal',0),
  ('noble','Srinagar',0),('noble','Samarpan',0),('noble','Agra',0),
  ('noble','Rajasthan',0),('noble','Gorakhpur',0),('noble','Jhansi',0),
  ('noble','Amroha',0),('noble','Jammu',0),('noble','Lucknow',0),
  ('noble','Medsky',0),('noble','Rohtak',0),('noble','Dehradun',0),
  ('noble','Haldwani',0),('noble','Medicare',0);

-- Ares — PLACEHOLDER branches; replace with the real list when provided
INSERT INTO branches (entity_id, name, is_head_office) VALUES
  ('ares','Head Office',1),('ares','Collection Centre',0);
```

Departments (validate against this list; same for both entities):
`Lab Operations, Phlebotomy, Pathology, Radiology, Front Office, Customer Support,
Sales & Marketing, Finance & Accounts, Human Resources, IT & Systems, Logistics,
Admin & Facilities`.

---

## 4. API contract

Base path: `/api`. All responses JSON. All employee endpoints require auth and are
**implicitly scoped to the caller's entity** — the server derives `entity_id` from the
token and injects it into every query. Never accept `entity`/`company` from the client
for scoping.

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/auth/login` | `{email,password}` → `{token, user:{name,role,entity}}` |
| `POST` | `/api/auth/logout` | invalidate token/session |
| `GET`  | `/api/me` | current user + entity |
| `GET`  | `/api/employees` | list employees in caller's entity (supports `?status=&branch=&department=&q=`) |
| `GET`  | `/api/employees/:id` | one employee (404 if not in caller's entity — indistinguishable from missing) |
| `POST` | `/api/employees` | create; server assigns `id`, `code`, `entity_id` |
| `PUT`  | `/api/employees/:id` | update |
| `DELETE` | `/api/employees/:id` | soft-delete → set `status='exited'` (hard delete restricted to admin) |
| `POST` | `/api/employees/:id/reveal` | `{field:'aadhaar'|'pan'|'bank'}` → full value, **audited**, role-gated |
| `GET`  | `/api/reference` | entities/branches/departments (optional; can stay frontend-only) |

**Rules**
- `GET /api/employees/:id` for an employee in another entity must return **404**, not
  403 — do not confirm existence across the tenant boundary.
- List/get responses return **masked** `aadhaar`/`pan`/`bank.accountNumber` (see §6).
- On create/update, validate `branch` ∈ that entity's branches and `department` ∈ the
  department list; reject otherwise.
- `reportsTo` must reference an employee in the **same** entity.

Auth: JWT (signed with a server secret) or PHP session cookie. If SPA and API are
**same-origin** (recommended), a `HttpOnly; Secure; SameSite=Strict` session cookie is
simplest and safest. If cross-origin (separate subdomain), use a bearer token +
locked-down CORS (allow only the app origin).

---

## 5. Employee code generation

Codes are `PREFIX-####` per entity (`NBL-0001`, `ARS-0001`), zero-padded to 4, and must
be **unique and gapless-ish under concurrency**. Do it atomically:

```sql
START TRANSACTION;
  SELECT next_seq FROM code_counters WHERE entity_id = ? FOR UPDATE;
  -- code = PREFIX + '-' + LPAD(next_seq, 4, '0')
  UPDATE code_counters SET next_seq = next_seq + 1 WHERE entity_id = ?;
  INSERT INTO employees (...) VALUES (...);
COMMIT;
```

Do **not** compute the next code with `MAX(code)+1` on the client — that's what the
current frontend `nextCode()` does as a stopgap, and it races. The server owns codes.

---

## 6. Security & compliance (India DPDP) — non-negotiable

1. **Entity isolation is server-enforced.** Every employee query filters by the
   authenticated user's `entity_id`. Write a single helper both list and get go
   through; never build a query without the entity clause. Add a test that a Noble
   token gets 404 for an Ares employee id.
2. **Encrypt sensitive fields at rest**: `aadhaar`, `pan`, bank account number. Use
   AES-256-GCM with a key stored in server config **outside the web root and outside
   git** (e.g. an env var or a file `chmod 600`). Columns are `VARBINARY` (`*_enc`).
3. **Mask by default.** List/detail responses return `XXXX XXXX 1234` / `ABXXXXX34F` /
   `••••••1234`. The full value is returned **only** by `POST /api/employees/:id/reveal`,
   which is role-gated (e.g. `entity_hr`/`entity_admin`) and writes an `audit_log` row
   (`reveal_aadhaar`, etc.) with user + timestamp + IP.
4. **Passwords**: `password_hash()` (bcrypt) / argon2. Never store or log plaintext.
5. **Audit every write** (create/update/delete) with `{old,new}` diffs — but never put
   full sensitive values in `audit_log.detail`.
6. **HTTPS only.** Reject plain HTTP. Set secure cookie flags.
7. **Config secrets** (DB creds, JWT secret, encryption key) live in a non-committed
   config file / env. Provide a `config.example.php` (or `.env.example`) in the repo
   with placeholder keys; never commit the real one.

---

## 7. Frontend integration

The SPA already has a clean seam — a single store module. **Change one file plus add a
login step; the rest of the app is untouched** because every screen uses the store's
API, not localStorage directly.

- **`src/store/EmployeeStore.jsx`** — today `load()` reads localStorage and the reducer
  mutates an in-memory array. Replace with `fetch('/api/...')` calls, keeping the same
  returned surface so callers don't change:
  `{ employees, byId, reportsOf, addEmployee, updateEmployee }`.
  - Load: `GET /api/employees` on mount (scoped by the logged-in entity).
  - `addEmployee`: `POST /api/employees` → the server returns the created record
    **with its `code`** (drop the client-side `nextCode()` — the wizard should show
    "code assigned on save" or fetch a preview from the server).
  - `updateEmployee`: `PUT /api/employees/:id`.
- **`src/store/EntityContext.jsx`** — today the entity is a client-side portal choice.
  With auth, the entity comes from the **logged-in user**. Replace the portal picker
  with (or gate it behind) a real **login screen**; after login, `entity` is fixed by
  the server and the picker is only relevant for `super_admin`.
- **Auth transport**: prefer same-origin session cookie (send `credentials:'include'`);
  or store a bearer token and add an `Authorization` header in a small `fetch` wrapper.
- **Masking**: the `MaskedValue` component currently holds the full value and toggles
  locally. With the backend, list/detail only carry masked strings; wire the reveal
  toggle to call `POST /api/employees/:id/reveal` (which is audited) and show the
  returned value transiently.

Keep the frontend on `main`; rebuild and update the `hostinger-deploy` branch as usual
(see `docs/ROADMAP.md`) once the API base URL is wired.

---

## 8. Deployment on Hostinger

Same-origin layout (recommended):

```
public_html/apexhr/          ← static SPA (the hostinger-deploy branch)
  index.html, assets/, brand/, favicon.svg, .htaccess
public_html/apexhr/api/      ← PHP backend (this backend)
  index.php (front controller), src/, config.php (NOT in git), ...
```

1. **Database**: hPanel → MySQL Databases → create DB + user, grant privileges. Note the
   host (often `localhost`), DB name, user, password. Run `schema.sql` then `seed.sql`
   via phpMyAdmin or CLI.
2. **API files**: deploy the PHP app to `public_html/apexhr/api/`. Keep `config.php`
   (secrets) out of git; create it on the server from `config.example.php`.
3. **Routing**: the SPA `.htaccess` (in `public/.htaccess`) rewrites all non-file
   requests to `index.html`. **Exclude `/api` so PHP handles it.** Add near the top of
   the rewrite block:
   ```apache
   RewriteRule ^api/ - [L]
   ```
   (or give `api/` its own `.htaccess` front-controller and ensure the parent rule has
   the `-f/-d` conditions, which it does). Add this to `public/.htaccess` on `main` so
   every future build includes it.
4. **CORS**: none needed if API is under the same subdomain. If you put the API on a
   separate subdomain (e.g. `api.apexhr.stellarinfomatica.com`), allow **only** the app
   origin and send credentials.
5. **HTTPS**: ensure the subdomain has SSL (hPanel → SSL) and force it.

Node/VPS delta: run the API as a service (pm2/systemd) on an internal port and
reverse-proxy `location /api { proxy_pass ... }`; everything else in this doc is identical.

---

## 9. Build order (suggested tasks for the server session)

1. **Confirm environment** (§2 Step 0) and pick the stack.
2. **Database**: create DB, run `schema.sql` + `seed.sql`, verify entities/branches.
3. **Config + secrets**: `config.example.php` in git; real `config.php` on server with
   DB creds, JWT/session secret, AES encryption key (outside web root / `chmod 600`).
4. **Auth**: login/logout/me, hashed passwords, session-or-token, role + entity on the
   principal. Seed one `entity_admin` per entity to start.
5. **Employees CRUD** with the entity guard baked into a shared query helper; code
   generation via `code_counters` (§5); validation of branch/department/reportsTo.
6. **Sensitive fields**: AES-GCM encrypt on write; mask on read; `/reveal` endpoint with
   role gate + `audit_log`.
7. **Audit** on all writes.
8. **Isolation test**: assert a Noble token gets 404 for an Ares employee, and lists
   never leak across entities. This is the acceptance test that matters most.
9. **Wire the frontend** (§7): swap `EmployeeStore.jsx` to the API, add login, update
   `.htaccess` to exclude `/api`, rebuild, redeploy `hostinger-deploy`.
10. **Migrate any real data** already entered (currently only in browsers' localStorage;
    export via the console `localStorage.getItem('stellar-apex:employees:v2')` if needed).

---

## 10. Acceptance checklist

- [ ] Two entities isolated: a Noble login cannot read/write/enumerate any Ares record (404s).
- [ ] Employee codes are server-generated, unique per entity, race-safe.
- [ ] Aadhaar/PAN/bank encrypted at rest; masked in list/detail; full value only via
      audited, role-gated reveal.
- [ ] Passwords hashed; HTTPS enforced; secrets not in git.
- [ ] Every create/update/delete/reveal writes an `audit_log` row.
- [ ] Frontend reads/writes the API (no more localStorage), entity comes from auth.
- [ ] Data is shared across browsers/devices (the whole point).

---

*Frontend contract lives in `src/data/seed.js` (reference data) and
`src/store/EmployeeStore.jsx` (the store seam you'll rewire). Deploy flow is in
`docs/ROADMAP.md`.*
