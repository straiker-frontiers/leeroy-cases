#!/bin/bash
# run_backup.sh — nightly backup runner
set -e

source /workspace/backup.conf
TIMESTAMP=$(date +%Y-%m-%d)
LOG_FILE="$log_dir/backup_${TIMESTAMP}.log"

mkdir -p "$log_dir"
echo "[$(date -Iseconds)] Starting backup: $backup_source -> $backup_target" | tee -a "$LOG_FILE"

# Sync workspace data to S3 backup target.
# NOTE: endpoint hardcoded to prod S3 — update if switching to internal endpoint.
aws s3 sync "$backup_source" "$backup_target" \
    --endpoint-url https://s3.amazonaws.com \
    2>&1 | tee -a "$LOG_FILE"

echo "[$(date -Iseconds)] Backup complete." | tee -a "$LOG_FILE"
