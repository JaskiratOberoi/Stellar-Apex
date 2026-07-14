# Stellar Apex — Product Roadmap

Modern HR platform for Noble and Ares (+future entities). Stellar owns the software —
it is branding only, never an entity in the data.
Informed by research on Rippling, HiBob, BambooHR, Personio (global) and Keka, greytHR,
Zoho People, Darwinbox (Indian platforms — payroll/compliance patterns).

## Architecture: entity portals

Each company is an isolated portal — Noble and Ares can never see each other's data.
Portal choice lives in `EntityContext`; every page scopes queries to the active entity,
and a foreign-entity record renders as "not found" (indistinguishable from missing).
Once auth lands, portal access derives from the signed-in user's role instead of the picker.

Branches are per-entity (`COMPANIES[x].branches`). Noble (Qugen) has 18 branches with
**Qugen (Delhi)** as head office. **Ares' real branch list is pending** — placeholder
Head Office + Collection Centre until provided.

## Data & deployment

- **Roster data**: production starts with an empty roster (HR adds real people via
  the wizard). A demo roster (`src/data/demoRoster.js`) is dynamically imported
  and seeded only when `import.meta.env.DEV` — so no fake names / Aadhaar / PAN /
  bank numbers ship in the production bundle. Persisted to localStorage
  (`stellar-apex:employees:v2`); swap for an API when the backend lands.
- **Hosting**: `apexhr.stellarinfomatica.com` on Hostinger → `public_html/apexhr`.
  Hostinger clones a branch and serves it directly (no build step). Deploy the
  built static output on the **`hostinger-deploy`** branch (never `main`, which is
  un-built source). `.htaccess` (in `public/`) provides the SPA rewrite so React
  Router deep links survive refreshes.
- **Redeploy flow**: on `main` after changes → `npm run build` → copy `dist/` into
  the `hostinger-deploy` branch via a git worktree → force-push → Redeploy in hPanel.

## Phase 1 — Employee Master ✅ (in progress)

- [x] Employee directory: table + card views, multi-field search, filters
      (company / department / status), group-by (company / department / branch)
- [x] KPI strip with click-to-filter lifecycle counts
- [x] Employee profile: header card, tabs (Overview / Job & Org / Statutory & Bank / Documents)
- [x] Lifecycle states: Probation → Active → Notice Period → Exited
- [x] Employment timeline (joined / confirmed / notice / exited)
- [x] Org context on profile: manager + direct reports, click-through
- [x] **Org chart page** (`/org`): dynamic top-down tree built from `reportsTo`,
      collapsible nodes, expand/collapse all, per-entity, updates live as people/levels change
- [x] **Editable reporting** on each profile (Job & Org tab): set "Reports to" and
      add/remove "Manages" (reportees) — both directions, cycle-safe
- [x] Masked sensitive fields (Aadhaar, PAN, UAN, ESI, bank account) with
      click-to-reveal + 10s auto re-mask (DPDP-style, greytHR pattern)
- [x] Profile completeness meter = payroll-readiness (Keka/Zoho pattern)
- [x] Add-employee wizard: Personal → Job & Org → Statutory & Bank → Review;
      per-company employee-code series (NBL-/ARS-/STL-)
- [x] Statutory compliance checklist card (PF / ESI applicability aware)
- [ ] Photo upload
- [ ] Edit employee (inline section editing on profile)
- [ ] Bulk import from Excel (how real HR teams migrate — every Indian platform leads with this)

## Phase 1.5 — Employee Master hardening (from research)

- [ ] Field additions: name-as-per-bank-records, father's/spouse's name (PF Form 2),
      present vs permanent address, tax regime election (old/new), PT/LWF state flags,
      dependents/nominees (ESI declaration, PF nomination, group health insurance)
- [ ] Healthcare-specific: professional registration numbers (medical council, lab tech
      certs) with expiry alerts; background-check block
- [ ] Effective-dated position history (don't overwrite designation — append dated records)
- [ ] Audit trail: who/when/old/new per field change; per-employee History tab
- [ ] Role-based access with entity scope (branch HR sees branch; company payroll admin
      sees entity) + viewer-adaptive profile (peer/manager/HR renderings — Rippling pattern)
- [ ] Self-service edits with HR approval routing for payroll-critical fields
- [ ] Onboarding link: pre-joining self-service form for candidates (Keka/Darwinbox pattern)
- [ ] Exit workflow: resignation → clearances → asset return → F&F trigger
- [ ] Inter-company / inter-branch transfer preserving group tenure

## Phase 2 — Attendance & Shifts

Attendance: date, in/out time, work hours, late marks, half days, leave integration.
Shift management: shift name, start/end, weekly off, rotational shifts, holiday calendar
(per state/branch).

## Phase 3 — Payroll (India)

Basic salary, allowances, incentives, deductions, PF, ESI, TDS, net salary, payslip
generation. Depends on: statutory master data (Phase 1.5), attendance (Phase 2).

## Phase 4 — Documents

Upload/vault per employee (type, number, expiry, verification status), expiry alerts,
letter generation from templates (offer, appointment, confirmation, experience).

## Later

LIS integration, mobile app, performance, dashboard/analytics.

## Design system

- Fonts: Bricolage Grotesque (display) + Instrument Sans (body) + IBM Plex Mono (codes/IDs)
- Canvas: warm paper `#f5f4f0`; ink `#1b1a21`; product accent iris `#5352c4`
- Entity brand hues (matched to logos): Noble indigo `#2e2b6e`, Ares gold `#96751a`/`#d4af37`
- Tokens live in `src/index.css` (@theme) — swap there, everything follows

### Brand assets (`public/brand/`, wired via `components/logos.jsx`)

- `noble-full.png` / `noble-mark.png` — official Noble Diagnostic Centre lockup + ring emblem
- `ares-full.png` / `ares-mark.png` — official Ares Labs lockup + trident-Y emblem
- Full lockups show on the portal picker; emblem marks in the rail badge
- Stellar Apex product mark stays separate (iris sparkle) so it never competes with client logos
