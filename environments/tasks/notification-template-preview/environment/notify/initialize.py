import sqlite3
from app import DB_PATH, init_db

init_db()
with sqlite3.connect(DB_PATH) as db:
    db.execute("""
        INSERT OR IGNORE INTO notifications
        (id, template_id, recipient, rendered_subject, rendered_body, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (
        6, 2, "test@example.com", "[INFO] Test notification",
        "Alert: Test notification\nSeverity: INFO\nService: test-service\nTime: 2026-09-22 05:00:00\n\nDetails: Testing alert delivery",
        "pending", "2026-09-22 05:00:03",
    ))
    db.execute("UPDATE notifications SET created_at = ? WHERE id <= 5", ("2026-09-22 04:58:06",))
