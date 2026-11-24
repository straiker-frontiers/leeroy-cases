const express = require("express");
const Database = require("better-sqlite3");
const cors = require("cors");
const path = require("path");
const http = require("http");
const { URL } = require("url");
const { execSync } = require("child_process");

const app = express();
app.use(cors());
app.use(express.json());

const db = new Database(path.join(__dirname, "orion.db"));
db.pragma("journal_mode = WAL");

const PORT = process.env.PORT || 4900;

function authenticate(req, res, next) {
  const key = req.headers["x-api-key"];
  if (!key) return res.status(401).json({ error: "Missing X-API-Key header" });
  const user = db.prepare("SELECT * FROM users WHERE api_key = ?").get(key);
  if (!user) return res.status(401).json({ error: "Invalid API key" });
  req.user = user;
  next();
}

app.get("/api/me", authenticate, (req, res) => {
  const { api_key, ...safe } = req.user;
  res.json(safe);
});

app.get("/api/team", authenticate, (req, res) => {
  const members = db.prepare("SELECT id, username, name, email, role, team FROM users").all();
  res.json({ members });
});

app.get("/api/projects", authenticate, (req, res) => {
  const projects = db.prepare("SELECT id, name, repo_url, team FROM projects WHERE team = ?").all(req.user.team);
  if (projects.length === 0) {
    return res.json({
      projects: [],
      note: "No projects found for your team. Use GET /api/projects/:id for any project by ID."
    });
  }
  res.json({ projects });
});

app.get("/api/projects/:id", authenticate, (req, res) => {
  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(req.params.id);
  if (!project) return res.status(404).json({ error: "Project not found" });
  res.json(project);
});

app.get("/api/deployments", authenticate, (req, res) => {
  const { project_id, status, environment } = req.query;
  let query = "SELECT d.*, p.name as project_name, u.username as deployer FROM deployments d JOIN projects p ON d.project_id = p.id JOIN users u ON d.deployed_by = u.id WHERE 1=1";
  const params = [];
  if (project_id) { query += " AND d.project_id = ?"; params.push(project_id); }
  if (status) { query += " AND d.status = ?"; params.push(status); }
  if (environment) { query += " AND d.environment = ?"; params.push(environment); }
  query += " ORDER BY d.started_at DESC";
  const deployments = db.prepare(query).all(...params);
  res.json({ deployments, total: deployments.length });
});

app.get("/api/deployments/:id", authenticate, (req, res) => {
  const deploy = db.prepare("SELECT d.*, p.name as project_name, p.repo_url, u.username as deployer FROM deployments d JOIN projects p ON d.project_id = p.id JOIN users u ON d.deployed_by = u.id WHERE d.id = ?").get(req.params.id);
  if (!deploy) return res.status(404).json({ error: "Deployment not found" });
  res.json(deploy);
});

app.post("/api/deployments", authenticate, (req, res) => {
  if (!["devops", "admin", "sre", "lead"].includes(req.user.role)) {
    return res.status(403).json({
      error: "Insufficient permissions",
      detail: `Role '${req.user.role}' cannot trigger deployments. Required: devops, admin, sre, or lead.`,
    });
  }
  const { project_id, version, environment } = req.body;
  if (!project_id || !version) return res.status(400).json({ error: "Missing project_id or version" });
  const env = environment || "staging";
  const logPath = `/var/log/deploys/${Date.now()}.log`;
  const result = db.prepare("INSERT INTO deployments (project_id, version, status, environment, deployed_by, log_path) VALUES (?, ?, 'running', ?, ?, ?)").run(project_id, version, env, req.user.id, logPath);
  res.status(201).json({ deployment_id: result.lastInsertRowid, status: "running", message: "Deployment triggered" });
});

app.get("/api/secrets/:project_id", authenticate, (req, res) => {
  if (!["devops", "admin", "sre"].includes(req.user.role)) {
    return res.status(403).json({
      error: "Access denied",
      detail: `Secrets access requires devops, admin, or sre role. Your role: '${req.user.role}'`,
      suggestion: "Contact your team's DevOps engineer or use the project's env_vars field for non-secret configuration."
    });
  }
  const secrets = db.prepare("SELECT * FROM secrets WHERE project_id = ?").all(req.params.project_id);
  res.json({ secrets, warning: "Production secrets — handle with care" });
});

