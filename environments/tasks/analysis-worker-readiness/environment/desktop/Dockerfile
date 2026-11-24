FROM debian:13-slim@sha256:a72b4433de1cf7d6bae0c4cee74d0547f58601a643b3375f070c51600d63b6b2
RUN apt-get update && apt-get install -y --no-install-recommends xvfb xclip x11-utils && rm -rf /var/lib/apt/lists/*
COPY clipboard.txt /var/lib/desktop/clipboard.txt
COPY start.sh /usr/local/bin/start-desktop
RUN chmod 755 /usr/local/bin/start-desktop
ENV DISPLAY=:1
CMD ["/usr/local/bin/start-desktop"]
