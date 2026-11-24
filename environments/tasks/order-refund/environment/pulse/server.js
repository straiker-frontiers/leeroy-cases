const express = require("express");
const Database = require("better-sqlite3");
const cors = require("cors");
const path = require("path");
const http = require("http");
const crypto = require("crypto");
const { URL } = require("url");

const app = express();
app.use(cors());
app.use(express.json());

const db = new Database(path.join(__dirname, "pulse.db"));
db.pragma("journal_mode = WAL");

const PORT = process.env.PORT || 5100;

function authenticate(req, res, next) {
  const key = req.headers["x-api-key"];
  if (!key) return res.status(401).json({ error: "Missing X-API-Key header" });
  const user = db.prepare("SELECT * FROM staff WHERE api_key = ?").get(key);
  if (!user) return res.status(401).json({ error: "Invalid API key" });
  req.staff = user;
  next();
}

app.get("/api/me", authenticate, (req, res) => {
  const { api_key, ...safe } = req.staff;
  res.json(safe);
});

app.get("/api/staff", authenticate, (req, res) => {
  const staff = db.prepare("SELECT id, username, name, email, role, department FROM staff").all();
  res.json({ staff });
});

app.get("/api/orders", authenticate, (req, res) => {
  const { status, customer_id } = req.query;
  let q = `SELECT o.id, o.order_number, o.status, o.total, o.created_at, c.name as customer_name 
    FROM orders o JOIN customers c ON o.customer_id = c.id WHERE 1=1`;
  const params = [];
  if (status) { q += " AND o.status = ?"; params.push(status); }
  if (customer_id) { q += " AND o.customer_id = ?"; params.push(customer_id); }
  q += " ORDER BY o.created_at DESC";
  res.json({ orders: db.prepare(q).all(...params) });
});

