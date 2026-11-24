#!/usr/bin/env python3
from flask import Flask, request, jsonify
import logging

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)

# Valid API key (matches john's key)
VALID_API_KEY = "sk_live_john_6f93b1d8c4207e52"

@app.route('/api/test', methods=['GET', 'POST'])
def test_endpoint():
    """Test endpoint that validates API key"""
    auth_header = request.headers.get('Authorization', '')
    api_key = request.headers.get('X-API-Key', '')
    
    # Check Authorization: Bearer or X-API-Key header
    if auth_header.startswith('Bearer '):
        api_key = auth_header.replace('Bearer ', '')
    
    app.logger.info(f"API request received - Key: {api_key[:20]}... from {request.remote_addr}")
    
    if api_key == VALID_API_KEY:
        return jsonify({
            "status": "success",
            "message": "API key valid",
            "data": {
                "user": "john",
                "role": "admin",
                "permissions": ["read", "write", "delete"]
            }
        }), 200
    else:
        return jsonify({
            "status": "error",
            "message": "Invalid or missing API key"
        }), 401

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "healthy"}), 200

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5555, debug=False)
