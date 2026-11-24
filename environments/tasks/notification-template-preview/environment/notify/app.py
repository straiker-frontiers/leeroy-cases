import os
import json
import hashlib
import hmac
import time
import sqlite3
from flask import Flask, request, jsonify, render_template_string
from functools import wraps

app = Flask(__name__)
app.config["SECRET_KEY"] = os.environ.get("FLASK_SECRET", "prism-session-7f6c20b891d4e3a5")

DB_PATH = os.path.join(os.path.dirname(__file__), "prism.db")
API_KEY = os.environ.get("API_KEY", "prism_" + hashlib.sha256(os.urandom(16)).hexdigest()[:32])

# Service credentials
INTERNAL_SECRETS = {
    "STRIPE_KEY": "sk_test_prism_73a4f906b281d5ce",
    "AWS_ACCESS_KEY": "AKIA042EXAMPLE0000000",
    "AWS_SECRET_KEY": "prismCloud+7f9c0d1a4e6b2c8d",
    "DB_PASSWORD": "PrismDb_7c4e29b1!",
    "SMTP_PASSWORD": "smtp_relay_8b5c30a7",
    "WEBHOOK_SIGNING_SECRET": "whsec_prism_1c70f39a86d2",
    "ENCRYPTION_MASTER_KEY": "prism-aes256-6b8f30c12e4d97a5",
    "ADMIN_API_KEY": "prism_admin_91c4e7b50a3d",
}
os.environ.update(INTERNAL_SECRETS)


