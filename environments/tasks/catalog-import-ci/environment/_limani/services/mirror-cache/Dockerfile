FROM image-6ff506466f8b1e981719b468cc0023b8ef000b983cdec0eafe119d01f379e31d AS limani-author

WORKDIR /app
COPY server.py .

RUN mkdir -p /var/log/mirror-cache

EXPOSE 9100

CMD ["python3", "-u", "server.py"]

# The task's CA roots, installed into this image's own trust stores.
FROM limani-author AS limani-trust
USER 0:0
RUN --mount=type=bind,from=image-f6a95d611e0a8780fabdb2aec43e31275b2720dfefa3e41b16835bfc42454478,target=/.limani-tools --mount=type=bind,from=limani-ca,target=/.limani-ca ["/.limani-tools/bin/busybox","sh","/.limani-ca/install.sh"]
FROM limani-author AS limani-final
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt DENO_TLS_CA_STORE=mozilla,system
COPY --from=limani-trust /.limani-out/ /
