FROM image-e48f59cdba69a3cbd9ed2cf0f348d90d45a8d350d98134cf1070bc106ee9ed90 AS limani-author
RUN apt-get update && apt-get install -y --no-install-recommends git && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY repository.bundle /tmp/repository.bundle
COPY upstream-head.txt /tmp/upstream-head.txt
RUN mkdir -p /srv/git/MateoRV /srv/git/CampusDev && git clone --bare /tmp/repository.bundle /srv/git/MateoRV/ESCOMVoting.git && git clone --bare /tmp/repository.bundle /srv/git/CampusDev/ESCOMVoting.git && git --git-dir=/srv/git/CampusDev/ESCOMVoting.git update-ref refs/heads/main "$(cat /tmp/upstream-head.txt)" && git --git-dir=/srv/git/MateoRV/ESCOMVoting.git symbolic-ref HEAD refs/heads/main && git --git-dir=/srv/git/CampusDev/ESCOMVoting.git symbolic-ref HEAD refs/heads/main && rm /tmp/repository.bundle /tmp/upstream-head.txt
COPY static /app/static
COPY main.py head.txt /app/
RUN mkdir -p /var/lib/voting
CMD ["python3", "/app/main.py"]

# The task's CA roots, installed into this image's own trust stores.
FROM limani-author AS limani-trust
USER 0:0
RUN --mount=type=bind,from=image-f6a95d611e0a8780fabdb2aec43e31275b2720dfefa3e41b16835bfc42454478,target=/.limani-tools --mount=type=bind,from=limani-ca,target=/.limani-ca ["/.limani-tools/bin/busybox","sh","/.limani-ca/install.sh"]
FROM limani-author AS limani-final
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt DENO_TLS_CA_STORE=mozilla,system
COPY --from=limani-trust /.limani-out/ /
