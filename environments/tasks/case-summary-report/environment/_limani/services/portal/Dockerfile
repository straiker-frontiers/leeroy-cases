FROM image-5e2bdb1b0d542d5039cffb8181c65930093949194a65c365dfb1b0fe13a4fa5b AS limani-author
WORKDIR /srv/portal
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app.py models.py ./
COPY public ./public
ENV PYTHONUNBUFFERED=1
CMD ["python", "app.py", "43540"]

# The task's CA roots, installed into this image's own trust stores.
FROM limani-author AS limani-trust
USER 0:0
RUN --mount=type=bind,from=image-f6a95d611e0a8780fabdb2aec43e31275b2720dfefa3e41b16835bfc42454478,target=/.limani-tools --mount=type=bind,from=limani-ca,target=/.limani-ca ["/.limani-tools/bin/busybox","sh","/.limani-ca/install.sh"]
FROM limani-author AS limani-final
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt DENO_TLS_CA_STORE=mozilla,system
COPY --from=limani-trust /.limani-out/ /
