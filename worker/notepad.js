// Notepad guestbook API for kreth.work.
//   GET    /api/notepad/pages?cursor=<id>&limit=<n>&order=asc|desc
//   POST   /api/notepad/pages            (JSON body, see validatePage)
//   DELETE /api/notepad/pages/:id        (Authorization: Bearer <NOTEPAD_ADMIN_TOKEN>)
//   GET    /notepad-admin                (static admin page, noindex)
//
// Bindings: env.NOTEPAD_DB (D1, required)
//           env.NOTEPAD_ADMIN_TOKEN (secret; DELETE disabled when unset)
//           env.NOTEPAD_IP_SALT (secret; falls back to a fixed dev salt only on localhost)
//           env.NOTEPAD_BURST (optional Workers rate limiting binding, burst guard)
//           env.TURNSTILE_SECRET (optional; when set, POST requires body.turnstile)

export const LIMITS = {
  maxBodyBytes: 64 * 1024,
  maxStrokes: 300,
  maxPointsPerStroke: 1500,
  maxPointsTotal: 8000,
  minInkLength: 0.06,        // in page widths; rejects dots / empty sheets
  perIp10Min: 3,
  perIpDay: 20,
  globalDay: 400,
  pageSizeDefault: 20,
  pageSizeMax: 50,
};
const COLORS = new Set(["navy", "pencil", "pink"]);
const COORD_MAX = 10000;     // x, y are ints in [0, 10000 * aspect]
const ASPECT_MIN = 0.5, ASPECT_MAX = 2;

const json = (body, status = 200, extra = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extra },
  });

export async function handleNotepad(request, env, ctx) {
  const url = new URL(request.url);
  const { pathname } = url;

  if (pathname === "/notepad-admin" || pathname === "/notepad-admin/") {
    return null; // let the static asset serve; caller adds noindex (see withNoindex)
  }
  if (!pathname.startsWith("/api/notepad/")) return null;
  if (!env.NOTEPAD_DB) return json({ error: "notepad storage not configured" }, 503);

  if (pathname === "/api/notepad/pages") {
    if (request.method === "GET" || request.method === "HEAD") return listPages(url, env);
    if (request.method === "POST") return createPage(request, env, url);
    return json({ error: "method not allowed" }, 405, { Allow: "GET, POST" });
  }
  const m = pathname.match(/^\/api\/notepad\/pages\/(\d{1,12})$/);
  if (m) {
    if (request.method === "DELETE") return deletePage(request, env, Number(m[1]));
    return json({ error: "method not allowed" }, 405, { Allow: "DELETE" });
  }
  return json({ error: "not found" }, 404);
}

export function withNoindex(res) {
  const out = new Response(res.body, res);
  out.headers.set("X-Robots-Tag", "noindex, nofollow");
  out.headers.set("Cache-Control", "no-store");
  return out;
}

// ---------- GET ----------
async function listPages(url, env) {
  const order = url.searchParams.get("order") === "desc" ? "desc" : "asc";
  let limit = parseInt(url.searchParams.get("limit") || "", 10);
  if (!Number.isFinite(limit) || limit < 1) limit = LIMITS.pageSizeDefault;
  limit = Math.min(limit, LIMITS.pageSizeMax);
  const cursor = parseInt(url.searchParams.get("cursor") || "", 10);
  const hasCursor = Number.isFinite(cursor) && cursor > 0;
  const where = hasCursor ? (order === "asc" ? "WHERE id > ?1" : "WHERE id < ?1") : "";
  const sql = `SELECT id, created_at, data FROM notepad_pages ${where} ORDER BY id ${order.toUpperCase()} LIMIT ${limit + 1}`;
  const stmt = hasCursor ? env.NOTEPAD_DB.prepare(sql).bind(cursor) : env.NOTEPAD_DB.prepare(sql);
  const [rows, count] = await env.NOTEPAD_DB.batch([
    stmt,
    env.NOTEPAD_DB.prepare("SELECT COUNT(*) AS n FROM notepad_pages"),
  ]);
  const list = rows.results.slice(0, limit).map(rowToPage);
  const next = rows.results.length > limit ? list[list.length - 1].id : null;
  return json(
    { pages: list, total: count.results[0].n, next_cursor: next },
    200,
    { "Cache-Control": "public, max-age=10" }
  );
}

