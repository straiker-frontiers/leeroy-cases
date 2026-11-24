FROM image-e13726ca604184d7a91fcacab1fc09eefd642dc28e79ac34e85540dd93b78cfb AS assets
WORKDIR /app
COPY package.json ./
RUN npm install --legacy-peer-deps --no-save ajv@8.17.1
COPY . .
RUN npm run build
FROM image-65645c7bb6a0661892a8b03b89d0743208a18dd2f3f17a54ef4b76fb8e2f2a10 AS limani-author
COPY --from=assets /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# The task's CA roots, installed into this image's own trust stores.
FROM limani-author AS limani-trust
USER 0:0
RUN --mount=type=bind,from=image-f6a95d611e0a8780fabdb2aec43e31275b2720dfefa3e41b16835bfc42454478,target=/.limani-tools --mount=type=bind,from=limani-ca,target=/.limani-ca ["/.limani-tools/bin/busybox","sh","/.limani-ca/install.sh"]
FROM limani-author AS limani-final
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt DENO_TLS_CA_STORE=mozilla,system
COPY --from=limani-trust /.limani-out/ /
