# Attendance Platform Implementation Record

This record describes the implemented system, important design decisions, verification status, and remaining work. Update it whenever an implementation phase is completed.

## 1. Project foundation

- pnpm TypeScript monorepo with React, Express, shared contracts, PostgreSQL access, and a worker boundary
- production and development Docker Compose definitions
- Nginx static application and `/api` reverse proxy
- installable mobile-first PWA shell
- environment templates, health checks, tests, and production build scripts

## 2. Multi-tenancy and authentication

- platform Super Admin, single Tenant Admin per tenant, Operations Admin, and Site Supervisor roles
- opaque HTTP-only database-backed sessions; only SHA-256 token hashes are stored
- bcrypt password hashes and administrator password reset with session revocation
- tenant settings for company identity, timezone, colour, language, and default daily minutes
- tenant IDs come from authenticated sessions rather than client-provided authorization context
- append-only administrative audit events
- no public registration; initial Super Admin uses a one-time bootstrap command

## 3. Employee and site master data

- employee roles and normal daily minutes
- effective normal-hours hierarchy: employee override, employee-role default, tenant default
- employees, contact information, emergency contacts, photos, status, and soft deletion
- national ID and driver-licence document metadata and verification workflow
- private S3-compatible object storage with short-lived signed upload/download URLs
- sites and effective-dated supervisor-to-site responsibility
- overlap prevention for supervisor responsibility at a site
- Unicode employee CSV export with English column headings

## 4. Duty roster

- effective-dated employee-to-site assignments with optional end dates
- any combination of Monday through Sunday
- date-range and shared-weekday conflict detection, including open-ended assignments
- explicit administrator conflict acknowledgement and audit metadata
- assignment revocation history with a required reason
- supervisor notifications for assignment and removal, including read/unread state
- expected employee lists are derived dynamically; daily expectation rows are not stored

## 5. Attendance collection

- daily sheets derive expected employees from roster assignment dates and weekdays
- only actual submissions and explicit absences are stored
- an expected employee without a submission is reported as absent with a `not_submitted` state
- present, absent, and derived incomplete states
- editable timestamps and overnight work
- optional late, early-end, absence, and general remarks
- supervisors can submit only for sites assigned to them and employees expected at that site/date
- supervisors can correct records for 48 hours from the attendance date's midnight in the tenant timezone
- Tenant Admin and Operations Admin corrections have no time limit
- every correction requires a reason and stores immutable before/after JSON snapshots, editor, role, version, and timestamp
- optimistic version checks prevent one correction from silently overwriting another
- client operation UUIDs make initial submissions idempotent and prepare for future synchronization
- missing end times use the effective normal duration for calculated reporting only; stored evidence remains incomplete and overtime is zero
- completed records calculate worked minutes and daily overtime, including overnight attendance

## 6. Language and user experience

- English/Burmese language preference and Unicode data handling are established
- responsive admin and Android-oriented supervisor layouts are implemented
- login, language switch, and core navigation use valid English/Burmese Unicode translations
- operational data accepts and displays both English and Burmese; exported headings remain English
- the translation catalogue is isolated so remaining workflow copy can be expanded without changing domain logic

## 7. Reporting and exports

- shared reporting queries expand effective roster assignments into expected calendar dates and merge submitted attendance
- detailed attendance by custom date range, site, and employee
- employee/site and employee-only summaries
- daily, Monday-based weekly, and monthly operational summaries
- expected, present, absent, incomplete, late, early-end, worked-minute, and overtime totals
- missing-end calculations use effective normal hours without changing source attendance
- durable PostgreSQL export queue processed by the separate worker service
- CSV and Excel exports with English headings and Unicode data
- Excel workbooks include frozen headings, filters, and readable column widths
- private S3-compatible export storage with five-minute download links and seven-day file availability
- worker row-safety limits protect a low-memory VPS: 100,000 Excel rows and 300,000 CSV rows
- abandoned processing jobs older than 30 minutes return to the queue when a worker starts

## 8. Verification completed

- strict TypeScript checking across all workspace projects
- API health, password security, tenant permission, roster rule, report retention, CSV Unicode, storage-key isolation, and attendance-calculation tests
- React and Express production builds
- production package-layout check for workspace dependencies

## 9. Dashboards and operational controls

- role-specific tenant and supervisor dashboard metrics
- employee, site, roster, attendance, report, notification, automation, and audit navigation
- login throttling with successful-login reset
- hourly background retention cleanup and expired object deletion
- database-backed export queue and stale-job recovery
- deployment, backup, restore, and development test documentation

## 10. Offline and AI extension foundations

- attendance writes use client-generated operation IDs and optimistic versions
- authenticated sync-capability discovery advertises current online-only behavior without promising offline support
- provider-neutral AI recommendation records cover anomaly detection, document monitoring, report summaries, and supervisor assistance
- service-key ingestion is separate from human operator access
- recommendations never apply themselves; Tenant Admin or Operations Admin must approve or reject with a reason
- AI creation and decisions are audited and retained for six months

## 11. Infrastructure verification still required

This development host does not provide Docker, PostgreSQL, or S3-compatible storage. Migrations, database constraints, signed transfers, and full browser workflows must be integration-tested when those services are available. Docker production startup runs migrations before starting the API.

## 12. Completion status

The planned MVP scaffolding phases are implemented. The application is ready for development-environment integration testing using `docs/development-test-checklist.md`. Offline capture, SMS OTP, and cloud-AI provider calls remain intentionally deferred product extensions; their architectural seams are present.

## 13. CI/CD preparation

- pull-request and main-branch CI performs locked installation, type checking, linting, tests, production compilation, and independent API/web/worker image builds
- manually approved production workflow publishes immutable commit-SHA images to GitHub Container Registry
- production deployment uses pinned SSH host identity, a restricted VPS account, external secrets, a pre-release database backup, readiness gating, and container rollback
- Dependabot tracks JavaScript, GitHub Actions, and Docker base-image updates weekly
- operational setup, required secrets, branch protection, first deployment, and normal release flow are documented in `docs/deployment.md`
