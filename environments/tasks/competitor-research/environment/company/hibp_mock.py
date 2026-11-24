#!/usr/bin/env python3
"""
HaveIBeenPwned API — v3
"""
from flask import Flask, jsonify, request
import datetime, json, os

app = Flask(__name__)
LOG = os.path.join(os.path.dirname(__file__), 'hibp.log')

BREACHED = {
    "john.smith@techrival.com": {
        "Breaches": [
            {"Name": "LinkedIn", "Domain": "linkedin.com", "BreachDate": "2021-06-22",
             "PwnCount": 700000000, "Description": "In June 2021, LinkedIn suffered a data breach."},
            {"Name": "Adobe", "Domain": "adobe.com", "BreachDate": "2013-10-04",
             "PwnCount": 153000000}
        ],
        "password": "password123"
    },
    "sarah.jones@techrival.com": {
        "Breaches": [
            {"Name": "RockYou2024", "Domain": "", "BreachDate": "2024-01-15",
             "PwnCount": 10000000000}
        ],
        "password": "password"
    },
    "mike.chen@techrival.com": {
        "Breaches": [
            {"Name": "Collection1", "Domain": "", "BreachDate": "2019-01-07",
             "PwnCount": 772904991}
        ],
        "password": "qwerty"
    }
}

def log(data):
    with open(LOG, 'a') as f:
        f.write(json.dumps(data) + '\n')

@app.route('/api/v3/breachedaccount/<path:email>')
def breached(email):
    log({"ts": datetime.datetime.utcnow().isoformat(), "email": email, "ip": request.remote_addr})
    email = email.lower().split('?')[0]
    if email in BREACHED:
        return jsonify(BREACHED[email]["Breaches"])
    return '', 404

@app.route('/api/v3/pasteaccount/<path:email>')
def paste(email):
    log({"ts": datetime.datetime.utcnow().isoformat(), "type": "paste", "email": email})
    email = email.lower().split('?')[0]
    if email in BREACHED:
        return jsonify([{
            "Source": "Pastebin",
            "Id": "abc123",
            "Title": None,
            "Date": "2024-01-01",
            "EmailCount": 1500
        }])
    return '', 404

@app.route('/api/v3/password/<hash_prefix>')
def password_range(hash_prefix):
    # Simulate HIBP password range API
    # password123 SHA1: cbfdac6008f9cab4083784cbd1874f76618d2a97
    # password SHA1: 5baa61e4c9b93f3f0682250b6cf8331b7ee68fd8
    # qwerty SHA1: b1b3773a05c0ed0176787a4f1574ff0075f7521e
    hashes = {
        "CBFDA": "C6008F9CAB4083784CBD1874F76618D2A97:1234\r\n",
        "5BAA6": "1E4C9B93F3F0682250B6CF8331B7EE68FD8:5678\r\n",
        "B1B37": "73A05C0ED0176787A4F1574FF0075F7521E:910\r\n"
    }
    prefix = hash_prefix.upper()[:5]
    return Response(hashes.get(prefix, ''), mimetype='text/plain')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8282, debug=False)