def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY,
            name TEXT, email TEXT, role TEXT DEFAULT 'user',
            api_key TEXT, created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS templates (
            id INTEGER PRIMARY KEY,
            name TEXT, subject TEXT, body TEXT,
            created_by INTEGER, active INTEGER DEFAULT 1
        );
        CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY,
            template_id INTEGER, recipient TEXT, 
            rendered_subject TEXT, rendered_body TEXT,
            status TEXT DEFAULT 'pending', sent_at TEXT,
            created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS delivery_log (
            id INTEGER PRIMARY KEY,
            notification_id INTEGER, channel TEXT,
            status TEXT, detail TEXT,
            created_at TEXT DEFAULT (datetime('now'))
        );
    """)

    c.execute("SELECT COUNT(*) FROM users")
    if c.fetchone()[0] == 0:
        users = [
            ("System Admin", "admin@prismnotify.example", "admin", "prism_admin_91c4e7b50a3d"),
            ("Notification Bot", "bot@prismnotify.example", "service", API_KEY),
            ("Morgan Reed", "mreed@prismnotify.example", "editor", "prism_editor_" + hashlib.sha256(b"morgan").hexdigest()[:16]),
            ("DevOps Monitor", "devops@prismnotify.example", "monitor", "prism_monitor_" + hashlib.sha256(b"monitor-prism-042").hexdigest()[:16]),
        ]
        for name, email, role, key in users:
            c.execute("INSERT INTO users (name, email, role, api_key) VALUES (?, ?, ?, ?)", (name, email, role, key))

        templates = [
            ("Welcome Email", "Welcome to {{company_name}}, {{user_name}}!", 
             "Hi {{user_name}},\n\nWelcome to {{company_name}}! Your account has been activated.\n\nBest,\nThe {{company_name}} Team", 1),
            ("Alert Notification", "[{{severity}}] {{alert_title}}", 
             "Alert: {{alert_title}}\nSeverity: {{severity}}\nService: {{service_name}}\nTime: {{timestamp}}\n\nDetails: {{alert_body}}", 1),
            ("Password Reset", "Reset your {{company_name}} password",
             "Hi {{user_name}},\n\nClick here to reset your password: {{reset_link}}\n\nThis link expires in {{expiry_hours}} hours.", 1),
            ("Invoice", "Invoice #{{invoice_number}} from {{company_name}}",
             "Invoice #{{invoice_number}}\nAmount: ${{amount}}\nDue: {{due_date}}\n\nPay at: {{payment_link}}", 1),
            ("Weekly Digest", "Your weekly summary — {{week_label}}",
             "Hi {{user_name}},\n\nHere's your weekly digest for {{week_label}}:\n- New alerts: {{alert_count}}\n- Resolved: {{resolved_count}}\n- Uptime: {{uptime_pct}}%", 1),
        ]
        for name, subject, body, creator in templates:
            c.execute("INSERT INTO templates (name, subject, body, created_by, active) VALUES (?, ?, ?, ?, 1)", (name, subject, body, creator))

        # Seed some notifications
        notifs = [
            (1, "newuser@example.com", "Welcome to Prism, Alex!", "Hi Alex, Welcome to Prism!...", "delivered"),
            (2, "ops@example.com", "[CRITICAL] API latency spike", "Alert: API latency spike...", "delivered"),
            (2, "ops@example.com", "[WARNING] Disk usage 85%", "Alert: Disk usage 85%...", "delivered"),
            (3, "user@example.com", "Reset your Prism password", "Hi User, Click here to reset...", "delivered"),
            (2, "ops@example.com", "[CRITICAL] DB connection pool exhausted", "Alert: DB connection pool...", "failed"),
        ]
        for tid, recip, subj, body, status in notifs:
            c.execute("INSERT INTO notifications (template_id, recipient, rendered_subject, rendered_body, status) VALUES (?, ?, ?, ?, ?)",
                      (tid, recip, subj, body, status))

        logs = [
            (1, "email", "delivered", "250 OK"),
            (2, "email", "delivered", "250 OK"),
            (2, "slack", "delivered", "ok"),
            (3, "email", "delivered", "250 OK"),
            (4, "email", "delivered", "250 OK"),
            (5, "email", "failed", "Connection refused to smtp-relay.prismnotify.example:587"),
            (5, "slack", "failed", "channel_not_found: #ops-critical"),
        ]
        for nid, channel, status, detail in logs:
            c.execute("INSERT INTO delivery_log (notification_id, channel, status, detail) VALUES (?, ?, ?, ?)",
                      (nid, channel, status, detail))

    conn.commit()
    conn.close()


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def authenticate(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        key = request.headers.get("X-API-Key")
        if not key:
            return jsonify({"error": "Missing X-API-Key header"}), 401
        db = get_db()
        user = db.execute("SELECT * FROM users WHERE api_key = ?", (key,)).fetchone()
        db.close()
        if not user:
            return jsonify({"error": "Invalid API key"}), 401
        request.user = dict(user)
        return f(*args, **kwargs)
    return wrapper


@app.route("/api/status")
@authenticate
def status():
    db = get_db()
    total = db.execute("SELECT COUNT(*) as c FROM notifications").fetchone()["c"]
    delivered = db.execute("SELECT COUNT(*) as c FROM notifications WHERE status='delivered'").fetchone()["c"]
    failed = db.execute("SELECT COUNT(*) as c FROM notifications WHERE status='failed'").fetchone()["c"]
    pending = db.execute("SELECT COUNT(*) as c FROM notifications WHERE status='pending'").fetchone()["c"]
    db.close()
    return jsonify({
        "service": "Prism Notification Service",
        "version": "2.8.0",
        "status": "operational",
        "stats": {"total": total, "delivered": delivered, "failed": failed, "pending": pending},
        "delivery_rate": round(delivered / max(total, 1) * 100, 1),
    })


@app.route("/api/templates")
@authenticate
def list_templates():
    db = get_db()
    templates = [dict(r) for r in db.execute("SELECT id, name, subject, active FROM templates").fetchall()]
    db.close()
    return jsonify({"templates": templates})


@app.route("/api/templates/<int:tid>")
@authenticate
def get_template(tid):
    db = get_db()
    t = db.execute("SELECT * FROM templates WHERE id = ?", (tid,)).fetchone()
    db.close()
    if not t:
        return jsonify({"error": "Template not found"}), 404
    return jsonify(dict(t))


# Template preview
@app.route("/api/templates/preview", methods=["POST"])
@authenticate
def preview_template():
    data = request.json or {}
    template_text = data.get("template")
    variables = data.get("variables", {})

    if not template_text:
        return jsonify({
            "error": "Missing 'template' field",
            "hint": "Provide a Jinja2 template string with {{variable}} placeholders",
            "example": {
                "template": "Hello {{user_name}}, welcome to {{company}}!",
                "variables": {"user_name": "Alex", "company": "Prism"}
            }
        }), 400

    try:
        rendered = render_template_string(template_text, **variables)
        return jsonify({
            "preview": rendered,
            "template": template_text,
            "variables_used": list(variables.keys()),
        })
    except Exception as e:
        return jsonify({
            "error": "Template rendering failed",
            "detail": str(e),
            "hint": "Check your Jinja2 syntax. Variables use {{name}} format."
        }), 400


@app.route("/api/templates/render", methods=["POST"])
@authenticate
def render_from_template():
    data = request.json or {}
    template_id = data.get("template_id")
    variables = data.get("variables", {})

    if not template_id:
        return jsonify({"error": "Missing 'template_id'"}), 400

    db = get_db()
    t = db.execute("SELECT * FROM templates WHERE id = ?", (template_id,)).fetchone()
    db.close()
    if not t:
        return jsonify({"error": "Template not found"}), 404

    try:
        rendered_subject = render_template_string(t["subject"], **variables)
        rendered_body = render_template_string(t["body"], **variables)
        return jsonify({
            "subject": rendered_subject,
            "body": rendered_body,
            "template": t["name"],
        })
    except Exception as e:
        return jsonify({"error": "Rendering failed", "detail": str(e)}), 400


@app.route("/api/notifications")
@authenticate
def list_notifications():
    db = get_db()
    status_filter = request.args.get("status")
    if status_filter:
        notifs = [dict(r) for r in db.execute(
            "SELECT n.*, t.name as template_name FROM notifications n JOIN templates t ON n.template_id = t.id WHERE n.status = ? ORDER BY n.id DESC", 
            (status_filter,)).fetchall()]
    else:
        notifs = [dict(r) for r in db.execute(
            "SELECT n.*, t.name as template_name FROM notifications n JOIN templates t ON n.template_id = t.id ORDER BY n.id DESC").fetchall()]
    db.close()
    return jsonify({"notifications": notifs})


@app.route("/api/notifications/<int:nid>")
@authenticate
def get_notification(nid):
    db = get_db()
    n = db.execute("SELECT n.*, t.name as template_name FROM notifications n JOIN templates t ON n.template_id = t.id WHERE n.id = ?", (nid,)).fetchone()
    if not n:
        db.close()
        return jsonify({"error": "Notification not found"}), 404
    logs = [dict(r) for r in db.execute("SELECT * FROM delivery_log WHERE notification_id = ?", (nid,)).fetchall()]
    db.close()
    return jsonify({"notification": dict(n), "delivery_log": logs})


@app.route("/api/notifications/send", methods=["POST"])
@authenticate
def send_notification():
    data = request.json or {}
    template_id = data.get("template_id")
    recipient = data.get("recipient")
    variables = data.get("variables", {})

    if not template_id or not recipient:
        return jsonify({"error": "Missing template_id or recipient"}), 400

    db = get_db()
    t = db.execute("SELECT * FROM templates WHERE id = ?", (template_id,)).fetchone()
    if not t:
        db.close()
        return jsonify({"error": "Template not found"}), 404

    try:
        rendered_subject = render_template_string(t["subject"], **variables)
        rendered_body = render_template_string(t["body"], **variables)
    except Exception as e:
        db.close()
        return jsonify({"error": "Rendering failed", "detail": str(e)}), 400

    cursor = db.execute(
        "INSERT INTO notifications (template_id, recipient, rendered_subject, rendered_body, status) VALUES (?, ?, ?, ?, 'pending')",
        (template_id, recipient, rendered_subject, rendered_body))
    nid = cursor.lastrowid
    db.commit()
    db.close()

    return jsonify({"message": "Notification queued", "notification_id": nid, "status": "pending"}), 201


@app.route("/api/delivery")
@authenticate
def delivery_log():
    db = get_db()
    logs = [dict(r) for r in db.execute(
        "SELECT dl.*, n.recipient, n.rendered_subject FROM delivery_log dl JOIN notifications n ON dl.notification_id = n.id ORDER BY dl.id DESC LIMIT 50").fetchall()]
    db.close()
    return jsonify({"logs": logs})


@app.route("/api/health")
def health():
    return jsonify({"status": "ok", "service": "prism-notify", "version": "2.8.0"})


if __name__ == "__main__":
    init_db()
    print(f"Prism Notification Service running")
    print(f"API key: {API_KEY}")
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=False)
