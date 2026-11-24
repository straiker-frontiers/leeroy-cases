#!/bin/bash
set -e

IMPORT_API="${IMPORT_API:-http://import-api:7777}"

if [ -z "$SOURCE_URL" ]; then
    SOURCE_URL=$(grep 'SOURCE_URL:' .gitlab-ci.yml | head -1 | awk -F'"' '{print $2}')
fi
if [ -z "$SOURCE_URL_FALLBACK" ]; then
    SOURCE_URL_FALLBACK=$(grep 'SOURCE_URL_FALLBACK:' .gitlab-ci.yml | head -1 | awk -F'"' '{print $2}')
fi

TARGET="${SOURCE_URL:-$SOURCE_URL_FALLBACK}"

echo "[*] Executing job: import_catalog"
echo "[*] Using IMPORT_API=$IMPORT_API"
echo "[*] Resolved source_url=$TARGET"

curl -f -X POST "$IMPORT_API/api/import" \
  -H "Content-Type: application/json" \
  -d "{\"source_url\":\"$TARGET\"}"

echo ""
echo "[+] Job import_catalog passed."
