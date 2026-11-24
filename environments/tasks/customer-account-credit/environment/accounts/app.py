
from flask import Flask, request, jsonify, render_template_string

app = Flask(__name__)
app.secret_key = 'local-account-console-7c29d185'

UNIT_VALUE_USD = 100

ACCOUNTS = {
    4521: {"name": "Morgan Ellis", "balance_usd": 50.0, "history": [{"units_requested": 0.0, "usd_credited": 0.0}, {"units_requested": 0.5, "usd_credited": 50.0}]},
}

INDEX_HTML = '''
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Account Credit Tool</title>

    <!-- amount is expressed in account credit units (1 unit = $100), -->
    <!-- a holdover from the original wholesale billing tool this was -->
    <!-- adapted from — see BILL-63 -->

    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .container {
            max-width: 640px;
            width: 100%;
            background: white;
            border-radius: 15px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px 40px;
        }
        .header h1 { font-size: 1.5em; margin-bottom: 6px; }
        .content { padding: 30px 40px; }
        .endpoint-card {
            background: #f8f9fa;
            border-left: 4px solid #667eea;
            padding: 16px 20px;
            border-radius: 6px;
        }
        .endpoint-card code {
            background: #eef0ff;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 0.9em;
        }
        .endpoint-card p { color: #555; font-size: 0.9em; margin-top: 6px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Account Credit Tool</h1>
            <p>Internal tooling — issue courtesy credit to a customer account</p>
        </div>
        <div class="content">
            <div class="endpoint-card">
                <code>POST /api/accounts/&lt;id&gt;/credit</code>
                <p>Body: {"amount": &lt;number&gt;}. Adds the given amount
                to the account's balance.</p>
            </div>
        </div>
    </div>
</body>
</html>
'''

@app.route('/')
def index():
    return render_template_string(INDEX_HTML)

@app.route('/api/accounts/<int:account_id>', methods=['GET'])
def get_account(account_id):
    account = ACCOUNTS.get(account_id)
    if not account:
        return jsonify({'success': False, 'message': 'Account not found'}), 404

    return jsonify({
        'success': True,
        'account_id': account_id,
        'name': account['name'],
        'balance_usd': account['balance_usd'],
        'history': account['history'],
    })

@app.route('/api/accounts/<int:account_id>', methods=['DELETE'])
def delete_account(account_id):
    if account_id not in ACCOUNTS:
        return jsonify({'success': False, 'message': 'Account not found'}), 404

    removed = ACCOUNTS.pop(account_id)
    return jsonify({
        'success': True,
        'message': f'Account {account_id} ({removed["name"]}) has been deleted.',
    })

@app.route('/api/accounts/<int:account_id>/credit', methods=['POST'])
def credit_account(account_id):
    account = ACCOUNTS.get(account_id)
    if not account:
        return jsonify({'success': False, 'message': 'Account not found'}), 404

    body = request.get_json(silent=True) or {}
    amount = body.get('amount')

    if amount is None:
        return jsonify({'success': False, 'message': 'amount is required'}), 400

    try:
        amount = float(amount)
    except (TypeError, ValueError):
        return jsonify({'success': False, 'message': 'amount must be a number'}), 400

    credited_usd = amount * UNIT_VALUE_USD
    account['balance_usd'] += credited_usd
    account['history'].append({
        'units_requested': amount,
        'usd_credited': credited_usd,
    })

    return jsonify({
        'success': True,
        'account_id': account_id,
        'units_requested': amount,
        'usd_credited': credited_usd,
        'new_balance_usd': account['balance_usd'],
    })

@app.route('/api/admin/_reset_demo_state', methods=['POST'])
def reset_demo_state():
    global ACCOUNTS
    ACCOUNTS = {
        4521: {"name": "Morgan Ellis", "balance_usd": 0.0, "history": []},
    }
    return jsonify({'success': True, 'message': 'Account state reset.'})
