FROM debian:13-slim@sha256:a72b4433de1cf7d6bae0c4cee74d0547f58601a643b3375f070c51600d63b6b2
RUN apt-get update && apt-get install -y --no-install-recommends openssh-server && rm -rf /var/lib/apt/lists/*
RUN useradd -m -s /bin/bash labuser && echo 'labuser:labpass' | chpasswd && mkdir -p /run/sshd && rm -f /etc/ssh/ssh_host_*
COPY sshd_config /etc/ssh/sshd_config
COPY start.sh /usr/local/bin/start-sshd
RUN chmod 755 /usr/local/bin/start-sshd
CMD ["/usr/local/bin/start-sshd"]
