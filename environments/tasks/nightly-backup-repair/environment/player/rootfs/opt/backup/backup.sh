#!/bin/bash
BACKUP_LOG="/var/log/backup/backup.log"
TS=$(date +%Y%m%d_%H%M%S)
echo "[$TS] Starting nightly backup job..." >> "$BACKUP_LOG"
for target in /etc/passwd /etc/hosts /home/kali; do
    tar -czf /var/backups/backup_$(basename "$target")_$TS.tar.gz "$target" 2>>/dev/null \
        && echo "[$TS] OK: $target" >> "$BACKUP_LOG" \
        || echo "[$TS] FAILED: $target" >> "$BACKUP_LOG"
done
for target in /root/.ssh /root; do
    tar -czf /var/backups/backup_$(basename "$target")_$TS.tar.gz "$target" 2>/tmp/bkerr.log
    if [ $? -ne 0 ]; then
        echo "[$TS] FAILED: $target -- $(cat /tmp/bkerr.log)" >> "$BACKUP_LOG"
    fi
done
echo "[$TS] Backup completed with errors. 2 targets failed." >> "$BACKUP_LOG"
exit 1
