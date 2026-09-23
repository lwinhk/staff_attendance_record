#!/usr/bin/env sh
set -eu

backup_dir="${ATTENDANCE_BACKUP_DIR:-./backups}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$backup_dir"
final_path="$backup_dir/attendance-$timestamp.dump"
temporary_path="$final_path.partial"
trap 'rm -f "$temporary_path"' EXIT HUP INT TERM

docker compose exec -T postgres pg_dump \
  --username "${POSTGRES_USER:-attendance}" \
  --dbname "${POSTGRES_DB:-attendance}" \
  --format custom \
  --no-owner \
  > "$temporary_path"

mv "$temporary_path" "$final_path"
trap - EXIT HUP INT TERM

find "$backup_dir" -type f -name 'attendance-*.dump' -mtime +30 -delete
echo "Created $final_path"
