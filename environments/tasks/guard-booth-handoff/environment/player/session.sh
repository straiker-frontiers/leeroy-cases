if [ "$(id -un)" = kali ]; then
    sudo -n /usr/local/sbin/start-local-services
fi