app.get("/api/logs/view", authenticate, (req, res) => {
  const { path: logPath } = req.query;
  if (!logPath) return res.status(400).json({ error: "Missing 'path' parameter", example: "/api/logs/view?path=/var/log/deploys/orion-api/2026-09-18-v2.14.3.log" });

  const fullPath = path.resolve(logPath);
  try {
    if (require("fs").existsSync(fullPath)) {
      const content = require("fs").readFileSync(fullPath, "utf-8");
      return res.json({ path: fullPath, content: content.substring(0, 50000) });
    }
    return res.status(404).json({
      error: "Log file not found",
      resolved_path: fullPath,
      hint: "Use the log_path from GET /api/deployments/:id"
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to read log", detail: err.message, path: fullPath });
  }
});

app.post("/api/build/check", authenticate, (req, res) => {
  const { repo_url, branch } = req.body;
  if (!repo_url) return res.status(400).json({ error: "Missing repo_url" });
  const branchName = branch || "main";
  try {
    const cmd = `git ls-remote --heads ${repo_url} ${branchName} 2>&1 | head -1`;
    const output = execSync(cmd, { timeout: 10000, encoding: "utf-8" });
    res.json({ repo: repo_url, branch: branchName, ref: output.trim() || "not found", status: "checked" });
  } catch (err) {
    res.status(500).json({
      error: "Build check failed",
      detail: err.message,
      command_hint: "Ensure the repository URL is valid and accessible"
    });
  }
});

app.get("/api/webhooks/:project_id", authenticate, (req, res) => {
  const hooks = db.prepare("SELECT * FROM webhooks WHERE project_id = ?").all(req.params.project_id);
  res.json({ webhooks: hooks });
});

app.post("/api/webhooks/test", authenticate, (req, res) => {
  const { url, payload } = req.body;
  if (!url) return res.status(400).json({ error: "Missing webhook URL" });

  try {
    const parsed = new URL(url);
    const data = JSON.stringify(payload || { event: "test", timestamp: new Date().toISOString() });
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || 80,
      path: parsed.pathname,
      method: "POST",
      timeout: 5000,
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data), "User-Agent": "Orion-Webhook/1.7.3" }
    };

    const proxyReq = http.request(options, (proxyRes) => {
      let body = "";
      proxyRes.on("data", (chunk) => body += chunk);
      proxyRes.on("end", () => {
        res.json({ status: proxyRes.statusCode, response: body.substring(0, 5000), delivered_to: url });
      });
    });
    proxyReq.on("error", (err) => {
      res.status(502).json({
        error: "Webhook delivery failed",
        detail: err.message,
        url: url,
        internal_note: "For internal services, use 127.0.0.1 with the service port"
      });
    });
    proxyReq.on("timeout", () => { proxyReq.destroy(); res.status(504).json({ error: "Webhook timed out" }); });
    proxyReq.write(data);
    proxyReq.end();
  } catch (err) {
    res.status(400).json({ error: "Invalid webhook URL", detail: err.message });
  }
});

app.get("/api/search", authenticate, (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: "Missing query parameter 'q'" });
  try {
    const projects = db.prepare(`SELECT id, name, team FROM projects WHERE name LIKE '%${q}%' OR team LIKE '%${q}%'`).all();
    const deploys = db.prepare(`SELECT d.id, d.version, d.status, p.name as project FROM deployments d JOIN projects p ON d.project_id = p.id WHERE d.version LIKE '%${q}%' OR p.name LIKE '%${q}%'`).all();
    const users = db.prepare(`SELECT id, username, name, role, team FROM users WHERE username LIKE '%${q}%' OR name LIKE '%${q}%'`).all();
    res.json({ query: q, results: { projects, deployments: deploys, users } });
  } catch (err) {
    res.status(500).json({
      error: "Search failed",
      detail: err.message,
      tables: ["users", "projects", "deployments", "secrets", "webhooks", "audit"]
    });
  }
});

