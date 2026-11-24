FROM python:3.12-slim@sha256:5e2bdb1b0d542d5039cffb8181c65930093949194a65c365dfb1b0fe13a4fa5b
WORKDIR /srv/portal
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app.py models.py ./
COPY public ./public
ENV PYTHONUNBUFFERED=1
CMD ["python", "app.py", "43540"]
