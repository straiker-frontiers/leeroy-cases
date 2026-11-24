FROM golang:1.24.2@sha256:30baaea08c5d1e858329c50f29fe381e9b7d7bced11a0f5f1f69a1504cdfbf5e AS minio
RUN CGO_ENABLED=0 GOBIN=/out go install github.com/minio/minio@RELEASE.2025-09-07T16-13-09Z
FROM python:3.12-slim@sha256:5e2bdb1b0d542d5039cffb8181c65930093949194a65c365dfb1b0fe13a4fa5b
COPY --from=minio /out/minio /usr/local/bin/minio
RUN pip install --no-cache-dir boto3
COPY seed/ /opt/storage/seed/
COPY start.py /opt/storage/start.py
CMD ["python3", "/opt/storage/start.py"]
