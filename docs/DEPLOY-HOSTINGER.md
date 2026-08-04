# Deploying Stellar Apex to Hostinger (shared business hosting)

The frontend is a static SPA; the backend is **PHP + MySQL under `/api`**, same-origin
with the site (no CORS, no Node daemon — shared hosting can't run one). Hostinger
auto-pulls the **`hostinger-deploy`** branch, so both the built SPA and the `api/`
folder live on that branch and deploy together.

```
apexhr.stellarinfomatica.com  (subdomain docroot)
├── index.html, assets/, brand/, favicon.svg   ← built SPA (from dist/)
├── .htaccess                                   ← SPA rewrite; excludes /api
└── api/                                         ← PHP backend (this repo's api/)
    ├── index.php, .htaccess, src/, tools/
    ├── config.php        ← created ON SERVER, NOT in git
    └── sql/01-schema.sql, sql/02-seed.sql
```

## One-time setup

### 1. Database (hPanel → MySQL Databases)
- Create a database + user, grant all privileges. Note **db name, user, host
  (usually `localhost`), password**.
- Open **phpMyAdmin** → select the DB → **Import** → run `api/sql/01-schema.sql`,
  then `api/sql/02-seed.sql`. That creates the tables, entities, branches, and the
  three admin users (password `Apex@1234` — change it, see step 4).

### 2. Backend secrets (`api/config.php`)
- Copy `api/config.example.php` → `api/config.php` **on the server** (File Manager
  or SFTP) and fill in the DB creds.
- Generate real secrets and paste them in:
  ```sh
  openssl rand -hex 32   # -> enc_key_hex (AES key; NEVER change after data exists)
  openssl rand -hex 32   # -> jwt_secret
  ```
- `config.php` is gitignored — it must never be committed. `api/.htaccess` also
  denies direct web access to `config.php` and `*.sql` as defence in depth.

> ⚠️ Once employees are saved, the `enc_key_hex` **cannot change** — it decrypts
> Aadhaar/PAN/bank. Losing it makes those fields unrecoverable. Back it up.

### 3. Build + deploy the branch
From `main` after changes:
```sh
npm run build                      # -> dist/ (SPA, already points at /api)
# copy the built SPA + backend into the hostinger-deploy branch (git worktree):
#   dist/*          -> branch root
#   api/            -> branch /api   (exclude api/config.php)
# commit + push hostinger-deploy, then hPanel → Redeploy.
```
The SPA calls `/api` relatively, so no build-time API URL is needed. The SPA
`.htaccess` already has `RewriteRule ^api/ - [L]` so PHP handles `/api`.

### 4. Change the seeded passwords
Log in once, then rotate. To set a new hash:
```sh
php api/tools/hash.php 'YourNewStrongPassword'
# paste the output into users.password_hash via phpMyAdmin
```

### 5. HTTPS
Ensure the subdomain has SSL (hPanel → SSL) and force HTTPS. Cookies aren't used
(auth is a bearer token), but the token must only travel over TLS.

## Verify after deploy
```sh
curl https://apexhr.stellarinfomatica.com/api/health          # {"ok":true}
curl -X POST https://apexhr.stellarinfomatica.com/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"hr@noblediagnostics.in","password":"Apex@1234"}'   # -> token
```
Then open the site, sign in, and confirm the roster loads and reveals work.

## Notes
- **Prod ships empty.** `api/sql/02-seed.sql` seeds only reference data + admin
  users. The demo roster (`api/tools/seed-demo.php`) is dev-only — never run it on
  prod.
- **Authorization header**: `api/.htaccess` forwards it to PHP. If login works but
  authenticated calls 401 on your specific Hostinger stack, confirm the
  `RewriteRule ^ - [E=HTTP_AUTHORIZATION...]` line is active (it is by default).
- Local development mirrors this exactly via Docker — see `api/README.md`.
