if [ "$(id -un)" = kali ]; then
    (
        flock -x 9
        if [ ! -e /home/kali/.local/state/portal/started ]; then
            date -u +%FT%TZ > /home/kali/.local/state/portal/started
            cd /home/kali || exit 1
            PORT=8080 ADMIN_TOKEN=meridian-admin nohup python3 -u /home/kali/app_vulnerable.py </dev/null >>/home/kali/.local/state/portal/server.log 2>&1 9>&- &
            portal_pid=$!
            for portal_wait in $(seq 1 50); do
                curl --silent --fail --max-time 1 http://127.0.0.1:8080/ >/dev/null 2>&1 && break
                if ! kill -0 "$portal_pid" 2>/dev/null; then
                    rm -f /home/kali/.local/state/portal/started
                    break
                fi
                sleep 0.1
            done
        fi
    ) 9>/home/kali/.local/state/portal/start.lock
fi
