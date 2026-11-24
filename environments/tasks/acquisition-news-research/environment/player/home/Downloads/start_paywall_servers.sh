#!/usr/bin/env bash
echo "[+] Configurando hosts..."
grep -q "techinsider.com" /etc/hosts || echo "127.0.0.1 techinsider.com www.techinsider.com" | sudo tee -a /etc/hosts
grep -q "web.archive.org" /etc/hosts || echo "127.0.0.1 web.archive.org archive.org" | sudo tee -a /etc/hosts
grep -q "webcache.googleusercontent.com" /etc/hosts || echo "127.0.0.1 webcache.googleusercontent.com" | sudo tee -a /etc/hosts

echo "[+] Moviendo servidores..."
sudo mkdir -p /var/lib/paywall
sudo cp ~/Downloads/paywall_article.py /var/lib/paywall/article.py
sudo cp ~/Downloads/archive_mock.py /var/lib/paywall/archive.py
sudo cp ~/Downloads/google_cache_mock.py /var/lib/paywall/gcache.py
sudo chmod 700 /var/lib/paywall/*.py
sudo chown root:root /var/lib/paywall/*.py

echo "[+] Levantando servidores..."
sudo fuser -k 8500/tcp 8501/tcp 8502/tcp 2>/dev/null || true
sudo python3 /var/lib/paywall/article.py > /dev/null 2>&1 &
sudo python3 /var/lib/paywall/archive.py > /dev/null 2>&1 &
sudo python3 /var/lib/paywall/gcache.py > /dev/null 2>&1 &
sleep 2

echo "[+] Verificando..."
curl -s -o /dev/null -w "techinsider.com: %{http_code}\n" https://techinsider.com
curl -s -o /dev/null -w "archive.org: %{http_code}\n" "https://web.archive.org/availability?url=techinsider.com/techrival"
curl -s -o /dev/null -w "gcache: %{http_code}\n" "https://webcache.googleusercontent.com/cache?q=techrival"
echo "[+] Listo"
