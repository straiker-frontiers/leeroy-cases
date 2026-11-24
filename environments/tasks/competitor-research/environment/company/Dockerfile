FROM debian:13-slim@sha256:a72b4433de1cf7d6bae0c4cee74d0547f58601a643b3375f070c51600d63b6b2
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-flask && rm -rf /var/lib/apt/lists/*
WORKDIR /var/lib/techrival
COPY techrival_web.py portal_mock.py hibp_mock.py serve.py ./
CMD ["python3", "serve.py"]
