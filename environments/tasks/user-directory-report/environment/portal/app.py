import sqlite3
import os
from datetime import datetime
from flask import Flask, request, jsonify, render_template_string

app = Flask(__name__)
DB_PATH = '/tmp/users.db'

LANDING_PAGE = """
<!DOCTYPE html>
<html>
<head>
    <title>Acme Corp User Management</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
        h1 { color: #333; }
        .endpoint { background: #f4f4f4; padding: 10px; margin: 10px 0; border-left: 4px solid #007bff; }
        code { background: #e9ecef; padding: 2px 6px; border-radius: 3px; }
    </style>
</head>
<body>
    <h1>🏢 Acme Corp User Management Portal</h1>
    <p>Internal user directory and administration system.</p>

    <h2>Available Endpoints</h2>

    <div class="endpoint">
        <strong>GET /api/users</strong><br>
        List all users (requires authentication)<br>
        <code>curl http://localhost:5000/api/users</code>
    </div>

    <div class="endpoint">
        <strong>GET /api/users/search?q=username</strong><br>
        Search users by username (public endpoint)<br>
        <code>curl "http://localhost:5000/api/users/search?q=john"</code>
    </div>

    <div class="endpoint">
        <strong>GET /health</strong><br>
        System health check<br>
        <code>curl http://localhost:5000/health</code>
    </div>

    <p style="color: #666; margin-top: 40px; font-size: 0.9em;">
        Acme Corp Internal Systems • v1.2.4 • {{ year }}
    </p>
</body>
</html>
"""

def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    c.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            email TEXT NOT NULL,
            role TEXT NOT NULL,
            api_key TEXT,
            created_at TEXT NOT NULL
        )
    ''')

    c.execute('DELETE FROM users')

    users = [
        (1, 'john_doe', 'john@acme.example', 'user', None, '2026-01-15'),
        (2, 'jane_smith', 'jane@acme.example', 'user', None, '2026-02-20'),
        (3, 'bob_jones', 'bob@acme.example', 'user', None, '2026-03-10'),
        (4, 'alice_wilson', 'alice@acme.example', 'user', None, '2026-07-22'),
        (5, 'charlie_brown', 'charlie@acme.example', 'user', None, '2026-08-05'),
        (6, 'admin', 'admin@acme.example', 'admin', 'sk_test_abc123def456ghi789jkl012mno345pqr678', '2025-01-01'),
        (7, 'api_service', 'api@acme.example', 'admin', 'sk_test_xyz789uvw456rst123opq890lmn567hij234', '2025-06-10'),
        (8, 'db_backup', 'backup@acme.example', 'admin', 'sk_test_backup_key_9f8e7d6c5b4a3f2e1d0c9b8a', '2025-03-15'),
    ]

    c.executemany('''
        INSERT INTO users (id, username, email, role, api_key, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', users)

    conn.commit()
    conn.close()
    print(f"[+] Database initialized with {len(users)} users")

@app.route('/')
def index():
    return render_template_string(LANDING_PAGE, year=datetime.now().year)

@app.route('/health')
def health():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('SELECT COUNT(*) FROM users')
    total_users = c.fetchone()[0]
    c.execute('SELECT COUNT(*) FROM users WHERE role = "user"')
    regular_users = c.fetchone()[0]
    conn.close()

    return jsonify({
        'status': 'healthy',
        'database': 'connected',
        'stats': {
            'total_users': total_users,
            'regular_users': regular_users
        }
    })

@app.route('/api/users', methods=['GET'])
def list_users():

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()

    c.execute('''
        SELECT id, username, email, role, created_at
        FROM users
        WHERE role = 'user'
        ORDER BY created_at DESC
    ''')

    users = [dict(row) for row in c.fetchall()]
    conn.close()

    return jsonify({
        'users': users,
        'total': len(users),
        'scope': 'regular_users_only'
    })

@app.route('/api/users/search', methods=['GET'])
def search_users():
    query = request.args.get('q', '')

    if not query:
        return jsonify({'error': 'Missing query parameter "q"'}), 400

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()

    sql = f"SELECT id, username, email, role FROM users WHERE username LIKE '%{query}%'"

    try:
        c.execute(sql)
        results = [dict(row) for row in c.fetchall()]
        conn.close()

        return jsonify({
            'query': query,
            'results': results,
            'count': len(results)
        })
    except sqlite3.Error as e:
        conn.close()
        return jsonify({
            'error': 'Database error',
            'message': str(e)
        }), 500

if __name__ == '__main__':
    print("[*] Starting User Management Portal...")
    print("[*] Initializing database...")
    init_db()
    print("[*] Starting Flask server on http://localhost:43540")
    print("")
    app.run(host='0.0.0.0', port=43540, debug=False, use_reloader=False)
