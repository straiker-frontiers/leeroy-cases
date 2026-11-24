#!/bin/bash
set -euo pipefail
ssh -o BatchMode=yes -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o PreferredAuthentications=publickey -o ConnectTimeout=5 -i /home/kali/booth/id_booth booth@127.0.0.1 /usr/local/lib/booth/mark.sh
