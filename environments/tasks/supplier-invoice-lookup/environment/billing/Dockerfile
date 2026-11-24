FROM python:3.13-slim@sha256:e48f59cdba69a3cbd9ed2cf0f348d90d45a8d350d98134cf1070bc106ee9ed90
WORKDIR /app
COPY server.py index.html invoices.json ./
RUN mkdir /data && chown -R 1000:1000 /data
USER 1000:1000
EXPOSE 8080
CMD ["python3", "-u", "server.py"]
