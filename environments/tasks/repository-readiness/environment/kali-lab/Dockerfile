FROM debian:13-slim@sha256:a72b4433de1cf7d6bae0c4cee74d0547f58601a643b3375f070c51600d63b6b2
RUN apt-get update && apt-get install -y --no-install-recommends openssh-server python3 iproute2 cron systemd && rm -rf /var/lib/apt/lists/*
RUN useradd -m -s /bin/bash kali-lab && echo 'kali-lab:cedar-lab-4826' | chpasswd && mkdir -p /run/sshd /home/kali-lab/test-results && chown kali-lab:kali-lab /home/kali-lab/test-results && ssh-keygen -A
COPY sshd_config /etc/ssh/sshd_config
CMD ["/usr/sbin/sshd", "-D", "-e"]
