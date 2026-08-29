// Local authoring server for kreth.work notes.
//
//   node scripts/edit-server.mjs        (default port 3030)
//
// Serves the static site like `python3 -m http.server`, but additionally:
//   1. Injects /editor.css + /editor.js + /editor-books.js into every HTML
//      response, so article pages get the Notion-style editing overlay and
//      book pages get Admin Access. Files on disk never reference the
//      editor — the deployed site stays untouched.
//   2. POST /api/save — writes edited article content back into the real
//      notes/<slug>/index.html file.
//   3. POST /api/save-book — updates data/books.json and regenerates the
//      book's index.html via the shared render lib.

import { createServer } from "node:http";
import { readFile, writeFile, stat } from "node:fs/promises";
import { resolve, join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  STATUS,
  VERDICT,
  READ_TYPE,
  loadCollections,
  loadBooksMeta,
  saveBooksMeta,
  writeBookPage,
} from "./book-page-lib.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = parseInt(process.env.PORT || "3030", 10);
const MAX_BODY = 5 * 1024 * 1024;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

const INJECT =
  '\n<link rel="stylesheet" href="/editor.css" />\n<script src="/editor.js"></script>\n<script src="/editor-books.js"></script>\n';

/** Resolve a URL pathname to a file inside ROOT, or null if it escapes/misses. */
async function resolveFile(pathname) {
  let rel;
  try {
    rel = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  let filePath = resolve(join(ROOT, rel));
  if (filePath !== ROOT && !filePath.startsWith(ROOT + "/")) return null;

  try {
    const s = await stat(filePath);
    if (s.isDirectory()) filePath = join(filePath, "index.html");
  } catch {
    // No extension? Try directory index (e.g. /notes/slug -> /notes/slug/index.html)
    if (!extname(filePath)) {
      filePath = join(filePath, "index.html");
    }
  }

  try {
    const s = await stat(filePath);
    if (!s.isFile()) return null;
  } catch {
    return null;
  }
  return filePath;
}

function readBody(req) {
  return new Promise((resolvePromise, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error("Body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolvePromise(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
  });
  res.end(body);
}

async function handleSave(req, res) {
  let payload;
  try {
    payload = JSON.parse(await readBody(req));
  } catch (err) {
    sendJson(res, 400, { error: "Invalid JSON body: " + err.message });
    return;
  }

  const { path: pagePath, articleHtml } = payload || {};
  if (typeof pagePath !== "string" || typeof articleHtml !== "string") {
    sendJson(res, 400, { error: "Expected { path, articleHtml }" });
    return;
  }

  const filePath = await resolveFile(pagePath);
  if (!filePath || !filePath.endsWith(".html")) {
    sendJson(res, 404, { error: "No HTML file for path " + pagePath });
    return;
  }

  const source = await readFile(filePath, "utf8");
  const openMatch = source.match(/<article class="article"[^>]*>/);
  if (!openMatch) {
    sendJson(res, 422, { error: 'No <article class="article"> in file' });
    return;
  }
  const contentStart = openMatch.index + openMatch[0].length;
  const contentEnd = source.lastIndexOf("</article>");
  if (contentEnd < contentStart) {
    sendJson(res, 422, { error: "Malformed article element" });
    return;
  }

  const updated =
    source.slice(0, contentStart) + articleHtml + source.slice(contentEnd);
  await writeFile(filePath, updated, "utf8");

  const relative = filePath.slice(ROOT.length + 1);
  console.log(`[save] ${relative} (${articleHtml.length} bytes of article)`);
  sendJson(res, 200, { ok: true, file: relative });
}

async function handleSaveBook(req, res) {
  let payload;
  try {
    payload = JSON.parse(await readBody(req));
  } catch (err) {
    sendJson(res, 400, { error: "Invalid JSON body: " + err.message });
    return;
  }

  const { slug, status, verdict, readType, notes, highlights, lead, author, published, pages } =
    payload || {};
  if (typeof slug !== "string" || !/^[\w-]+$/.test(slug)) {
    sendJson(res, 400, { error: "Invalid slug" });
    return;
  }

  const collections = loadCollections(ROOT);
  const book = collections.books.items.find((b) => b.slug === slug);
  if (!book) {
    sendJson(res, 404, { error: "Unknown book: " + slug });
    return;
  }

  const booksMeta = loadBooksMeta(ROOT);
  const meta = booksMeta[slug] || (booksMeta[slug] = {});

  if (status != null) {
    if (!STATUS[status]) return sendJson(res, 400, { error: "Bad status" });
    meta.status = status;
  }
  if (verdict != null) {
    if (!VERDICT[verdict]) return sendJson(res, 400, { error: "Bad verdict" });
    meta.verdict = verdict;
  }
  if (readType != null) {
    if (!READ_TYPE[readType]) return sendJson(res, 400, { error: "Bad readType" });
    meta.readType = readType;
  }
  if (typeof notes === "string") meta.notes = notes;
  if (typeof highlights === "string") meta.highlights = highlights;
  if (typeof lead === "string") meta.lead = lead;
  if (typeof author === "string") meta.author = author;
  if (typeof published === "string") meta.published = published;
  if (typeof pages === "string") meta.pages = pages;

  saveBooksMeta(ROOT, booksMeta);
  writeBookPage(ROOT, book, meta);

  console.log(`[save-book] ${slug}`);
  sendJson(res, 200, { ok: true, slug });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (req.method === "POST" && url.pathname === "/api/save") {
    try {
      await handleSave(req, res);
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/save-book") {
    try {
      await handleSaveBook(req, res);
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405).end();
    return;
  }

  const filePath = await resolveFile(url.pathname);
  if (!filePath) {
    res.writeHead(404, { "Content-Type": "text/plain" }).end("Not found");
    return;
  }

  const type = MIME[extname(filePath)] || "application/octet-stream";

  // no-store: authoring server — edits to editor.js/css must always load fresh
  if (type.startsWith("text/html")) {
    let html = await readFile(filePath, "utf8");
    html = html.includes("</body>")
      ? html.replace("</body>", INJECT + "</body>")
      : html + INJECT;
    res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store" });
    res.end(html);
    return;
  }

  const data = await readFile(filePath);
  res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(data);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Editing server running at http://localhost:${PORT}`);
  console.log(`Serving ${ROOT}`);
  console.log("Open any note and hit the Edit pill in the corner.");
});
