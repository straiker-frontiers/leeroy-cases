# Lock the installed, world-readable hook so root and player shells share one inode.
nohup sh -c 'flock -n 9 || exit 0; exec socat TCP-LISTEN:4800,bind=127.0.0.1,fork,reuseaddr TCP:portal:4800' 9</etc/profile.d/portal-session.sh </dev/null >/dev/null 2>&1 &
for nexus_wait in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30; do
    curl --max-time 1 -s http://127.0.0.1:4800/ >/dev/null 2>&1 && break
    sleep 1
done
unset nexus_wait
