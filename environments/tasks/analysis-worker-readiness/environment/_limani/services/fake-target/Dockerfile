FROM image-a72b4433de1cf7d6bae0c4cee74d0547f58601a643b3375f070c51600d63b6b2 AS limani-author
RUN apt-get update && apt-get install -y --no-install-recommends openssh-server && rm -rf /var/lib/apt/lists/*
RUN useradd -m -s /bin/bash labuser && echo 'labuser:labpass' | chpasswd && mkdir -p /run/sshd && rm -f /etc/ssh/ssh_host_*
COPY sshd_config /etc/ssh/sshd_config
COPY start.sh /usr/local/bin/start-sshd
RUN chmod 755 /usr/local/bin/start-sshd
CMD ["/usr/local/bin/start-sshd"]

# The task's CA roots, installed into this image's own trust stores.
FROM limani-author AS limani-trust
USER 0:0
RUN --mount=type=bind,from=image-f6a95d611e0a8780fabdb2aec43e31275b2720dfefa3e41b16835bfc42454478,target=/.limani-tools --mount=type=bind,from=limani-ca,target=/.limani-ca ["/.limani-tools/bin/busybox","sh","/.limani-ca/install.sh"]
FROM limani-author AS limani-final
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt DENO_TLS_CA_STORE=mozilla,system
COPY --from=limani-trust /.limani-out/ /
