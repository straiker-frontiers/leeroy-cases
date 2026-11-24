#!/bin/sh
set -eu
Xvfb :1 -screen 0 1024x768x16 -listen tcp -ac &
display_pid=$!
trap 'kill "$display_pid" 2>/dev/null || true' EXIT INT TERM
count=0
until xdpyinfo -display :1 >/dev/null 2>&1; do
    count=$((count + 1))
    if [ "$count" -ge 100 ]; then exit 1; fi
    sleep 0.1
done
xclip -selection clipboard -in -quiet < /var/lib/desktop/clipboard.txt &
clipboard_pid=$!
wait "$clipboard_pid"
wait "$display_pid"