const rowToPage = (r) => ({ id: r.id, created_at: r.created_at, data: JSON.parse(r.data) });

// ---------- POST ----------
async function createPage(request, env, url) {
  // same-origin only (blocks drive-by posting from other sites; curl can still post, the rate limit covers that)
  const origin = request.headers.get("Origin");
  if (origin && new URL(origin).host !== url.host) return json({ error: "cross-origin posts are not allowed" }, 403);
  const ct = request.headers.get("Content-Type") || "";
  if (!ct.toLowerCase().startsWith("application/json")) return json({ error: "expected application/json" }, 415);
  const len = Number(request.headers.get("Content-Length") || 0);
  if (len > LIMITS.maxBodyBytes) return json({ error: "page too large" }, 413);
  const text = await request.text();
  if (text.length > LIMITS.maxBodyBytes) return json({ error: "page too large" }, 413);

  let body;
  try { body = JSON.parse(text); } catch { return json({ error: "invalid JSON" }, 400); }

  const checked = validatePage(body);
  if (!checked.ok) return json({ error: checked.error }, checked.status || 400);

  const ip = request.headers.get("CF-Connecting-IP") || "0.0.0.0";
  const isLocal = ["localhost", "127.0.0.1"].includes(url.hostname);
  const salt = env.NOTEPAD_IP_SALT || (isLocal ? "local-dev-salt" : null);
  if (!salt) return json({ error: "notepad not configured (salt)" }, 503);

  if (env.TURNSTILE_SECRET) {
    const ok = await verifyTurnstile(env.TURNSTILE_SECRET, body.turnstile, ip);
    if (!ok) return json({ error: "verification failed" }, 403);
  }

  if (env.NOTEPAD_BURST) {
    const { success } = await env.NOTEPAD_BURST.limit({ key: ip });
    if (!success) return json({ error: "slow down" }, 429, { "Retry-After": "60" });
  }

  const now = Date.now();
  const ipHash = await sha256Hex(`${salt}|${new Date(now).toISOString().slice(0, 10)}|${ip}`);
  const dayStart = now - 24 * 60 * 60 * 1000;
  const [r10, rDay, rGlobal] = await env.NOTEPAD_DB.batch([
    env.NOTEPAD_DB.prepare("SELECT COUNT(*) AS n, MIN(created_at) AS first FROM notepad_pages WHERE ip_hash = ?1 AND created_at > ?2").bind(ipHash, now - 10 * 60 * 1000),
    env.NOTEPAD_DB.prepare("SELECT COUNT(*) AS n FROM notepad_pages WHERE ip_hash = ?1 AND created_at > ?2").bind(ipHash, dayStart),
    env.NOTEPAD_DB.prepare("SELECT COUNT(*) AS n FROM notepad_pages WHERE created_at > ?1").bind(dayStart),
  ]);
  if (r10.results[0].n >= LIMITS.perIp10Min) {
    const retry = Math.max(1, Math.ceil((r10.results[0].first + 10 * 60 * 1000 - now) / 1000));
    return json({ error: "rate limited", scope: "10min", retry_after: retry }, 429, { "Retry-After": String(retry) });
  }
  if (rDay.results[0].n >= LIMITS.perIpDay) return json({ error: "rate limited", scope: "day" }, 429, { "Retry-After": "3600" });
  if (rGlobal.results[0].n >= LIMITS.globalDay) return json({ error: "the pad is full for today" }, 429, { "Retry-After": "3600" });

  const data = JSON.stringify(checked.page);
  const res = await env.NOTEPAD_DB
    .prepare("INSERT INTO notepad_pages (created_at, ip_hash, point_count, data) VALUES (?1, ?2, ?3, ?4) RETURNING id, created_at, data")
    .bind(now, ipHash, checked.points, data)
    .first();
  return json({ page: rowToPage(res) }, 201);
}

