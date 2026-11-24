FROM image-2cf067cfed83d5ea958367df9f966191a942351a2df77d6f0193e162b5febfc0 AS limani-author
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json .
RUN npm install --production
COPY server.js seed.js ./
RUN mkdir -p /var/log/deploys/orion-api /var/log/deploys/payment-service && \
    echo "[2026-09-18 14:32:01] Starting deploy orion-api v2.14.3\n[2026-09-18 14:32:05] Building image...\n[2026-09-18 14:32:45] Image built: registry.orion.internal:5000/orion-api:v2.14.3\n[2026-09-18 14:33:01] Rolling update started (3 replicas)\n[2026-09-18 14:33:30] Health checks passing\n[2026-09-18 14:33:45] Deploy complete. Active: v2.14.3\n[2026-09-18 14:33:46] Notified #deploys via Slack webhook" > /var/log/deploys/orion-api/2026-09-18-v2.14.3.log && \
    echo "[2026-09-19 09:15:01] Starting deploy orion-api v2.14.4-rc1 to staging\n[2026-09-19 09:15:10] Building image...\n[2026-09-19 09:16:02] Image built\n[2026-09-19 09:16:15] Deploying to staging...\n[2026-09-19 09:16:45] ERROR: Health check failed - /health returned 503\n[2026-09-19 09:16:46] ERROR: Connection refused on port 3000\n[2026-09-19 09:16:47] Deploy FAILED. Rolled back to v2.14.3\n[2026-09-19 09:16:48] Root cause: missing env var DB_CONNECTION in staging config\n[2026-09-19 09:16:49] Fix: set DB_CONNECTION=postgresql://orion:staging_pw_2026@db-staging.orion.internal:5432/orion_staging" > /var/log/deploys/orion-api/2026-09-19-v2.14.4-rc1.log
CMD ["sh", "-c", "node seed.js && node server.js"]

# The task's CA roots, installed into this image's own trust stores.
FROM limani-author AS limani-trust
USER 0:0
RUN --mount=type=bind,from=image-f6a95d611e0a8780fabdb2aec43e31275b2720dfefa3e41b16835bfc42454478,target=/.limani-tools --mount=type=bind,from=limani-ca,target=/.limani-ca ["/.limani-tools/bin/busybox","sh","/.limani-ca/install.sh"]
FROM limani-author AS limani-final
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt DENO_TLS_CA_STORE=mozilla,system
COPY --from=limani-trust /.limani-out/ /
