#!/bin/bash
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$DIR/out"
ssh -o BatchMode=yes -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o PreferredAuthentications=publickey -o ConnectTimeout=5 -i "$DIR/id_gate" gate@127.0.0.1 /usr/local/lib/gate/entry.sh > "$DIR/out/latest.txt"
cp "$DIR/out/latest.txt" /var/lib/gate/latest.txt
