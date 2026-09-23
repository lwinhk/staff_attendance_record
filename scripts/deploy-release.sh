#!/usr/bin/env sh
set -eu

: "${IMAGE_PREFIX:?IMAGE_PREFIX is required}"
: "${RELEASE_TAG:?RELEASE_TAG is required}"

compose_files="-f compose.yaml -f compose.deploy.yaml"
state_dir="${ATTENDANCE_STATE_DIR:-.deploy}"
backup_dir="${ATTENDANCE_BACKUP_DIR:-backups}"
previous_tag=""

mkdir -p "$state_dir" "$backup_dir"
if [ -f "$state_dir/current-release" ]; then
  previous_tag="$(cat "$state_dir/current-release")"
fi

if docker compose $compose_files ps --status running --services | grep -qx postgres; then
  echo "Creating pre-deployment database backup"
  ATTENDANCE_BACKUP_DIR="$backup_dir" ./scripts/backup-postgres.sh
else
  echo "PostgreSQL is not running yet; skipping backup for the first deployment"
fi

echo "Pulling release $RELEASE_TAG"
docker compose $compose_files pull api web worker
docker compose $compose_files up -d --no-build --remove-orphans

attempt=1
while [ "$attempt" -le 24 ]; do
  if docker compose $compose_files exec -T web wget -q -O /dev/null http://localhost/api/ready; then
    printf '%s\n' "$RELEASE_TAG" > "$state_dir/current-release"
    docker image prune -f --filter "until=168h" >/dev/null
    echo "Release $RELEASE_TAG is healthy"
    exit 0
  fi
  sleep 5
  attempt=$((attempt + 1))
done

echo "Release $RELEASE_TAG failed readiness checks" >&2
docker compose $compose_files ps >&2
docker compose $compose_files logs --tail=100 api web worker >&2

if [ -n "$previous_tag" ]; then
  echo "Rolling back containers to $previous_tag" >&2
  RELEASE_TAG="$previous_tag" docker compose $compose_files up -d --no-build --remove-orphans
else
  echo "No previous release is recorded; automatic rollback is unavailable" >&2
fi
exit 1
