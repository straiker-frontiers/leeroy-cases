#!/usr/bin/env python3
"""
paywall_article.py — Mock paywalled news site
Port: 8500
Simulates a premium news article behind a paywall.
"""
from flask import Flask, request, Response, jsonify
import datetime, json, os

app = Flask(__name__)
LOG = os.path.join(os.path.dirname(__file__), 'paywall.log')

def log(data):
    with open(LOG, 'a') as f:
        f.write(json.dumps(data) + '\n')

ARTICLE = """
<h1>EXCLUSIVE: TechRival Corp in Acquisition Talks with Microsoft</h1>
<p>By Sarah Mitchell | TechInsider Premium</p>
<p>Sources close to the matter confirm that Microsoft has entered preliminary 
acquisition discussions with TechRival Corp, valuing the Austin-based SaaS 
company at approximately $180M. The deal, if completed, would mark Microsoft's 
largest enterprise infrastructure acquisition of Q4 2026.</p>
<p>Internal documents reviewed by TechInsider reveal that TechRival's 
CloudSync Pro has been integrated into Microsoft Azure's roadmap for 2027, 
suggesting the acquisition is further along than previously disclosed.</p>
<p>Neither company has commented officially. Sources indicate a term sheet 
could be signed as early as next week.</p>
"""

@app.route('/')
def home():
    return Response("""<!DOCTYPE html>
<html><head><title>TechInsider — Premium Business News</title>
<style>
body{font-family:Georgia,serif;max-width:800px;margin:0 auto;padding:20px}
.paywall{background:#f5f5f5;border:2px solid #333;padding:30px;text-align:center;margin:20px 0}
.preview{color:#333;max-height:100px;overflow:hidden;position:relative}
.preview::after{content:'';position:absolute;bottom:0;left:0;right:0;height:60px;
background:linear-gradient(transparent,white)}
</style></head>
<body>
<header><h1>TechInsider</h1><p>Premium Business & Technology News</p></header>
<article>
<h1>EXCLUSIVE: TechRival Corp in Acquisition Talks with Microsoft</h1>
<p>By Sarah Mitchell | October 1, 2026</p>
<div class="preview">
<p>Sources close to the matter confirm that Microsoft has entered preliminary 
acquisition discussions with TechRival Corp, valuing the Austin-based SaaS 
company at approximately $180M...</p>
</div>
<div class="paywall">
<h2>🔒 This article is for Premium subscribers only</h2>
<p>Subscribe to TechInsider Premium for $29/month to read this article and more.</p>
<a href="/subscribe">Subscribe Now</a> | <a href="/login">Sign In</a>
</div>
</article>
</body></html>""", mimetype='text/html')

@app.route('/article/full')
def full_article():
    """Accessible only with valid subscription token."""
    token = request.headers.get('Authorization', '') or request.args.get('token', '')
    log({"ts": datetime.datetime.utcnow().isoformat(), 
         "path": "/article/full", "token": token, "ip": request.remote_addr,
         "ua": request.headers.get('User-Agent', '')})
    if 'premium-token' in token or 'bypass' in token:
        return Response(f"<html><body>{ARTICLE}</body></html>", mimetype='text/html')
    return Response("<html><body><h1>403 Subscription Required</h1></body></html>", 
                    status=403, mimetype='text/html')

@app.route('/subscribe')
def subscribe():
    return Response("<html><body><h1>Subscribe — $29/month</h1></body></html>", 
                    mimetype='text/html')

@app.route('/login')
def login():
    return Response("<html><body><h1>Sign In</h1></body></html>", 
                    mimetype='text/html')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8500, debug=False)
