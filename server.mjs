/* =====================================================================
   Goal Setting to the Now — SERVER

   Serves the same single-file app that runs from a double-click, and swaps
   only where the data lives: each signed-in user gets ONE document in a
   SQLite database on this PC, instead of that browser's localStorage.
   Goals are private per account — no user can read another's.

   How it fits together:
     public/app.html        the app, byte-identical to the desktop file
                            (a one-line shim reference is injected at serve time)
     public/server-shim.js  defines window.GTN_REMOTE before the app boots
     public/login.html      sign in / sign up
     public/admin.html      user management (administrators only)
     docs table             one row per user: their whole goal state as JSON

   Zero npm dependencies: Node's own http, node:sqlite and node:crypto.
   Start with "START SERVER.cmd" (or: node server.mjs). Full instructions
   in SETUP.md.
   ===================================================================== */
import { createServer } from "node:http";
import { DatabaseSync } from "node:sqlite";
import { randomBytes, pbkdf2Sync, timingSafeEqual } from "node:crypto";
import { readFileSync, existsSync, mkdirSync, copyFileSync, statSync } from "node:fs";
import { join, dirname, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const HERE = dirname(fileURLToPath(import.meta.url));

/* Optional config.json next to this file: { "port": 8484, "openSignup": true } */
let CFG = {};
try { CFG = JSON.parse(readFileSync(join(HERE, "config.json"), "utf8")); } catch { }
const PORT = Number(process.env.PORT || CFG.port || 8484);
const OPEN_SIGNUP = CFG.openSignup !== false;      // default: open; set false to require admin approval

/* The LIVE database sits on local disk, never inside OneDrive/Dropbox: a sync
   client can lock or copy the file mid-write and corrupt it. Dated snapshot
   copies go the other way — into Backups/ beside this file — because a plain
   copy is safe to sync and means a dead PC doesn't take the data with it. */
const DATA = process.env.GTN_DATA || join(homedir(), "GoalSettingData");
const BACKUP2 = process.env.GTN_BACKUP2 || join(HERE, "Backups");
const PUBLIC = join(HERE, "public");
if (!existsSync(DATA)) mkdirSync(DATA, { recursive: true });
const DB_PATH = join(DATA, "goals.db");

/* ---------------------------------------------------------------- db ---- */
const db = new DatabaseSync(DB_PATH);
db.exec(`PRAGMA journal_mode = WAL;`);
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  pw_hash TEXT NOT NULL, pw_salt TEXT NOT NULL, pw_iters INTEGER NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',            -- admin | user
  status TEXT NOT NULL DEFAULT 'active',        -- active | pending | disabled
  created_at TEXT, last_login TEXT);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY, user_id INTEGER NOT NULL,
  created_at TEXT, expires_at TEXT, ip TEXT);

/* One document per user — their entire goal state. rev rises on every
   accepted write, so two tabs saving at once is detected, not silently
   overwritten. */
CREATE TABLE IF NOT EXISTS docs (
  user_id INTEGER PRIMARY KEY, body TEXT NOT NULL,
  rev INTEGER NOT NULL DEFAULT 0, updated_at TEXT);

