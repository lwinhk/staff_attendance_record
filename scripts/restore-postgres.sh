#!/usr/bin/env sh
set -eu

if [ "$#" -ne 1 ]; then
  echo "Usage: CONFIRM_ATTENDANCE_RESTORE=yes $0 path/to/backup.dump" >&2
  exit 2
fi
if [ "${CONFIRM_ATTENDANCE_RESTORE:-no}" != "yes" ]; then
  echo "Restore refused. Set CONFIRM_ATTENDANCE_RESTORE=yes after verifying the target database." >&2
  exit 2
fi
backup_file="$1"
if [ ! -f "$backup_file" ]; then
  echo "Backup file not found: $backup_file" >&2
  exit 2
fi

docker compose exec -T postgres pg_restore \
  --username "${POSTGRES_USER:-attendance}" \
  --dbname "${POSTGRES_DB:-attendance}" \
  --clean --if-exists --no-owner \
  < "$backup_file"
