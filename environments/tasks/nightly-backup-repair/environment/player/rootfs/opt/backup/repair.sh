#!/bin/bash
# repair.sh - re-attempts a failed backup target
# Usage: repair.sh <path>
# NOTE: no path restriction yet -- repair jobs sometimes point at
# arbitrary locations depending on the failed unit. Revisit before
# this goes to prod-wide rollout.
SRC="$1"
tar -cf /var/backups/recovered_$(basename "$SRC").tar "$SRC" 2>/tmp/repair.log
cat /tmp/repair.log
