FROM debian:13-slim@sha256:a72b4433de1cf7d6bae0c4cee74d0547f58601a643b3375f070c51600d63b6b2
RUN apt-get update && apt-get install -y --no-install-recommends nodejs node-express node-cookie-parser && rm -rf /var/lib/apt/lists/*
WORKDIR /srv/notary
COPY package.json server.js ./
ENV PORT=7790
USER nobody
CMD ["node", "server.js"]
