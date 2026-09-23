# Attendance Platform

Multi-tenant attendance management platform for facility and security companies. The repository contains a responsive React application, an Express API, shared contracts, and a PostgreSQL integration package.

## Workspace

- `apps/web` — admin and mobile-first supervisor PWA shell
- `apps/api` — Express API with health and database-readiness endpoints
- `apps/worker` — background worker boundary for later reports, notifications, and AI tasks
- `packages/contracts` — framework-neutral API contracts and shared types
- `packages/database` — PostgreSQL connection boundary
- `docs` — architecture and implementation notes

## Local development

Requirements: Node.js 22+, pnpm 12+, and PostgreSQL 17+ (or Docker).

```bash
corepack enable
pnpm install
cp .env.example .env
pnpm db:migrate
pnpm bootstrap:super-admin
pnpm dev
```

Web: `http://localhost:5173`  
API health: `http://localhost:3000/api/health`  
API readiness: `http://localhost:3000/api/ready`

## Docker

Production-like build:

```bash
docker compose up --build
```

Development with bind mounts:

```bash
docker compose -f compose.yaml -f compose.dev.yaml up --build
```

Copy `.env.example` to `.env` and replace default credentials before deploying. The Compose definition intentionally keeps PostgreSQL private in production.

## Quality checks

```bash
pnpm typecheck
pnpm test
pnpm build
```

## Phase 1 administration

The application includes tenant-aware authentication and administration foundations. Before the one-time Super Admin bootstrap, set `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD`, and optionally `SUPER_ADMIN_NAME` in the environment. The password must contain at least 12 characters.

The bootstrap command refuses to create a second Super Admin. After signing in, the Super Admin creates tenants and their single Tenant Admin. A Tenant Admin can create Operations Admin and Site Supervisor accounts. Operations Admin can reset Site Supervisor passwords through the API.

Authentication uses random opaque session cookies; only their SHA-256 hashes are stored in PostgreSQL. Passwords are protected with bcrypt. Administrative changes produce append-only audit events.

Employee, site, assignment, and attendance workflows are intentionally not part of Phase 1.

## Employee and site foundation

The second application phase adds employee roles, role and employee-specific normal working hours, employee records, private photos and identification documents, verification status, sites, and effective-dated supervisor-to-site assignments. Employee export uses English CSV headings and preserves Unicode data.

Object storage is not public. Configure the `S3_*` variables for an AWS S3 or S3-compatible service and create the configured private bucket before uploading. Browser uploads use ten-minute signed URLs; document reads use five-minute signed URLs and are audit logged. The S3 endpoint must be reachable by supervisors' and administrators' browsers because uploads go directly to object storage.

Current migrations run automatically when the production API container starts. For development, run `pnpm db:migrate` after pulling schema changes.

## Duty roster

Duty roster records are effective-dated employee-to-site assignments with any combination of ISO weekdays (`1` Monday through `7` Sunday). Creating an overlapping assignment first returns a conflict preview; an administrator must explicitly acknowledge the warning before saving it. Open-ended assignments participate in the same conflict check.

Supervisors see expected employees dynamically for a selected assigned site and date. The query combines assignment date ranges and weekdays, so no expected daily attendance rows are stored. Assignment and revocation events create read/unread supervisor notifications and remain in the audit trail.

## Attendance collection

The attendance sheet merges the derived roster with stored submissions. Supervisors can record present or absent employees, editable start/end timestamps, overnight work, late and early-end flags, and remarks. Their correction window closes 48 hours after midnight at the beginning of the attendance date in the tenant timezone; Tenant Admin and Operations Admin corrections remain unrestricted.

Corrections require reasons and use optimistic versions. Each revision retains before and after snapshots. Missing end times remain incomplete in storage while reporting calculations derive an end from employee, role, or tenant normal hours and produce no overtime. See `docs/implementation-record.md` for the cumulative implementation record.

## Reporting and exports

Tenant Admin and Operations Admin can run filtered attendance detail, employee/site, employee, and daily/weekly/monthly summary reports. Reports expand roster dates dynamically, so an expected employee without a submission contributes to absence totals.

CSV and Excel exports are queued in PostgreSQL and processed by the `worker` Compose service. Completed files are private in S3-compatible storage and available through short-lived download URLs for seven days. The worker automatically retries jobs left in `processing` for more than 30 minutes after a restart.
