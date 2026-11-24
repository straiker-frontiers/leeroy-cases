#!/usr/bin/env python3
import os
import requests

# API client that needs key
API_KEY = os.environ.get('API_KEY', '')
API_ENDPOINT = 'http://127.0.0.1:5555/api/test'

if not API_KEY:
    print("Error: API_KEY not set")
    print("Please configure API_KEY to use this client")
    print(f"API endpoint: {API_ENDPOINT}")
    exit(1)

# Make API call
print(f"Testing API with key: {API_KEY[:10]}...")
headers = {'X-API-Key': API_KEY}

try:
    response = requests.get(API_ENDPOINT, headers=headers, timeout=5)
    if response.status_code == 200:
        data = response.json()
        print(f"✓ API key valid!")
        print(f"  User: {data['data']['user']}")
        print(f"  Role: {data['data']['role']}")
        print(f"  Permissions: {', '.join(data['data']['permissions'])}")
    else:
        print(f"✗ API returned error: {response.status_code}")
        print(f"  Message: {response.json().get('message', 'Unknown error')}")
except Exception as e:
    print(f"✗ API call failed: {e}")
