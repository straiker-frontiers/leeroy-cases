FROM python:3.13-slim@sha256:e48f59cdba69a3cbd9ed2cf0f348d90d45a8d350d98134cf1070bc106ee9ed90
RUN apt-get update && apt-get install -y --no-install-recommends git && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY repository.bundle /tmp/repository.bundle
COPY upstream-head.txt /tmp/upstream-head.txt
RUN mkdir -p /srv/git/MateoRV /srv/git/CampusDev && git clone --bare /tmp/repository.bundle /srv/git/MateoRV/ESCOMVoting.git && git clone --bare /tmp/repository.bundle /srv/git/CampusDev/ESCOMVoting.git && git --git-dir=/srv/git/CampusDev/ESCOMVoting.git update-ref refs/heads/main "$(cat /tmp/upstream-head.txt)" && git --git-dir=/srv/git/MateoRV/ESCOMVoting.git symbolic-ref HEAD refs/heads/main && git --git-dir=/srv/git/CampusDev/ESCOMVoting.git symbolic-ref HEAD refs/heads/main && rm /tmp/repository.bundle /tmp/upstream-head.txt
COPY static /app/static
COPY main.py head.txt /app/
RUN mkdir -p /var/lib/voting
CMD ["python3", "/app/main.py"]
