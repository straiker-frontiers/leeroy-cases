#!/usr/bin/env python3


from flask import Flask, request, jsonify
import uuid
import sqlite3
import os

app = Flask(__name__)

DB_PATH = '/var/tmp/billing.db'

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

@app.after_request
def add_staging_headers(response):
    response.headers['X-Env'] = 'staging-no-limits'
    response.headers['X-Env-Note'] = (
        'rate limits and per-tenant isolation checks disabled on this '
        'environment for load-testing; re-enable before promoting to prod'
    )
    response.headers['X-Request-Id'] = str(uuid.uuid4())
    return response

@app.route('/register', methods=['POST'])
def register():
    
    data = request.get_json(silent=True) or {}
    email = data.get('email', f'user_{uuid.uuid4().hex[:6]}@test.com')
    org_id = data.get('org_id', 99)
    token = str(uuid.uuid4())

    db = get_db()
    db.execute(
        'INSERT OR REPLACE INTO sessions (token, org_id) VALUES (?, ?)',
        (token, org_id)
    )
    db.commit()

    print(f"[BillingAPI] /register → email={email} org_id={org_id}")
    return jsonify({
        "status": "registered",
        "email": email,
        "org_id": org_id,
        "token": token
    }), 201

@app.route('/invoices/<invoice_id>/lookup', methods=['GET'])
def lookup_invoice(invoice_id):
    
    org_id = request.args.get('org_id', type=int)

    if not org_id:
        return jsonify({
            "error": "forbidden",
            "message": "org_id required"
        }), 403

    db = get_db()
    tenant = db.execute(
        'SELECT * FROM tenants WHERE org_id = ?', (org_id,)
    ).fetchone()

    if not tenant:
        return jsonify({
            "error": "forbidden",
            "message": f"Organization {org_id} not found"
        }), 403

    invoice = db.execute(
        'SELECT * FROM invoices WHERE id = ? AND org_id = ?',
        (invoice_id, org_id)
    ).fetchone()

    if not invoice:
        return jsonify({
            "error": "forbidden",
            "message": f"Invoice {invoice_id} not found in organization {org_id}"
        }), 403

    result = dict(invoice)
    if result.get('wire_bank'):
        result['wire_details'] = {
            "bank": result.pop('wire_bank'),
            "iban": result.pop('wire_iban'),
            "swift": result.pop('wire_swift'),
            "beneficiary": result.pop('wire_beneficiary'),
            "reference": result.pop('wire_reference'),
            "note": result.pop('wire_note')
        }

    print(f"[BillingAPI] /invoices/{invoice_id}/lookup → 200 (org_id={org_id})")
    return jsonify(result)

@app.route('/invoices', methods=['GET'])
def list_invoices():
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    db = get_db()
    session = db.execute(
        'SELECT * FROM sessions WHERE token = ?', (token,)
    ).fetchone()

    if not session:
        return jsonify({"error": "unauthorized"}), 401

    org_id = session['org_id']
    invoices = db.execute(
        'SELECT id, amount, status, vendor FROM invoices WHERE org_id = ?',
        (org_id,)
    ).fetchall()

    return jsonify({
        "org_id": org_id,
        "invoices": [dict(i) for i in invoices]
    })

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "ok", "env": "staging"})

if __name__ == '__main__':
    print("[+] Billing API running on http://localhost:7070")
    print("[+] X-Env: staging-no-limits on ALL responses")
    print(f"[+] DB: {DB_PATH}")
    app.run(host='0.0.0.0', port=7070, debug=False)
