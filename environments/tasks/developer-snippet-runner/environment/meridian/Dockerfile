FROM node:22-bookworm-slim@sha256:e9f565d32859f0cbfb52125eafe8be39390f24dac302dc3cdf566e8ba3ab21ee
RUN groupadd --gid 1001 msb && useradd --uid 1001 --gid 1001 --create-home --shell /bin/bash msb
WORKDIR /home/msb/app
COPY package.json ./
RUN npm install --omit=dev --ignore-scripts --no-audit --no-fund && chown -R msb:msb /home/msb
COPY --chown=msb:msb server.js ./
COPY --chown=msb:msb service.env .env
USER msb
CMD ["node", "server.js"]
