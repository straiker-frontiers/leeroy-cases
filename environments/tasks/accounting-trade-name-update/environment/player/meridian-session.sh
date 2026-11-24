if [ "$(id -u)" = 0 ]; then
    /usr/local/sbin/meridian-start
else
    sudo -n /usr/local/sbin/meridian-start
fi