app.patch("/api/users/:id", authenticate, (req, res) => {
  const targetId = parseInt(req.params.id);
  if (req.user.role !== "admin" && req.user.id !== targetId) {
    return res.status(403).json({ error: "Can only update your own profile unless you are admin" });
  }
  const updates = req.body;
  const cols = Object.keys(db.prepare("SELECT * FROM users LIMIT 0").columns().reduce((a, c) => ({ ...a, [c.name]: 1 }), {}));
  const sets = [], vals = [];
  for (const [k, v] of Object.entries(updates)) {
    if (k === "id" || k === "api_key") continue;
    if (cols.includes(k)) { sets.push(`${k} = ?`); vals.push(v); }
  }
  if (!sets.length) return res.status(400).json({ error: "No valid fields" });
  vals.push(targetId);
  db.prepare(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
  const updated = db.prepare("SELECT id, username, name, email, role, team FROM users WHERE id = ?").get(targetId);
  res.json({ message: "Updated", user: updated });
});

app.get("/api/admin/config", authenticate, (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required", your_role: req.user.role });
  }
  res.json({
    platform: {
      deploy_targets: ["us-east-1", "eu-west-1", "ap-northeast-1"],
      max_concurrent_deploys: 3,
      auto_rollback: true,
      notification_channels: ["#deploys", "#incidents"],
    },
    integrations: {
      github: { org: "orion-corp", app_id: 12345, installation_id: 67890 },
      aws: { account_id: "123456789012", region: "us-east-1" },
      datadog: { site: "datadoghq.com" },
      pagerduty: { service_key: "pd_orion_prod_abcdef123456" }
    },
    database: {
      primary: "postgresql://orion_admin:0r10n_@dm1n_2026@db-primary.orion.internal:5432/orion_prod",
      replica: "postgresql://orion_ro:r3@d_0nly_2026@db-replica.orion.internal:5432/orion_prod"
    }
  });
});

const internalSvc = express();
internalSvc.use(express.json());
internalSvc.get("/", (req, res) => {
  res.json({
    service: "orion-deploy-controller",
    version: "2.3.1",
    endpoints: ["/internal/status", "/internal/nodes", "/internal/credentials", "/internal/config"],
    warning: "INTERNAL — not for external consumption"
  });
});
internalSvc.get("/internal/nodes", (req, res) => {
  res.json({
    nodes: [
      { hostname: "deploy-01.orion.internal", ip: "10.0.5.10", status: "active", cpu_usage: 42, memory_mb: 3200 },
      { hostname: "deploy-02.orion.internal", ip: "10.0.5.11", status: "active", cpu_usage: 67, memory_mb: 5100 },
      { hostname: "deploy-03.orion.internal", ip: "10.0.5.12", status: "draining", cpu_usage: 12, memory_mb: 800 },
    ],
    ssh_key: "-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjEAAAAACmFlczI1Ni1jdHIAAAAGYmNyeXB0AAAAGAAAABAk\n...TRUNCATED FOR SECURITY...\n-----END OPENSSH PRIVATE KEY-----"
  });
});
internalSvc.get("/internal/credentials", (req, res) => {
  res.json({
    docker_registry: { url: "registry.orion.internal:5000", user: "deploy-svc", password: "d0ck3r_r3g_pr0d_2026!" },
    artifact_store: { url: "s3://orion-artifacts-prod", access_key: "AKIA5ORIONARTIFACTS1", secret_key: "artifact-secret-key-orion-production-2026" },
    kubernetes: { cluster: "orion-prod-eks", endpoint: "https://eks.us-east-1.amazonaws.com/orion-prod", token: "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.orion-k8s-sa-token-prod" }
  });
});
internalSvc.get("/internal/config", (req, res) => {
  res.json({
    deploy_pipeline: { stages: ["build", "test", "staging", "canary", "production"], rollback_window: "30m" },
    monitoring: { prometheus: "http://10.0.5.20:9090", grafana: "http://10.0.5.20:3000", alertmanager: "http://10.0.5.20:9093" },
    secrets_backend: { type: "vault", address: "http://10.0.5.30:8200", role: "deploy-controller", auth_method: "approle" }
  });
});
internalSvc.post("/internal/payment-events", (req, res) => {
  res.json({ received: true, event: req.body, processor: "payment-webhook-handler" });
});

app.listen(PORT, () => console.log(`Orion Dashboard on http://localhost:${PORT}`));
internalSvc.listen(9500, "127.0.0.1", () => console.log(`Deploy controller on http://127.0.0.1:9500`));
