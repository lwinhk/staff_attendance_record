# Architecture

## Shape

The MVP is a modular monolith deployed on a low-cost VPS. A single React application provides role-specific admin and supervisor experiences. Express exposes the API, PostgreSQL stores transactional data, and a separate worker process will handle asynchronous jobs.

Boundaries are represented as workspace packages so they can be extracted later without paying the operational cost of microservices now.

## Tenancy

Tenant-owned records will include a mandatory `tenant_id`. Tenant context will be established by authenticated membership and applied inside the service/data-access layer; client-provided tenant identifiers will never be trusted as authorization. Platform Super Admin operations will use an explicit separate authorization path.

The Phase 1 schema enforces this separation: Super Admin users have no tenant, all other roles require one, and a partial unique index permits only one Tenant Admin per tenant. Tenant administration queries obtain `tenant_id` from the authenticated server-side session rather than request input.

## Authentication

Users sign in with a globally unique email address or phone number and password. Passwords are bcrypt hashes. The browser receives an HTTP-only SameSite session cookie, while PostgreSQL stores only a SHA-256 hash of the random session token. Disabling an account or resetting its password revokes its sessions.

## Attendance projection

Expected attendance is derived from effective-dated employee-to-site assignments and their selected weekdays. Only submitted attendance and explicit absence records are persisted. Historical assignments are closed and superseded rather than destructively rewritten, preserving reproducible reports.

## Master data

Employee roles define normal daily minutes, with an optional employee-level override. Employee photos and identification files are kept in private S3-compatible storage; PostgreSQL stores metadata and verification state only. Signed object URLs are short lived, tenant-prefixed, and document reads are audited.

Supervisor-to-site relationships are effective-dated. Assignment creation takes a transaction-scoped advisory lock for the site and rejects overlapping date ranges, while preserving ended assignments for historical reporting.

Employee-to-site duty roster assignments use effective date ranges plus ISO weekday arrays. A transaction-scoped employee lock makes conflict detection and insertion atomic. Overlaps are warnings rather than absolute prohibitions: saving a conflict requires explicit confirmation and records the confirming administrator. Supervisor expected-employee views are projections over this assignment history, not generated daily rows.

## Future automation

Background work is isolated behind the worker boundary. Future AI features will create recommendations rather than mutate domain records directly. A human approval will be required, and recommendations, decisions, and resulting actions will be audited.

## Deployment

The initial topology uses one VPS and Docker Compose:

- reverse-proxied static web application
- Express API
- background worker (enabled after jobs are introduced)
- PostgreSQL
- external or self-hosted S3-compatible object storage in a later phase

Development and production use separate environment files and data volumes. No secrets are committed to the repository.
