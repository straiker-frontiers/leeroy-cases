#!/bin/sh
set -eu
mkdir -p /run/mysqld /var/log/mysql
chown mysql:mysql /run/mysqld /var/log/mysql
if [ ! -d /var/lib/mysql/mysql ]; then
    mariadb-install-db --user=mysql --datadir=/var/lib/mysql >/var/log/mysql/install.log 2>&1
fi
mariadbd --user=mysql --skip-networking --socket=/run/mysqld/mysqld.sock --general-log --general-log-file=/var/log/mysql/query.log &
dbpid=$!
trap 'kill "$dbpid" 2>/dev/null || true' EXIT INT TERM
ready=0
for i in $(seq 1 60); do
    if mariadb-admin --socket=/run/mysqld/mysqld.sock ping --silent; then ready=1; break; fi
    sleep 1
done
[ "$ready" -eq 1 ]
if [ ! -f /var/lib/mysql/.election-initialized ]; then
    mariadb -e 'CREATE DATABASE IF NOT EXISTS votesystem CHARACTER SET utf8mb4;'
    mariadb votesystem < /opt/voting/schema.sql
    mariadb votesystem < /opt/voting/seed.sql
    touch /var/lib/mysql/.election-initialized
fi
php -d display_errors=0 -S 0.0.0.0:8080 -t /srv/voting &
webpid=$!
trap 'kill "$webpid" "$dbpid" 2>/dev/null || true' EXIT INT TERM
wait "$webpid"
