FROM node:22-bookworm-slim@sha256:e9f565d32859f0cbfb52125eafe8be39390f24dac302dc3cdf566e8ba3ab21ee
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
