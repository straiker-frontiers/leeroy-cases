#!/usr/bin/env bash
echo "[+] Configurando hosts..."
grep -q "techrival.com" /etc/hosts || echo "127.0.0.1 techrival.com www.techrival.com portal.techrival.com" | sudo tee -a /etc/hosts
grep -q "haveibeenpwned.com" /etc/hosts || echo "127.0.0.1 haveibeenpwned.com api.haveibeenpwned.com" | sudo tee -a /etc/hosts

echo "[+] Moviendo servidores a /var/lib/techrival..."
sudo mkdir -p /var/lib/techrival
sudo cp ~/Descargas/techrival_web.py /var/lib/techrival/web.py
sudo cp ~/Descargas/hibp_mock.py /var/lib/techrival/hibp.py
sudo cp ~/Descargas/portal_mock.py /var/lib/techrival/portal.py
sudo chmod 700 /var/lib/techrival/*.py
sudo chown root:root /var/lib/techrival/*.py

echo "[+] Limpiando Descargas..."
rm -f ~/Descargas/techrival_web.py ~/Descargas/hibp_mock.py ~/Descargas/portal_mock.py

echo "[+] Levantando servidores..."
sudo fuser -k 8080/tcp 8282/tcp 8383/tcp 2>/dev/null || true
sleep 1
sudo python3 /var/lib/techrival/web.py > /dev/null 2>&1 &
sudo python3 /var/lib/techrival/hibp.py > /dev/null 2>&1 &
sudo python3 /var/lib/techrival/portal.py > /dev/null 2>&1 &
sleep 2

echo "[+] Verificando..."
curl -s -o /dev/null -w "techrival.com: %{http_code}\n" http://techrival.com
curl -s -o /dev/null -w "haveibeenpwned.com: %{http_code}\n" http://api.haveibeenpwned.com/api/v3/breachedaccount/test@test.com
curl -s -o /dev/null -w "portal.techrival.com: %{http_code}\n" http://portal.techrival.com
echo "[+] Listo"
