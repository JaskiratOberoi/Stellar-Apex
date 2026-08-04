# Stellar Apex — Backend (PHP + MySQL)

Same-origin API under `/api`. Runs on Hostinger shared hosting (plain PHP + MySQL)
**and** locally in Docker (php-apache + MySQL) with identical code. Implements the
contract in [`../docs/BACKEND.md`](../docs/BACKEND.md): server-enforced entity
isolation, AES-256-GCM encryption at rest, masking + audited role-gated reveal,
bcrypt passwords, atomic per-entity code generation, and an append-only audit log.

- **Deploy to Hostinger:** see [`../docs/DEPLOY-HOSTINGER.md`](../docs/DEPLOY-HOSTINGER.md).
- **Local dev:** `docker compose up -d --build` from the repo root, then `npm run dev`.

## Local development (Docker)

From the **repo root**:

```sh
docker compose up -d --build     # apex_db (MySQL) + apex_php (PHP/Apache on :8080)
npm run dev                      # Vite on :5173, proxies /api -> :8080
docker compose logs -f apex_php  # app logs / demo seeding
docker compose down -v           # stop + wipe DB (fresh seed next up)
```

The browser only ever talks to `localhost:5173`; Vite proxies `/api` to the PHP
container — same-origin, exactly like production. MySQL is also exposed on
`localhost:3307` for phpMyAdmin/DBeaver.

## Seeded accounts

Password for all: **`Apex@1234`**.

| Email | Role | Entity |
|---|---|---|
| `hr@noblediagnostics.in` | entity_admin | Noble |
| `hr@areshealthcare.in` | entity_admin | Ares |
| `admin@stellarapex.local` | super_admin | (both — picks a portal) |

Dev seeds a few demo employees per entity (`tools/seed-demo.php`). **Prod ships empty.**

## API

| Method | Path | Notes |
|---|---|---|
| POST | `/api/auth/login` | `{email,password}` → `{token, user}` |
| POST | `/api/auth/logout` | stateless (client drops token) |
| GET | `/api/me` | current user + entity |
| GET | `/api/reference` | entities + branches |
| GET | `/api/employees` | scoped to caller's entity; `?status=&branch=&department=&q=` |
| GET | `/api/employees/:id` | 404 across the entity boundary (never 403) |
| POST | `/api/employees` | server assigns `id`, `code`, `entity_id` |
| PUT | `/api/employees/:id` | partial update (preserves omitted sensitive fields) |
| DELETE | `/api/employees/:id` | soft-delete → `status='exited'` (admin only) |
| POST | `/api/employees/:id/reveal` | `{field:'aadhaar'\|'pan'\|'bank'}` → full value, audited |

Auth is a bearer JWT (`Authorization: Bearer <token>`). super_admin passes the
target entity via the `X-Entity` header; it is ignored for entity-scoped users.

## Config

Resolution order per key: `api/config.php` (created on server) → environment vars
(docker-compose) → dev defaults. So the same code runs on Hostinger and in Docker.
See [`config.example.php`](config.example.php). For prod, generate fresh
`jwt_secret` and `enc_key_hex` (`openssl rand -hex 32`).

## Layout

```
api/
  index.php            # front controller + router
  .htaccess            # routes to index.php, forwards Authorization, denies config/*.sql
  config.example.php   # template -> copy to config.php on server (gitignored)
  sql/                 # 01-schema.sql, 02-seed.sql (reference data + admin users)
  src/
    config.php         # config loader + department/status lists
    db.php             # PDO connection
    crypto.php         # AES-256-GCM (openssl)
    jwt.php            # HS256, dependency-free
    http.php           # request/response + header helpers
    auth.php           # login/token, role guard, entity scope resolver
    mask.php           # masking helpers
    audit.php          # append-only audit writer
    employees.php      # row<->API mapping, CRUD, atomic code gen, reveal, ULID
  tools/
    hash.php           # bcrypt a password (CLI)
    seed-demo.php      # DEV-ONLY demo roster (idempotent)
```
