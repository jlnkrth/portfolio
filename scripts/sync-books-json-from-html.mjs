#!/usr/bin/env node
// One-time sync: extract notes, highlights, status, verdict, and readType
// from the current book HTML pages (which are ahead of data/books.json)
// back into data/books.json so it becomes the source of truth again.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { loadCollections, loadBooksMeta, saveBooksMeta } from "./book-page-lib.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function unescapeHtml(text) {
  return String(text)
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function extractPanel(html, panel) {
  var re = new RegExp(
    '<pre class="exp-code__body" data-panel="' + panel + '"[^>]*>([\\s\\S]*?)</pre>'
  );
  var m = html.match(re);
  return m ? unescapeHtml(m[1]) : null;
}

function extractActiveKey(html, groupLabel) {
  var groupRe = new RegExp(
    'aria-label="' + groupLabel + '"[^>]*>([\\s\\S]*?)</div>'
  );
  var g = html.match(groupRe);
  if (!g) return null;
  var m = g[1].match(
    /data-active="true"[^>]*>([^<]+)</
  );
  return m ? m[1].trim() : null;
}

const STATUS_LABELS = {
  Finished: "finished",
  "Re-reading": "re-reading",
  "On the shelf": "on-shelf",
};
const VERDICT_LABELS = {
  Recommend: "recommend",
  Solid: "solid",
  Skip: "skip",
};

const collections = loadCollections(root);
const booksMeta = loadBooksMeta(root);

let synced = 0;
for (const book of collections.books.items) {
  const filePath = path.join(root, "books", book.slug, "index.html");
  if (!fs.existsSync(filePath)) continue;
  const html = fs.readFileSync(filePath, "utf8");
  const meta = booksMeta[book.slug] || (booksMeta[book.slug] = {});

  const notes = extractPanel(html, "notes");
  const highlights = extractPanel(html, "highlights");
  if (notes) meta.notes = notes;
  if (highlights) meta.highlights = highlights;

  const statusLabel = extractActiveKey(html, "Reading status");
  if (statusLabel && STATUS_LABELS[statusLabel]) meta.status = STATUS_LABELS[statusLabel];

  const verdictLabel = extractActiveKey(html, "Verdict");
  if (verdictLabel && VERDICT_LABELS[verdictLabel]) meta.verdict = VERDICT_LABELS[verdictLabel];

  const badge = html.match(/book-read-badge[^>]*>(Entertaining|Educational)</);
  if (badge) meta.readType = badge[1].toLowerCase();

  synced += 1;
}

saveBooksMeta(root, booksMeta);
console.log("Synced " + synced + " books into data/books.json");
