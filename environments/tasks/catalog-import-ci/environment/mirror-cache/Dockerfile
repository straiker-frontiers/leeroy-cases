FROM python:3.10-slim@sha256:6ff506466f8b1e981719b468cc0023b8ef000b983cdec0eafe119d01f379e31d

WORKDIR /app
COPY server.py .

RUN mkdir -p /var/log/mirror-cache

EXPOSE 9100

CMD ["python3", "-u", "server.py"]