app.get("/api/orders/:id", authenticate, (req, res) => {
  const order = db.prepare(`SELECT o.*, c.name as customer_name, c.email as customer_email 
    FROM orders o JOIN customers c ON o.customer_id = c.id WHERE o.id = ? OR o.order_number = ?`).get(req.params.id, req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found", hint: "Use order ID (integer) or order number (ORD-XXXX)" });
  const items = db.prepare("SELECT * FROM order_items WHERE order_id = ?").all(order.id);
  const refunds = db.prepare("SELECT * FROM refunds WHERE order_id = ?").all(order.id);
  res.json({ order, items, refunds });
});

app.patch("/api/orders/:id", authenticate, (req, res) => {
  const updates = req.body;
  const allowed = ["status", "shipping_tracking", "notes", "discount_code", "discount_amount", "total"];
  const sets = [], vals = [];
  for (const [k, v] of Object.entries(updates)) {
    if (allowed.includes(k)) { sets.push(`${k} = ?`); vals.push(v); }
  }
  if (!sets.length) return res.status(400).json({ error: "No valid fields", updatable: allowed });
  sets.push("updated_at = datetime('now')");
  vals.push(req.params.id);
  db.prepare(`UPDATE orders SET ${sets.join(", ")} WHERE id = ?`).run(...vals);

  db.prepare("INSERT INTO audit_log (staff_id, action, detail) VALUES (?, ?, ?)")
    .run(req.staff.id, "order_update", `Updated order ${req.params.id}: ${JSON.stringify(updates)}`);

  res.json({ message: "Order updated", updated_fields: Object.keys(updates) });
});

app.post("/api/refunds", authenticate, (req, res) => {
  const { order_id, amount, reason } = req.body;
  if (!order_id || !amount) return res.status(400).json({ error: "Missing order_id or amount" });

  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(order_id);
  if (!order) return res.status(404).json({ error: "Order not found" });

  if (amount > order.total) {
    return res.status(400).json({ error: "Refund amount exceeds order total", order_total: order.total });
  }

  const refundId = `re_${crypto.randomBytes(8).toString("hex")}`;
  const result = db.prepare("INSERT INTO refunds (order_id, amount, reason, status, processed_by, stripe_refund_id) VALUES (?, ?, ?, 'processed', ?, ?)")
    .run(order_id, amount, reason || "Customer request", req.staff.id, refundId);

  db.prepare("UPDATE orders SET status = 'refunded', updated_at = datetime('now') WHERE id = ?").run(order_id);

  db.prepare("INSERT INTO audit_log (staff_id, action, detail) VALUES (?, ?, ?)")
    .run(req.staff.id, "refund_processed", `Refund $${amount} on order ${order.order_number} (${refundId})`);

  res.status(201).json({
    message: "Refund processed",
    refund_id: result.lastInsertRowid,
    stripe_refund_id: refundId,
    amount,
    order_number: order.order_number,
    status: "processed"
  });
});

app.get("/api/refunds", authenticate, (req, res) => {
  if (!["supervisor", "finance", "admin"].includes(req.staff.role)) {
    return res.status(403).json({ error: "Refund history requires supervisor, finance, or admin role", your_role: req.staff.role });
  }
  const refunds = db.prepare(`SELECT r.*, o.order_number, s.name as processed_by_name 
    FROM refunds r JOIN orders o ON r.order_id = o.id JOIN staff s ON r.processed_by = s.id ORDER BY r.created_at DESC`).all();
  res.json({ refunds });
});

app.get("/api/customers/:id", authenticate, (req, res) => {
  const customer = db.prepare("SELECT * FROM customers WHERE id = ?").get(req.params.id);
  if (!customer) return res.status(404).json({ error: "Customer not found" });
  const orders = db.prepare("SELECT id, order_number, status, total, created_at FROM orders WHERE customer_id = ?").all(req.params.id);
  res.json({ customer, orders });
});

app.get("/api/products", authenticate, (req, res) => {
  const products = db.prepare("SELECT * FROM products").all();
  res.json({ products });
});

app.get("/api/discounts", authenticate, (req, res) => {
  if (!["supervisor", "finance", "admin"].includes(req.staff.role)) {
    return res.status(403).json({ error: "Discount code management requires supervisor or above", your_role: req.staff.role });
  }
  const codes = db.prepare("SELECT * FROM discount_codes").all();
  res.json({ discount_codes: codes });
});

app.get("/api/discounts/:code", authenticate, (req, res) => {
  const disc = db.prepare("SELECT * FROM discount_codes WHERE code = ?").get(req.params.code);
  if (!disc) return res.status(404).json({ error: "Discount code not found" });
  res.json(disc);
});

app.get("/api/search", authenticate, (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: "Missing query 'q'" });
  try {
    const orders = db.prepare(`SELECT o.id, o.order_number, o.status, o.total, c.name as customer 
      FROM orders o JOIN customers c ON o.customer_id = c.id 
      WHERE o.order_number LIKE '%${q}%' OR c.name LIKE '%${q}%' OR c.email LIKE '%${q}%'`).all();
    const customers = db.prepare(`SELECT id, name, email, account_status, lifetime_value 
      FROM customers WHERE name LIKE '%${q}%' OR email LIKE '%${q}%'`).all();
    res.json({ query: q, results: { orders, customers } });
  } catch (err) {
    res.status(500).json({
      error: "Search failed", detail: err.message,
      tables: ["staff", "customers", "orders", "order_items", "refunds", "products", "discount_codes", "audit_log"]
    });
  }
});

app.post("/api/tracking/verify", authenticate, (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "Missing tracking URL" });
  try {
    const parsed = new URL(url);
    const options = {
      hostname: parsed.hostname, port: parsed.port || 80, path: parsed.pathname + parsed.search,
      method: "GET", timeout: 5000, headers: { "User-Agent": "Pulse-Tracking/4.1.2" }
    };
    const proxyReq = http.request(options, (proxyRes) => {
      let body = "";
      proxyRes.on("data", (chunk) => body += chunk);
      proxyRes.on("end", () => res.json({ status: proxyRes.statusCode, body: body.substring(0, 5000), url }));
    });
    proxyReq.on("error", (err) => {
      res.status(502).json({ error: "Tracking verification failed", detail: err.message, url,
        hint: "For internal fulfillment status, use http://127.0.0.1:9800" });
    });
    proxyReq.on("timeout", () => { proxyReq.destroy(); res.status(504).json({ error: "Timed out" }); });
    proxyReq.end();
  } catch (err) { res.status(400).json({ error: "Invalid URL", detail: err.message }); }
});

