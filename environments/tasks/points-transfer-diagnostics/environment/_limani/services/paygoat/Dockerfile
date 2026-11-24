FROM image-e13726ca604184d7a91fcacab1fc09eefd642dc28e79ac34e85540dd93b78cfb AS limani-author
WORKDIR /app
COPY player/PAYGoat/backend/package.json ./
RUN npm install --omit=dev
COPY player/PAYGoat/backend/ ./
COPY paygoat/live.db ./database/paygoat.db
RUN chown -R node:node /app
USER node
CMD ["node", "server.js"]

# The task's CA roots, installed into this image's own trust stores.
FROM limani-author AS limani-trust
USER 0:0
RUN --mount=type=bind,from=image-f6a95d611e0a8780fabdb2aec43e31275b2720dfefa3e41b16835bfc42454478,target=/.limani-tools --mount=type=bind,from=limani-ca,target=/.limani-ca ["/.limani-tools/bin/busybox","sh","/.limani-ca/install.sh"]
FROM limani-author AS limani-final
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt DENO_TLS_CA_STORE=mozilla,system
COPY --from=limani-trust /.limani-out/ /
