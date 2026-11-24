if [ "$(id -u)" = 1000 ] && [ ! -e /run/local-services.started ]; then
    sudo -n /usr/local/sbin/start-local-services
fi
