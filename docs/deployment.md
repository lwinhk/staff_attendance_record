# Development and Production Deployment

## Development environment

1. Install Docker Engine/Desktop with Compose v2.
2. Copy `.env.example` to `.env` and set unique database and object-storage credentials.
3. Provide an S3-compatible private bucket matching `S3_BUCKET`. The endpoint in `S3_ENDPOINT` must be reachable by both containers and the browser for direct signed uploads.
4. Run `docker compose -f compose.yaml -f compose.dev.yaml up --build`.
5. Run the one-time Super Admin bootstrap inside the API container after migrations complete.
6. Open the configured web port and verify `/api/health` and `/api/ready`.

## Production VPS

- Start from `.env.production.example`; never reuse example secrets.
- Place an HTTPS reverse proxy or cloud load balancer in front of the web container. Forward only ports 80/443 publicly; keep PostgreSQL, API, worker, and object storage on private networking.
- Set `WEB_ORIGIN` to the exact HTTPS application origin and `COOKIE_SECURE=true`.
- Configure daily encrypted off-host backups and periodically test restoration.
- Apply OS security updates, enable a firewall, disable password SSH login, and use key-based administration.
- Use container restart policies and monitor `/api/ready`, disk usage, database storage, worker logs, and backup age.

## Database lifecycle

The production API applies versioned migrations before starting. Migrations are append-only. Back up PostgreSQL before deploying a release containing a new migration.

Use `scripts/backup-postgres.sh` for a custom-format backup. `scripts/restore-postgres.sh` requires the explicit `CONFIRM_ATTENDANCE_RESTORE=yes` guard because restoration replaces database contents.

## Retention

The worker removes expired sessions, hides attendance and notifications after 36 months, removes audit events after 36 months, and hides AI recommendations after six months. Generated export files expire after seven days and are removed from object storage when cleanup succeeds.

## Development acceptance checks

Follow `docs/development-test-checklist.md` after all services are healthy. Do not treat compilation-only verification as a substitute for database, browser, object-storage, and backup/restore integration testing.

## GitHub CI/CD

The repository includes two workflows:

- `.github/workflows/ci.yml` runs locked dependency installation, type checking, linting, tests, the production build, and all three Docker builds on pushes to `main` and pull requests.
- `.github/workflows/deploy-production.yml` is manually dispatched, repeats CI, publishes immutable API/web/worker images to GitHub Container Registry, copies only the deployment assets to the VPS, backs up PostgreSQL, deploys, and waits for `/api/ready`.

Deployment is deliberately manual for the initial low-cost VPS setup. Enter `deploy-production` in the workflow input. Configure GitHub's `production` environment with required approval if the repository plan supports it.

### Required GitHub secrets

- `VPS_HOST`: production server hostname or IP address
- `VPS_USER`: restricted SSH deployment account with Docker access
- `VPS_SSH_PRIVATE_KEY`: private key for that account
- `VPS_KNOWN_HOSTS`: pinned host-key line produced from a trusted VPS console, not from an unverified CI connection
- `VPS_DEPLOY_PATH`: absolute directory such as `/opt/attendance`
- `GHCR_USER`: GitHub user or machine account that owns the registry token
- `GHCR_READ_TOKEN`: fine-grained/read-packages token used only by the VPS

The built-in `GITHUB_TOKEN` publishes images. The separate read-only registry token is needed because the VPS runs outside GitHub Actions. Make the packages public if appropriate to avoid a long-lived registry credential, but do not make application secrets public.

### One-time VPS preparation

1. Install Docker Engine and the Compose plugin, create the restricted deployment user, and grant only the access needed to operate Docker.
2. Create `VPS_DEPLOY_PATH`, owned by the deployment user, and put the production `.env` file there with mode `600`.
3. Configure the firewall and HTTPS reverse proxy. `WEB_BIND_ADDRESS` defaults to `127.0.0.1`; change it only when a private-network load balancer must reach the container port.
4. Configure an off-host destination for database backups. The deployment creates a local pre-release backup, but local disk alone is not an adequate backup strategy.
5. Add the GitHub secrets and protect `main`: require pull requests, the `verify` and three container-build checks, resolved review comments, and no force pushes.
6. Run the production workflow. On the first release there is no existing database to back up; later releases require a successful pre-deployment backup.

The deployed release is the commit SHA, never `latest`. The script records the last healthy SHA in `.deploy/current-release`. If readiness does not pass within two minutes, it restores the previous container images and prints recent service logs. Database migrations are append-only and run before the API starts; schema rollback is intentionally not automated.

### Normal release flow

1. Open a pull request and wait for all CI jobs.
2. Review and merge to `main`.
3. Manually run **Deploy production** for that commit and approve the production environment.
4. Confirm the deployment job reports a healthy immutable release, then perform a short attendance login/submission smoke test.
