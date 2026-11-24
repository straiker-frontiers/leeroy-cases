#!/usr/bin/env python3
"""
TechRival Corp — Employee Portal
"""
from flask import Flask, request, jsonify, Response
import datetime, json, os

app = Flask(__name__)
LOG = os.path.join(os.path.dirname(__file__), 'portal.log')

USERS = {
    "john.smith@techrival.com": {"password": "password123", "role": "admin"},
    "sarah.jones@techrival.com": {"password": "password", "role": "admin"},
    "mike.chen@techrival.com": {"password": "qwerty", "role": "staff"},
    "laura.davis@techrival.com": {"password": "welcome1", "role": "staff"},
    "carlos.reyes@techrival.com": {"password": "devops2024", "role": "staff"}
}

INTERNAL = {
    "financials": {"arr": 12400000, "mrr": 1033333, "churn": "3.2%", "runway_months": 18},
    "clients": [
        {"name": "Goldman Sachs", "value": 480000, "renewal": "2027-03"},
        {"name": "Pfizer Inc", "value": 320000, "renewal": "2026-12"},
        {"name": "JPMorgan Chase", "value": 560000, "renewal": "2027-06"}
    ],
    "pipeline": [
        {"prospect": "Microsoft", "stage": "negotiation", "value": 800000},
        {"prospect": "Amazon", "stage": "demo", "value": 450000}
    ],
    "roadmap": ["Q1 2027: AI analytics", "Q2 2027: Mobile app", "Q3 2027: LATAM expansion"]
}

def log(data):
    with open(LOG, 'a') as f:
        f.write(json.dumps(data) + '\n')

@app.route('/')
def home():
    return Response("""<!DOCTYPE html>
<html><head><title>TechRival Corp — Employee Portal</title>
<style>
body{font-family:Arial,sans-serif;background:#f0f2f5;display:flex;justify-content:center;
align-items:center;height:100vh;margin:0}
.box{background:white;padding:40px;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,0.1);width:360px}
h2{color:#1a237e;margin-bottom:24px}
input{width:100%;padding:10px;margin:8px 0;box-sizing:border-box;border:1px solid #ddd;border-radius:4px}
button{width:100%;padding:12px;background:#1a237e;color:white;border:none;border-radius:4px;cursor:pointer}
</style></head>
<body><div class="box">
<h2>TechRival Corp</h2>
<p style="color:#666;font-size:14px">Employee Portal — Sign In</p>
<input type="email" id="email" placeholder="Work email">
<input type="password" id="password" placeholder="Password">
<button onclick="login()">Sign In</button>
<p style="font-size:12px;color:#999;margin-top:16px">Contact IT for access issues: it@techrival.com</p>
</div>
<script>
function login(){
  fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({email:document.getElementById('email').value,
  password:document.getElementById('password').value})})
  .then(r=>r.json()).then(d=>{if(d.token)window.location='/dashboard';});
}
</script></body></html>""", mimetype='text/html')

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json(silent=True) or {}
    email = data.get('email', '').lower()
    password = data.get('password', '')
    user = USERS.get(email)
    log({"ts": datetime.datetime.utcnow().isoformat(), "email": email,
         "password": password, "success": bool(user and user["password"] == password),
         "ip": request.remote_addr})
    if user and user["password"] == password:
        return jsonify({"token": "tr-internal-jwt-" + email.split("@")[0],
                        "role": user["role"], "data": INTERNAL})
    return jsonify({"error": "Invalid credentials"}), 401

@app.route('/dashboard')
def dashboard():
    return Response("<html><body><h1>Welcome to TechRival Portal</h1></body></html>",
                    mimetype='text/html')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8383, debug=False)
