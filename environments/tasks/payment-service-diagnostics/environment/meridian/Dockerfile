FROM debian:13-slim@sha256:a72b4433de1cf7d6bae0c4cee74d0547f58601a643b3375f070c51600d63b6b2
RUN apt-get update && apt-get install -y --no-install-recommends nodejs node-express && rm -rf /var/lib/apt/lists/*
WORKDIR /srv/meridian
COPY server.js jwt.js data.js ./
COPY public ./public
RUN mkdir -p /var/log/meridian && chown -R nobody:nogroup /var/log/meridian
ENV PORT=6666 AUDIT_FILE=/var/log/meridian/audit.jsonl
USER nobody
CMD ["node", "server.js"]
