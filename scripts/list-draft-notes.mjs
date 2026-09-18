#!/usr/bin/env node
/**
 * Find unpublished note drafts (robots noindex, excluding templates)
 * and print markdown links for a preview base URL.
 *
 * Usage:
 *   node scripts/list-draft-notes.mjs
 *   node scripts/list-draft-notes.mjs --base https://pr-4-kreth-work.example.workers.dev
 *   node scripts/list-draft-notes.mjs --json
 */
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const NOTES = join(ROOT, "notes");

const args = process.argv.slice(2);
const jsonOut = args.includes("--json");
const baseIdx = args.indexOf("--base");
const base = (baseIdx >= 0 ? args[baseIdx + 1] : "").replace(/\/$/, "");

function titleFromHtml(html, fallback) {
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1) {
    return h1[1]
      .replace(/<[^>]+>/g, "")
      .replace(/&rsquo;/g, "'")
      .replace(/&ldquo;/g, '"')
      .replace(/&rdquo;/g, '"')
      .replace(/&mdash;/g, "—")
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ")
      .trim();
  }
  const t = html.match(/<title>([^<]+)<\/title>/i);
  if (t) return t[1].replace(/\s+[—–-]\s+Julian Kreth\s*$/i, "").trim();
  return fallback;
}

function isDraftHtml(html) {
  if (/name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(html)) {
    return true;
  }
  if (/<!--\s*DRAFT:/i.test(html)) return true;
  return false;
}

const drafts = [];
for (const name of readdirSync(NOTES)) {
  if (name.startsWith("_") || name === "index.html") continue;
  const dir = join(NOTES, name);
  if (!statSync(dir).isDirectory()) continue;
  const index = join(dir, "index.html");
  if (!existsSync(index)) continue;
  const html = readFileSync(index, "utf8");
  if (!isDraftHtml(html)) continue;
  const path = `/notes/${name}/`;
  drafts.push({
    slug: name,
    title: titleFromHtml(html, name),
    path,
    url: base ? `${base}${path}` : path,
  });
}

drafts.sort((a, b) => a.slug.localeCompare(b.slug));

if (jsonOut) {
  process.stdout.write(JSON.stringify(drafts, null, 2) + "\n");
  process.exit(0);
}

if (drafts.length === 0) {
  process.stdout.write("_No draft notes found on this branch._\n");
  process.exit(0);
}

for (const d of drafts) {
  process.stdout.write(`- [${d.title}](${d.url})\n`);
}
