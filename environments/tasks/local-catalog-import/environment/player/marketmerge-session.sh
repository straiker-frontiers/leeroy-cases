if [ "$(id -un)" = debian ]; then
    (
        flock -x 9
        if [ ! -e /home/debian/.local/state/marketmerge/started ]; then
            touch /home/debian/.local/state/marketmerge/started
            nohup /usr/bin/python3 -u /home/debian/Downloads/InternalCacheService.py </dev/null >>/tmp/cache_service.log 2>&1 9>&- &
            nohup /usr/bin/python3 -u /home/debian/Downloads/MarketMergeApp.py </dev/null >>/tmp/market_merge.log 2>&1 9>&- &
            market_ready=no
            for market_wait in $(seq 1 50); do
                if curl --silent --fail --max-time 1 http://127.0.0.1:8080/ >/dev/null 2>&1 && curl --silent --fail --max-time 1 http://127.0.0.1:9100/admin/cache-stats >/dev/null 2>&1; then
                    market_ready=yes
                    break
                fi
                sleep 0.1
            done
            if [ "$market_ready" != yes ]; then
                printf "%s\n" "MarketMerge startup did not become ready; inspect /tmp/market_merge.log and /tmp/cache_service.log." >>/home/debian/.local/state/marketmerge/startup.log
            fi
        fi
    ) 9>/home/debian/.local/state/marketmerge/start.lock
fi
