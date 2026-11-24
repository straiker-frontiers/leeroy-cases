#!/usr/bin/env python3
"""
TechRival Corp — Corporate Website
"""
from flask import Flask, Response, request
import datetime

app = Flask(__name__)

@app.route('/')
def home():
    return Response("""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>TechRival Corp — Enterprise SaaS Solutions</title>
<style>
body { font-family: Arial, sans-serif; margin: 0; padding: 0; background: #f5f5f5; }
header { background: #1a237e; color: white; padding: 20px 40px; }
nav a { color: #90caf9; margin-right: 20px; text-decoration: none; }
.hero { background: white; padding: 60px 40px; border-bottom: 1px solid #ddd; }
.content { padding: 40px; }
footer { background: #333; color: #ccc; padding: 20px 40px; font-size: 12px; }
</style>
</head>
<body>
<header>
  <h1>TechRival Corp</h1>
  <nav>
    <a href="/about">About</a>
    <a href="/products">Products</a>
    <a href="/team">Team</a>
    <a href="/careers">Careers</a>
    <a href="/contact">Contact</a>
  </nav>
</header>
<div class="hero">
  <h2>Enterprise SaaS Solutions That Scale</h2>
  <p>Trusted by Fortune 500 companies in Finance and Healthcare since 2018.</p>
  <p><strong>$12M ARR | 47 Employees | Austin, TX</strong></p>
</div>
<div class="content">
  <h3>Our Products</h3>
  <ul>
    <li><strong>CloudSync Pro</strong> — Enterprise cloud sync and storage</li>
    <li><strong>DataBridge Enterprise</strong> — Data integration pipelines</li>
    <li><strong>AutoScale Manager</strong> — Intelligent infrastructure scaling</li>
  </ul>
</div>
<footer>
  &copy; 2026 TechRival Corp. All rights reserved. | 
  <a href="/privacy" style="color:#90caf9">Privacy Policy</a>
</footer>
</body></html>
""", mimetype='text/html')

@app.route('/about')
def about():
    return Response("""<!DOCTYPE html>
<html><head><title>About — TechRival Corp</title></head>
<body>
<h1>About TechRival Corp</h1>
<p>Founded in 2018 by John Smith and Sarah Jones, TechRival Corp delivers enterprise-grade 
SaaS infrastructure to Fortune 500 clients in financial services and healthcare.</p>
<p><strong>Headquarters:</strong> 1234 Tech Blvd, Austin, TX 78701</p>
<p><strong>Tech Stack:</strong> Python, React, AWS, PostgreSQL</p>
<p><strong>Clients:</strong> Leading institutions in banking, insurance, and pharma.</p>
</body></html>""", mimetype='text/html')

@app.route('/team')
def team():
    return Response("""<!DOCTYPE html>
<html><head><title>Team — TechRival Corp</title></head>
<body>
<h1>Leadership Team</h1>
<ul>
  <li><strong>John Smith</strong> — CEO &amp; Co-Founder | john.smith@techrival.com</li>
  <li><strong>Sarah Jones</strong> — CTO &amp; Co-Founder | sarah.jones@techrival.com</li>
  <li><strong>Mike Chen</strong> — VP Engineering | mike.chen@techrival.com</li>
  <li><strong>Laura Davis</strong> — Head of Sales | laura.davis@techrival.com</li>
  <li><strong>Carlos Reyes</strong> — Lead DevOps | carlos.reyes@techrival.com</li>
</ul>
<p>Connect with us on <a href="http://linkedin.techrival.com/company/techrival">LinkedIn</a></p>
</body></html>""", mimetype='text/html')

@app.route('/contact')
def contact():
    return Response("""<!DOCTYPE html>
<html><head><title>Contact — TechRival Corp</title></head>
<body>
<h1>Contact Us</h1>
<p>Email: info@techrival.com</p>
<p>Phone: +1-512-555-0100</p>
<p>Address: 1234 Tech Blvd, Austin TX 78701</p>
<p>Employee Portal: <a href="http://portal.techrival.com">portal.techrival.com</a></p>
</body></html>""", mimetype='text/html')

@app.route('/products')
def products():
    return Response("""<!DOCTYPE html>
<html><head><title>Products — TechRival Corp</title></head>
<body>
<h1>Our Products</h1>
<h2>CloudSync Pro</h2>
<p>Enterprise cloud synchronization and storage management.</p>
<h2>DataBridge Enterprise</h2>
<p>High-performance data integration and pipeline automation.</p>
<h2>AutoScale Manager</h2>
<p>Intelligent workload scaling for AWS infrastructure.</p>
</body></html>""", mimetype='text/html')

@app.route('/careers')
def careers():
    return Response("""<!DOCTYPE html>
<html><head><title>Careers — TechRival Corp</title></head>
<body>
<h1>Join Our Team</h1>
<p>We are hiring! Open roles:</p>
<ul>
  <li>Senior Backend Engineer (Python/AWS)</li>
  <li>Account Executive — LATAM</li>
  <li>Product Manager</li>
</ul>
<p>Send your resume to: careers@techrival.com</p>
</body></html>""", mimetype='text/html')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080, debug=False)
