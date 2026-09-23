# Development Test Checklist

## Infrastructure

- [ ] PostgreSQL starts healthy and every migration applies once.
- [ ] API `/api/health` returns 200 and `/api/ready` reports the database healthy.
- [ ] Worker stays running and can claim a queued export.
- [ ] Private S3-compatible bucket accepts signed upload, download, and deletion operations.
- [ ] Web application is reachable from Android Chrome on the development network.

## Authentication and tenancy

- [ ] Bootstrap the single Super Admin and verify a second bootstrap is refused.
- [ ] Create two tenants and confirm users cannot read or modify the other tenant’s data.
- [ ] Verify disabled users and suspended tenants cannot continue using old sessions.
- [ ] Verify login rate limiting and password reset session revocation.

## Master data and roster

- [ ] Create roles, employees, documents, sites, and supervisor assignments.
- [ ] Verify document access is denied to supervisors.
- [ ] Test employee-site weekday combinations and open-ended conflict warnings.
- [ ] Confirm assignment and revocation notifications reach the responsible supervisor.

## Attendance

- [ ] Submit present, absent, incomplete, overnight, late, and early-end records.
- [ ] Verify unsubmitted expected employees appear as absent.
- [ ] Verify normal-hour precedence and missing-end calculation.
- [ ] Verify supervisor corrections close after 48 hours and admins can still correct.
- [ ] Attempt concurrent corrections and confirm stale versions are rejected.
- [ ] Verify revision history preserves before/after values and reasons.

## Reports and exports

- [ ] Compare detail and summary totals for the same filters.
- [ ] Check Monday-based weekly and monthly overtime totals.
- [ ] Open CSV and Excel exports containing Burmese text.
- [ ] Restart the worker during processing and confirm stale-job recovery.
- [ ] Verify expired export download links are refused and cleanup removes objects.

## Operations and recovery

- [ ] Confirm dashboards match underlying attendance records.
- [ ] Review audit events for sensitive administrative actions and document access.
- [ ] Ingest an AI recommendation with the service key and approve/reject it as a human operator.
- [ ] Run a backup and restore it into a disposable database.
- [ ] Verify 36-month and six-month retention behavior using test timestamps.
