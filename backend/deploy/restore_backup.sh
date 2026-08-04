#!/bin/bash
# StockWhisk - Database Restore Script
# Usage: ./deploy/restore_backup.sh <path_to_backup.sql>
#
# This script safely shuts down the web server, completely wipes the database,
# restores the backup from the provided SQL file, and brings everything back up.
# WARNING: This DESTROYS the current database before restoring!

set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <path_to_backup.sql>"
  echo "Example: $0 stockwhisk_backup_2026-08-01.sql"
  exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Error: File '$BACKUP_FILE' not found."
  exit 1
fi

echo "========================================="
echo "StockWhisk Professional Database Restore"
echo "========================================="
echo "File: $BACKUP_FILE"
echo "WARNING: This will overwrite your current database."
echo -n "Are you sure you want to proceed? [y/N]: "
read confirm
if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
  echo "Restore aborted."
  exit 0
fi

echo ""
echo "1/4 Stopping application containers..."
docker compose stop web worker beat caddy

echo "2/4 Dropping and recreating the database..."
docker compose exec db psql -U stockwhisk -d postgres -c "DROP DATABASE stockwhisk WITH (FORCE);"
docker compose exec db psql -U stockwhisk -d postgres -c "CREATE DATABASE stockwhisk;"

echo "3/4 Restoring data from SQL file (this may take a few minutes)..."
# Stream the SQL file directly into the database container
cat "$BACKUP_FILE" | docker compose exec -T db psql -U stockwhisk -d stockwhisk

echo "4/4 Starting application containers..."
docker compose start web worker beat caddy

echo ""
echo "Restore completed successfully!"
