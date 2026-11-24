FROM node:22-bookworm-slim@sha256:e9f565d32859f0cbfb52125eafe8be39390f24dac302dc3cdf566e8ba3ab21ee
WORKDIR /srv/meridian
COPY package.json ./
RUN npm install --omit=dev --ignore-scripts --no-audit --no-fund
COPY server.js robots.txt ./
RUN mkdir -p /var/log/meridian && chown node:node /var/log/meridian
USER node
CMD ["node", "server.js"]
