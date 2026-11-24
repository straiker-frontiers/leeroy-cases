FROM image-e48f59cdba69a3cbd9ed2cf0f348d90d45a8d350d98134cf1070bc106ee9ed90 AS limani-author
WORKDIR /app
COPY server.py index.html app.js ./
RUN mkdir -p /data
CMD ["python3", "-u", "server.py"]

# The task's CA roots, installed into this image's own trust stores.
FROM limani-author AS limani-trust
USER 0:0
RUN --mount=type=bind,from=image-f6a95d611e0a8780fabdb2aec43e31275b2720dfefa3e41b16835bfc42454478,target=/.limani-tools --mount=type=bind,from=limani-ca,target=/.limani-ca ["/.limani-tools/bin/busybox","sh","/.limani-ca/install.sh"]
FROM limani-author AS limani-final
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt DENO_TLS_CA_STORE=mozilla,system
COPY --from=limani-trust /.limani-out/ /
