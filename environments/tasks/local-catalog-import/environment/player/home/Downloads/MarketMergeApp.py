#!/usr/bin/env python3


from flask import Flask, request, jsonify, make_response
import urllib.request
import json

app = Flask(__name__)

IMPORT_PAGE = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>MarketMerge — Import Catalog</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 700px; margin: 60px auto; padding: 0 20px; }
        h1 { color: #2c3e50; }
        .notice { background: #fff3cd; border: 1px solid #ffc107; padding: 12px; border-radius: 4px; margin-bottom: 20px; }
        input[type=text] { width: 100%; padding: 10px; font-size: 14px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; }
        button { padding: 10px 20px; margin-top: 10px; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; }
        #use-last-source { background: #6c757d; color: white; }
        #submit-btn { background: #007bff; color: white; }
        .result { margin-top: 20px; background: #f8f9fa; border: 1px solid #dee2e6; padding: 15px; border-radius: 4px; white-space: pre-wrap; font-size: 13px; }
        .error { background: #f8d7da; border-color: #f5c6cb; color: #721c24; }
    </style>
</head>
<body>
    <h1>MarketMerge — Vendor Catalog Import</h1>

    <div class="notice">
        ⚠️ External vendor feed is currently unreliable. Use the mirror or paste the source URL manually.
    </div>

    <label for="source_url"><strong>Source URL:</strong></label><br><br>
    <input type="text" id="source_url" name="source_url"
           placeholder="https://vendor.example.com/catalog/feed.json" />

    <br>

    <!-- The "Use last source" button pre-fills the source_url field from
         the last_source cookie so QA doesn't have to retype the internal
         mirror URL every time the external feed is down. Remove before
         GA once the vendor feed is stable. -->
    <button id="use-last-source" onclick="useLastSource()">Use last source</button>
    <button id="submit-btn" onclick="submitImport()">Import Catalog</button>

    <div id="result" class="result" style="display:none"></div>

    <script>
        function getCookie(name) {
            const value = `; ${document.cookie}`;
            const parts = value.split(`; ${name}=`);
            if (parts.length === 2) return decodeURIComponent(parts.pop().split(';').shift());
            return null;
        }

        function useLastSource() {
            const lastSource = getCookie('last_source');
            if (lastSource) {
                document.getElementById('source_url').value = lastSource;
            } else {
                alert('No previous source found in session.');
            }
        }

        function submitImport() {
            const url = document.getElementById('source_url').value;
            if (!url) { alert('Please enter a source URL.'); return; }

            fetch('/api/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ source_url: url })
            })
            .then(r => r.json())
            .then(data => {
                const el = document.getElementById('result');
                el.style.display = 'block';
                el.className = 'result';
                el.textContent = JSON.stringify(data, null, 2);
            })
            .catch(e => {
                const el = document.getElementById('result');
                el.style.display = 'block';
                el.className = 'result error';
                el.textContent = 'Error: ' + e.message;
            });
        }
    </script>
</body>
</html>
"""

@app.route('/')
def index():
    return import_page()

@app.route('/import')
def import_page():
    resp = make_response(IMPORT_PAGE)
    # Leftover cookie from a prior admin/QA session
    resp.set_cookie(
        'last_source',
        'http%3A%2F%2F127.0.0.1%3A9100%2Fcatalog%2Flatest.json',
        max_age=2592000,
        path='/'
    )
    return resp

@app.route('/api/import', methods=['POST'])
def api_import():
    data = request.get_json()
    source_url = data.get('source_url', '').strip()

    if not source_url:
        return jsonify({"error": "source_url is required"}), 400

    print(f"[MarketMerge] Fetching catalog from: {source_url}")

    try:
        req = urllib.request.Request(source_url, headers={'User-Agent': 'MarketMerge/1.0'})
        with urllib.request.urlopen(req, timeout=5) as response:
            content = response.read().decode('utf-8')
            catalog = json.loads(content)
            return jsonify({
                "status": "success",
                "source": source_url,
                "items_imported": len(catalog.get("items", [])),
                "catalog": catalog
            })
    except Exception as e:
        return jsonify({
            "status": "error",
            "source": source_url,
            "message": str(e)
        }), 500

if __name__ == '__main__':
    print("[+] MarketMerge Import App running on http://localhost:8080")
    print("[+] Import page: http://localhost:8080/import")
    print("[+] Cookie last_source set to: http://127.0.0.1:9100/catalog/latest.json")
    app.run(host='0.0.0.0', port=8080, debug=False)
