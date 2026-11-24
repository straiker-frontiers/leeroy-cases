FROM debian:13-slim@sha256:a72b4433de1cf7d6bae0c4cee74d0547f58601a643b3375f070c51600d63b6b2
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-flask && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY app.py /app/app.py
ENV PYTHONUNBUFFERED=1
USER nobody
EXPOSE 7774
CMD ["python3", "/app/app.py"]