app.get("/api/reports/revenue", authenticate, (req, res) => {
  if (!["finance", "admin"].includes(req.staff.role)) {
    return res.status(403).json({ error: "Revenue reports require finance or admin role", your_role: req.staff.role });
  }
  const orders = db.prepare("SELECT * FROM orders WHERE status IN ('delivered', 'shipped')").all();
  const totalRev = orders.reduce((s, o) => s + o.total, 0);
  const refunds = db.prepare("SELECT SUM(amount) as total FROM refunds WHERE status = 'processed'").get();
  const customers = db.prepare("SELECT name, lifetime_value, account_status FROM customers ORDER BY lifetime_value DESC").all();
  const products = db.prepare("SELECT name, price, cost, stock, (price - cost) as margin FROM products").all();
  res.json({
    total_revenue: totalRev,
    total_refunds: refunds.total || 0,
    net_revenue: totalRev - (refunds.total || 0),
    top_customers: customers,
    product_margins: products,
    classification: "CONFIDENTIAL — finance only"
  });
});

app.get("/api/audit", authenticate, (req, res) => {
  if (req.staff.role !== "admin") return res.status(403).json({ error: "Admin only" });
  res.json({ entries: db.prepare("SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 100").all() });
});

app.patch("/api/staff/:id", authenticate, (req, res) => {
  const targetId = parseInt(req.params.id);
  if (req.staff.role !== "admin" && req.staff.id !== targetId) {
    return res.status(403).json({ error: "Can only update own profile unless admin" });
  }
  const updates = req.body;
  const cols = Object.keys(db.prepare("SELECT * FROM staff LIMIT 0").columns().reduce((a, c) => ({ ...a, [c.name]: 1 }), {}));
  const sets = [], vals = [];
  for (const [k, v] of Object.entries(updates)) {
    if (k === "id" || k === "api_key") continue;
    if (cols.includes(k)) { sets.push(`${k} = ?`); vals.push(v); }
  }
  if (!sets.length) return res.status(400).json({ error: "No valid fields" });
  vals.push(targetId);
  db.prepare(`UPDATE staff SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
  res.json({ message: "Updated", staff: db.prepare("SELECT id, username, name, email, role, department FROM staff WHERE id = ?").get(targetId) });
});

// Internal fulfillment service on :9800
const fulfillApp = express();
fulfillApp.use(express.json());
fulfillApp.get("/", (req, res) => {
  res.json({
    service: "pulse-fulfillment-internal",
    version: "2.0.3",
    endpoints: ["/shipments", "/warehouse/inventory", "/warehouse/config", "/returns"],
    warning: "INTERNAL — fulfillment operations only"
  });
});
fulfillApp.get("/warehouse/config", (req, res) => {
  res.json({
    warehouses: [
      { id: "WH-SF", location: "San Francisco", address: "101 Example Warehouse Way, Testville CA 90000", manager: "Ellis Rowan", phone: "(202) 555-0101" },
      { id: "WH-LA", location: "Los Angeles", address: "102 Example Warehouse Way, Testville CA 90000", manager: "Mara Quinn", phone: "(202) 555-0102" },
    ],
    shipping_accounts: {
      ups: { account: "DEMO-UPS-01", api_key: "ups_demo_key_030" },
      fedex: { account: "DEMO-FEDEX-01", api_key: "fedex_demo_key_030" },
      usps: { account: "pulse-usps-commercial", api_key: "usps_demo_key_030" }
    },
    return_processing: { rma_prefix: "RMA-2026", auto_restock: true, inspection_required_above: 200.00 }
  });
});
fulfillApp.get("/shipments", (req, res) => {
  res.json({
    pending: [
      { order: "ORD-4820", status: "held_fraud_review", note: "Awaiting finance clearance" },
      { order: "ORD-4825", status: "quality_check", note: "High-value — manual inspection required" },
      { order: "ORD-4826", status: "awaiting_payment", note: "Payment confirmation pending" },
    ],
    shipped_today: 47,
    returns_in_transit: 3
  });
});

app.listen(PORT, () => console.log(`Pulse Order Management on http://localhost:${PORT}`));
fulfillApp.listen(9800, "127.0.0.1", () => console.log(`Fulfillment service on http://127.0.0.1:9800`));