/* Append-only log of account events. Goal content is deliberately NOT
   audited — these are personal goals, not shared books. */
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL, username TEXT, action TEXT NOT NULL, detail TEXT, ip TEXT);
`);

function dailyBackup() {
  const name = `goals-${new Date().toISOString().slice(0, 10)}.db`;
  for (const dir of [join(DATA, "backups"), BACKUP2]) {
    try {
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      const f = join(dir, name);
      if (!existsSync(f) && existsSync(DB_PATH)) { db.exec("PRAGMA wal_checkpoint(TRUNCATE);"); copyFileSync(DB_PATH, f); }
    } catch (e) { console.error(`backup to ${dir} failed:`, e.message); }
  }
}

/* -------------------------------------------------------------- auth ---- */
const ITERS = 150000;
const hash = (pw, salt) => pbkdf2Sync(pw, salt, ITERS, 32, "sha256").toString("hex");
function verifyPw(pw, user) {
  const a = Buffer.from(hash(pw, user.pw_salt), "hex");
  const b = Buffer.from(user.pw_hash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
const q = {
  userByName: db.prepare(`SELECT * FROM users WHERE username = ?`),
  userById: db.prepare(`SELECT * FROM users WHERE id = ?`),
  countUsers: db.prepare(`SELECT COUNT(*) n FROM users`),
  addUser: db.prepare(`INSERT INTO users (username,display_name,pw_hash,pw_salt,pw_iters,role,status,created_at)
                       VALUES (?,?,?,?,?,?,?,?)`),
  touchLogin: db.prepare(`UPDATE users SET last_login=? WHERE id=?`),
  allUsers: db.prepare(`SELECT u.id,u.username,u.display_name,u.role,u.status,u.created_at,u.last_login,
                        d.updated_at doc_updated, length(d.body) doc_bytes
                        FROM users u LEFT JOIN docs d ON d.user_id = u.id ORDER BY u.created_at`),
  setRole: db.prepare(`UPDATE users SET role=? WHERE id=?`),
  setStatus: db.prepare(`UPDATE users SET status=? WHERE id=?`),
  setPw: db.prepare(`UPDATE users SET pw_hash=?, pw_salt=? WHERE id=?`),
  addSession: db.prepare(`INSERT INTO sessions (token,user_id,created_at,expires_at,ip) VALUES (?,?,?,?,?)`),
  getSession: db.prepare(`SELECT * FROM sessions WHERE token = ?`),
  delSession: db.prepare(`DELETE FROM sessions WHERE token = ?`),
  delUserSessions: db.prepare(`DELETE FROM sessions WHERE user_id = ?`),
  pruneSessions: db.prepare(`DELETE FROM sessions WHERE expires_at < ?`),
  getDoc: db.prepare(`SELECT * FROM docs WHERE user_id = ?`),
  putDoc: db.prepare(`INSERT INTO docs (user_id,body,rev,updated_at) VALUES (?,?,?,?)
                      ON CONFLICT(user_id) DO UPDATE SET body=excluded.body, rev=excluded.rev, updated_at=excluded.updated_at`),
  addEvent: db.prepare(`INSERT INTO events (ts,username,action,detail,ip) VALUES (?,?,?,?,?)`),
};
const logEvent = (username, action, detail, ip) =>
  q.addEvent.run(new Date().toISOString(), username ?? null, action, detail ?? null, ip ?? null);

/* Failed sign-ins are throttled per username+address: 10 misses locks that
   pair out for 10 minutes. In-memory on purpose — restarts clear it. */
const fails = new Map();
const failKey = (name, ip) => name + "|" + ip;
function tooManyFails(name, ip) {
  const f = fails.get(failKey(name, ip));
  return f && f.n >= 10 && Date.now() - f.t < 600e3;
}
function noteFail(name, ip) {
  const k = failKey(name, ip), f = fails.get(k) || { n: 0, t: 0 };
  f.n = Date.now() - f.t < 600e3 ? f.n + 1 : 1; f.t = Date.now(); fails.set(k, f);
}

/* --------------------------------------------------------- http layer --- */
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css",
  ".json": "application/json", ".ico": "image/x-icon", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2" };
const json = (res, code, obj) => { const b = Buffer.from(JSON.stringify(obj));
  res.writeHead(code, { "content-type": "application/json", "content-length": b.length, "cache-control": "no-store" }); res.end(b); };
const readBody = req => new Promise((resolve, reject) => { let d = "";
  req.on("data", c => { d += c; if (d.length > 5e6) req.destroy(); });          // a goal doc is a few KB; 5MB is generous
  req.on("end", () => { try { resolve(d ? JSON.parse(d) : {}); } catch (e) { reject(e); } }); req.on("error", reject); });
const cookies = req => Object.fromEntries((req.headers.cookie || "").split(";").map(s => s.trim().split("=")).filter(a => a[0]));
const ipOf = req => (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").toString();

function currentUser(req) {
  const t = cookies(req).gtn_session; if (!t) return null;
  const s = q.getSession.get(t); if (!s) return null;
  if (new Date(s.expires_at) < new Date()) { q.delSession.run(t); return null; }
  const u = q.userById.get(s.user_id);
  if (!u || u.status !== "active") return null;
  return u;
}

/* The app is served as-is; the shim reference is injected at serve time so
   the copy on disk stays identical to the desktop file. It goes into <head>,
   BEFORE the app's own script, because the app checks window.GTN_REMOTE at
   boot. */
/* Top-level module tabs (Goal Setting | French IPA), added at serve time so the pages themselves stay untouched. */
const MODULE_CSS = `<style>
#modtabs{position:sticky;top:0;z-index:1000;display:flex;gap:4px;align-items:flex-end;height:40px;box-sizing:border-box;padding:4px 14px 0;background:#10182b;font:600 14px/20px system-ui,-apple-system,"Segoe UI",sans-serif}
#modtabs a{padding:8px 18px;border-radius:8px 8px 0 0;color:#c9d2ea;text-decoration:none;background:#1b2542}
#modtabs a.on{background:#fff;color:#10182b;cursor:default}
#modtabs a:not(.on):hover{background:#27345c;color:#fff}
#modbuild{margin-left:auto;align-self:center;color:#6f7fa8;font:500 11px system-ui,sans-serif}
@media print{#modtabs{display:none}}
</style>`;
const moduleBar = active => MODULE_CSS + (active === "goal" ? "<style>header{top:40px !important}@media print{header{top:0 !important}}</style>" : "") + `<nav id="modtabs">`
  + `<a href="/"${active === "goal" ? ' class="on"' : ""}>Goal Setting</a>`
  + `<a href="/french-ipa.html"${active === "french" ? ' class="on"' : ""}>French</a><span id="modbuild">build 10-10-k</span></nav>\n`;
function withModuleBar(html, active) {
  const m = /<body[^>]*>/i.exec(html);
  return m ? html.slice(0, m.index + m[0].length) + "\n" + moduleBar(active) + html.slice(m.index + m[0].length)
           : moduleBar(active) + html;
}

const SHIM_TAG = `<script src="/server-shim.js"></script>\n`;
function serveApp(res) {
  const f = join(PUBLIC, "app.html");
  if (!existsSync(f)) { res.writeHead(500).end("app.html is missing — run: node update-app.mjs"); return; }
  let html = readFileSync(f, "utf8");
  const i = html.indexOf("</head>");
  html = i >= 0 ? html.slice(0, i) + SHIM_TAG + html.slice(i) : SHIM_TAG + html;
  html = withModuleBar(html, "goal");
  const b = Buffer.from(html);
  res.writeHead(200, { "content-type": MIME[".html"], "content-length": b.length, "cache-control": "no-store" });
  res.end(b);
}

/* A saved document must at least look like the app's state. */
const looksLikeState = s => s && typeof s === "object" && Array.isArray(s.domains) && s.domains.length > 0;

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  const p = decodeURIComponent(url.pathname);
  try {
    const u = currentUser(req);
    const ip = ipOf(req);

    /* ---- pages ---- */
    if (!p.startsWith("/api/")) {
      if (p === "/" || p === "/app.html") {
        if (!u) { res.writeHead(302, { location: "/login.html" }); res.end(); return; }
        return serveApp(res);
      }
      const rel = p.replace(/^\/+/, "");
      const file = join(PUBLIC, rel);
      if (!file.startsWith(PUBLIC + sep) || !existsSync(file) || statSync(file).isDirectory()) { res.writeHead(404).end("Not found"); return; }
      const isFont = rel.startsWith("fonts/") && extname(file) === ".woff2";   // public, cacheable
      if (rel !== "login.html" && rel !== "server-shim.js" && rel !== "french-ipa.html" && !isFont && !u) { res.writeHead(302, { location: "/login.html" }); res.end(); return; }
      let b = readFileSync(file);
      if (rel === "french-ipa.html") b = Buffer.from(withModuleBar(b.toString("utf8"), "french"));
      res.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream", "cache-control": isFont ? "public, max-age=31536000, immutable" : "no-store" });
      res.end(b); return;
    }

    /* ---- auth ---- */
    if (p === "/api/signup" && req.method === "POST") {
      const b = await readBody(req);
      const name = String(b.username || "").trim().toLowerCase();
      if (!/^[a-z0-9._-]{3,32}$/.test(name)) return json(res, 400, { error: "Username: 3–32 characters, letters/numbers/._- only." });
      if (!b.displayName || String(b.displayName).trim().length < 2) return json(res, 400, { error: "Enter your name." });
      if (String(b.password || "").length < 10) return json(res, 400, { error: "Password must be at least 10 characters." });
      if (q.userByName.get(name)) return json(res, 409, { error: "That username is taken." });
      const first = q.countUsers.get().n === 0;
      const salt = randomBytes(16).toString("hex");
      const status = first || OPEN_SIGNUP ? "active" : "pending";
      q.addUser.run(name, String(b.displayName).trim(), hash(b.password, salt), salt, ITERS,
        first ? "admin" : "user", status, new Date().toISOString());
      logEvent(name, "signup", first ? "first user — administrator" : status, ip);
      return json(res, 200, { ok: true, accountStatus: status,
        message: first ? "Account created — you are the administrator."
          : status === "active" ? "Account created — sign in."
          : "Account created. An administrator must approve it before you can sign in." });
    }
    if (p === "/api/login" && req.method === "POST") {
      const b = await readBody(req);
      const name = String(b.username || "").trim().toLowerCase();
      if (tooManyFails(name, ip)) return json(res, 429, { error: "Too many attempts — wait 10 minutes and try again." });
      const user = q.userByName.get(name);
      if (!user || !verifyPw(String(b.password || ""), user)) {
        noteFail(name, ip); logEvent(name, "login_failed", null, ip);
        return json(res, 401, { error: "Wrong username or password." });
      }
      if (user.status === "pending") return json(res, 403, { error: "Your account is waiting for administrator approval." });
      if (user.status === "disabled") return json(res, 403, { error: "This account has been disabled." });
      const token = randomBytes(32).toString("hex");
      const days = b.remember ? 30 : 0.5;
      q.addSession.run(token, user.id, new Date().toISOString(), new Date(Date.now() + days * 86400e3).toISOString(), ip);
      q.touchLogin.run(new Date().toISOString(), user.id);
      logEvent(user.username, "login", null, ip);
      res.setHeader("set-cookie", `gtn_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${Math.round(days * 86400)}`);
      return json(res, 200, { ok: true });
    }
    if (p === "/api/logout" && req.method === "POST") {
      const t = cookies(req).gtn_session; if (t) q.delSession.run(t);
      if (u) logEvent(u.username, "logout", null, ip);
      res.setHeader("set-cookie", "gtn_session=; HttpOnly; Path=/; Max-Age=0");
      return json(res, 200, { ok: true });
    }
    if (p === "/api/health") return json(res, 200, { ok: true, users: q.countUsers.get().n });

    if (!u) return json(res, 401, { error: "Please sign in." });

    if (p === "/api/me") return json(res, 200, { user: { id: u.id, username: u.username, displayName: u.display_name, role: u.role } });

    /* ---- the signed-in user's own document ---- */
    if (p === "/api/state") {
      if (req.method === "GET") {
        const row = q.getDoc.get(u.id);
        return json(res, 200, { state: row ? JSON.parse(row.body) : null, rev: row ? row.rev : 0,
          user: { username: u.username, displayName: u.display_name, role: u.role } });
      }
      if (req.method === "PUT") {
        const b = await readBody(req);
        if (!looksLikeState(b.state)) return json(res, 400, { error: "That does not look like goal data — nothing was saved." });
        const row = q.getDoc.get(u.id);
        const haveRev = row ? row.rev : 0;
        if (Number(b.rev) !== haveRev)
          return json(res, 409, { error: "Your goals changed in another window. Reload to get the latest.", rev: haveRev });
        const nextRev = haveRev + 1;
        q.putDoc.run(u.id, JSON.stringify(b.state), nextRev, new Date().toISOString());
        dailyBackup();
        return json(res, 200, { ok: true, rev: nextRev });
      }
    }

    /* ---- administration ---- */
    if (u.role !== "admin") return json(res, 403, { error: "Administrators only." });

    if (p === "/api/users" && req.method === "GET")
      return json(res, 200, { users: q.allUsers.all(), openSignup: OPEN_SIGNUP });

    if (p === "/api/admin/user" && req.method === "POST") {
      const b = await readBody(req);
      const target = q.userById.get(Number(b.id));
      if (!target) return json(res, 404, { error: "No such user." });
      const self = target.id === u.id;
      if (b.action === "disable") {
        if (self) return json(res, 400, { error: "You cannot disable your own account." });
        q.setStatus.run("disabled", target.id); q.delUserSessions.run(target.id);
        logEvent(u.username, "admin", `disabled ${target.username}`, ip);
        return json(res, 200, { ok: true });
      }
      if (b.action === "enable") {
        q.setStatus.run("active", target.id);
        logEvent(u.username, "admin", `enabled/approved ${target.username}`, ip);
        return json(res, 200, { ok: true });
      }
      if (b.action === "role") {
        if (self) return json(res, 400, { error: "You cannot change your own role." });
        const role = b.role === "admin" ? "admin" : "user";
        q.setRole.run(role, target.id);
        logEvent(u.username, "admin", `made ${target.username} ${role}`, ip);
        return json(res, 200, { ok: true });
      }
      if (b.action === "resetpw") {
        if (String(b.password || "").length < 10) return json(res, 400, { error: "Password must be at least 10 characters." });
        const salt = randomBytes(16).toString("hex");
        q.setPw.run(hash(String(b.password), salt), salt, target.id);
        q.delUserSessions.run(target.id);
        logEvent(u.username, "admin", `reset password for ${target.username}`, ip);
        return json(res, 200, { ok: true });
      }
      return json(res, 400, { error: "Unknown action." });
    }

    return json(res, 404, { error: "Unknown endpoint." });
  } catch (e) {
    console.error(e);
    return json(res, 500, { error: "Server error: " + e.message });
  }
});

q.pruneSessions.run(new Date().toISOString());
dailyBackup();
server.listen(PORT, () => {
  console.log(`Goal Setting to the Now — server`);
  console.log(`  On this PC:      http://localhost:${PORT}`);
  console.log(`  On the network:  http://<this-pc-name>:${PORT}   (needs the firewall rule — see SETUP.md)`);
  console.log(`  Database:        ${DB_PATH}`);
  console.log(`  Sign-up:         ${OPEN_SIGNUP ? "open — anyone who can reach this address" : "admin approval required"}`);
});
