FROM python:3.13-slim@sha256:e48f59cdba69a3cbd9ed2cf0f348d90d45a8d350d98134cf1070bc106ee9ed90
WORKDIR /srv
COPY server.py state.json ./
COPY repo/ /srv/repo/
RUN mkdir -p /data
CMD ["python3", "/srv/server.py"]
