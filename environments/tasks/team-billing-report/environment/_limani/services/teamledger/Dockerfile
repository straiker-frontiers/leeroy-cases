FROM image-e9f565d32859f0cbfb52125eafe8be39390f24dac302dc3cdf566e8ba3ab21ee AS limani-author
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --omit=dev --no-audit --no-fund && npm cache clean --force
COPY server.js data.js ./
COPY public ./public
RUN chmod a+r server.js data.js package.json package-lock.json && chmod -R a+rX public \
    && mkdir -p /var/log/teamledger && chown node:node /var/log/teamledger
ENV PORT=7777 AUDIT_FILE=/var/log/teamledger/audit.jsonl MASS_ASSIGN_PROTECTED=false REPORT_REQUIRES_ADMIN=true
USER node
CMD ["node", "server.js"]

# The task's CA roots, installed into this image's own trust stores.
FROM limani-author AS limani-trust
USER 0:0
RUN --mount=type=bind,from=image-f6a95d611e0a8780fabdb2aec43e31275b2720dfefa3e41b16835bfc42454478,target=/.limani-tools --mount=type=bind,from=limani-ca,target=/.limani-ca ["/.limani-tools/bin/busybox","sh","/.limani-ca/install.sh"]
FROM limani-author AS limani-final
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt DENO_TLS_CA_STORE=mozilla,system
COPY --from=limani-trust /.limani-out/ /