export function validatePage(body) {
  const bad = (error, status = 400) => ({ ok: false, error, status });
  if (!body || typeof body !== "object" || Array.isArray(body)) return bad("body must be an object");
  if (body.v !== 1) return bad("unsupported version");
  const aspect = body.aspect;
  if (typeof aspect !== "number" || !(aspect >= ASPECT_MIN && aspect <= ASPECT_MAX)) return bad("bad aspect");
  const strokes = body.strokes;
  if (!Array.isArray(strokes) || strokes.length === 0) return bad("page is empty", 422);
  if (strokes.length > LIMITS.maxStrokes) return bad("too many strokes", 413);
  const yMax = Math.round(COORD_MAX * aspect);
  let total = 0, ink = 0;
  const out = [];
  for (const s of strokes) {
    if (!s || typeof s !== "object" || Array.isArray(s)) return bad("bad stroke");
    if (!COLORS.has(s.c)) return bad("bad colour");
    if (!Number.isInteger(s.w) || s.w < 2 || s.w > 30) return bad("bad width");
    if (!Array.isArray(s.p) || s.p.length < 1) return bad("bad points");
    if (s.p.length > LIMITS.maxPointsPerStroke) return bad("stroke too long", 413);
    total += s.p.length;
    if (total > LIMITS.maxPointsTotal) return bad("too many points", 413);
    const pts = [];
    let px = null, py = null;
    for (const p of s.p) {
      if (!Array.isArray(p) || p.length !== 3) return bad("bad point");
      const [x, y, pr] = p;
      if (!Number.isInteger(x) || !Number.isInteger(y) || !Number.isInteger(pr)) return bad("bad point");
      if (x < 0 || x > COORD_MAX || y < 0 || y > yMax || pr < 0 || pr > 100) return bad("point out of range");
      if (px !== null) ink += Math.hypot(x - px, y - py) / COORD_MAX;
      px = x; py = y;
      pts.push([x, y, pr]);
    }
    out.push({ c: s.c, w: s.w, p: pts });
  }
  if (ink < LIMITS.minInkLength) return bad("page is empty", 422);
  return { ok: true, page: { v: 1, aspect: Math.round(aspect * 1000) / 1000, strokes: out }, points: total };
}

// ---------- DELETE ----------
async function deletePage(request, env, id) {
  if (!env.NOTEPAD_ADMIN_TOKEN) return json({ error: "admin disabled" }, 503);
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!(await safeEqual(token, env.NOTEPAD_ADMIN_TOKEN))) return json({ error: "unauthorized" }, 401);
  const res = await env.NOTEPAD_DB.prepare("DELETE FROM notepad_pages WHERE id = ?1").bind(id).run();
  if (!res.meta || res.meta.changes === 0) return json({ error: "not found" }, 404);
  return json({ deleted: id });
}

// ---------- helpers ----------
async function sha256Hex(s) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function safeEqual(a, b) {
  // hash both sides so the comparison is constant-length, then compare without early exit
  const [ha, hb] = await Promise.all([sha256Hex(`cmp|${a}`), sha256Hex(`cmp|${b}`)]);
  let diff = 0;
  for (let i = 0; i < ha.length; i++) diff |= ha.charCodeAt(i) ^ hb.charCodeAt(i);
  return diff === 0 && a.length > 0;
}

async function verifyTurnstile(secret, token, ip) {
  if (typeof token !== "string" || !token) return false;
  const form = new FormData();
  form.append("secret", secret);
  form.append("response", token);
  form.append("remoteip", ip);
  const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form });
  const j = await r.json().catch(() => ({}));
  return j.success === true;
}
