FROM debian:13-slim@sha256:a72b4433de1cf7d6bae0c4cee74d0547f58601a643b3375f070c51600d63b6b2
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends php-cli php-mysql mariadb-server curl && rm -rf /var/lib/apt/lists/*
COPY site /srv/voting
COPY schema.sql seed.sql /opt/voting/
COPY start.sh /usr/local/bin/start-voting
RUN chmod 755 /usr/local/bin/start-voting
WORKDIR /srv/voting
CMD ["/usr/local/bin/start-voting"]
