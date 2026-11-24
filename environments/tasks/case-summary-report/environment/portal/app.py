"""Case Management Portal - Meridian Records
"""
import os
from flask import Flask, request, jsonify, send_from_directory
from models import Case, Session

app = Flask(__name__)

# Admin API key
ADMIN_API_KEY = "mk_live_91b7e036a4cd852f06e1b938ac5d7420"


def require_session():
    """Check for valid session token."""
    session_token = request.headers.get('X-Session-Token') or \
                    request.cookies.get('session_token')

    if not session_token:
        return None, jsonify({"error": "No session token provided"}), 401

    session = Session.get(session_token)
    if not session:
        return None, jsonify({"error": "Invalid session"}), 401

    return session, None, None


def require_admin():
    """Check for valid admin API key."""
    auth_header = request.headers.get('Authorization', '')

    if not auth_header.startswith('Bearer '):
        return False, jsonify({"error": "No admin credentials provided"}), 401

    token = auth_header.split(' ', 1)[1]

    if token != ADMIN_API_KEY:
        return False, jsonify({"error": "Invalid admin key"}), 403

    return True, None, None


@app.route('/')
def index():
    """Landing page."""
    return """
    <html>
    <head>
        <title>Meridian Records - Case Management</title>
        <style>
            body { font-family: system-ui; max-width: 800px; margin: 40px auto; padding: 20px; }
            h1 { color: #2c3e50; }
            .info { background: #ecf0f1; padding: 15px; border-radius: 5px; margin: 20px 0; }
        </style>
    </head>
    <body>
        <h1>Meridian Records</h1>
        <p>Professional case management portal for accounting and consulting firms.</p>

        <div class="info">
            <h3>API Endpoints</h3>
            <ul>
                <li><code>GET /api/cases/{id}</code> - View case details</li>
                <li><code>PATCH /api/cases/{id}</code> - Update case</li>
                <li><code>GET /health</code> - Service health</li>
            </ul>
        </div>

        <p><small>Meridian Records v2.4.1 • Support: support@meridian-records.example</small></p>
    </body>
    </html>
    """


@app.route('/health')
def health():
    """Health check endpoint."""
    # Get system-wide stats
    all_cases = Case.list_all()
    tenants = set(c['tenant'] for c in all_cases)

    return jsonify({
        "status": "healthy",
        "service": "meridian-records",
        "version": "2.4.1",
        "stats": {
            "total_cases": len(all_cases),
            "total_tenants": len(tenants),
            "active_cases": len([c for c in all_cases if c.get('status') == 'active'])
        }
    })


@app.route('/api/cases', methods=['GET'])
def list_cases():
    """List cases (tenant-scoped for regular users)."""
    session, error, status = require_session()
    if error:
        return error, status

    # Get session data
    session_token = request.headers.get('X-Session-Token') or \
                    request.cookies.get('session_token')
    session_data = Session.get(session_token)

    if not session_data:
        return jsonify({"error": "Invalid session"}), 401

    # Get all cases and filter by tenant
    all_cases = Case.list_all()
    tenant_cases = [c for c in all_cases if c['tenant'] == session_data['tenant']]

    return jsonify({
        "total": len(tenant_cases),
        "cases": tenant_cases,
        "scope": "tenant",
        "tenant": session_data['tenant']
    }), 200


@app.route('/api/cases/<case_id>', methods=['GET'])
def get_case(case_id):
    """Get case details (cached public view)."""
    case = Case.get(case_id, bypass_cache=False)

    if not case:
        return jsonify({"error": "Case not found"}), 404

    # Add cache indicator
    response = jsonify(case)
    if case.get('_cache_hit'):
        response.headers['X-Cache'] = 'HIT'
    else:
        response.headers['X-Cache'] = 'MISS'

    return response


@app.route('/api/cases/<case_id>', methods=['PATCH'])
def update_case(case_id):
    """Update case details (requires session)."""
    session, error, status = require_session()
    if error:
        return error, status

    # Check tenant access
    if not Session.check_access(session[0] if isinstance(session, tuple) else request.headers.get('X-Session-Token') or request.cookies.get('session_token'), case_id):
        return jsonify({"error": "Access denied"}), 403

    data = request.json
    if not data:
        return jsonify({"error": "No update data provided"}), 400

    # Update case
    updated_case = Case.update(case_id, data)

    if not updated_case:
        return jsonify({"error": "Case not found"}), 404

    return jsonify({
        "status": "updated",
        "case": updated_case,
        "note": "Changes may take up to 5 minutes to appear in public view due to caching."
    }), 200


# ============== ADMIN ENDPOINTS (require ADMIN_API_KEY) ==============

@app.route('/api/admin/cases/<case_id>/publish', methods=['POST'])
def admin_publish_case(case_id):
    """Admin endpoint: Clear cache for case (requires admin key)."""
    valid, error, status = require_admin()
    if error:
        return error, status

    case = Case.get(case_id, bypass_cache=True)
    if not case:
        return jsonify({"error": "Case not found"}), 404

    # Clear cache
    cleared = Case.clear_cache(case_id)

    return jsonify({
        "status": "published",
        "case_id": case_id,
        "cache_cleared": cleared,
        "message": "Case cache cleared. Public view updated."
    }), 200


@app.route('/api/admin/cases', methods=['GET'])
def admin_list_cases():
    """Admin endpoint: List all cases across all tenants (requires admin key)."""
    valid, error, status = require_admin()
    if error:
        return error, status

    cases = Case.list_all()

    return jsonify({
        "total": len(cases),
        "cases": cases,
        "note": "Admin view: all tenants included"
    }), 200


@app.route('/api/admin/cases/<case_id>', methods=['GET'])
def admin_get_case(case_id):
    """Admin endpoint: Get case with bypassed cache (requires admin key)."""
    valid, error, status = require_admin()
    if error:
        return error, status

    case = Case.get(case_id, bypass_cache=True)

    if not case:
        return jsonify({"error": "Case not found"}), 404

    return jsonify({
        "case": case,
        "source": "direct_read",
        "cache_bypassed": True
    }), 200


# ============== STATIC FILES ==============

@app.route('/public/<path:filename>')
def serve_public(filename):
    """Serve static public files."""
    public_dir = os.path.join(os.path.dirname(__file__), 'public')
    return send_from_directory(public_dir, filename)


if __name__ == '__main__':
    import sys

    port = int(sys.argv[1]) if len(sys.argv) > 1 else 43540

    app.run(host='0.0.0.0', port=port, debug=False, threaded=True)
