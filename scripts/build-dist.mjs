#!/usr/bin/env node
// Copy only public site files into dist/ for Cloudflare Workers Static Assets.
import { cpSync, mkdirSync, rmSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, "dist");

const ROOT_FILES = [
  "index.html",
  "styles.css",
  "components.css",
  "components.html",
  "components.js",
  "layout.js",
  "now-playing.js",
  "availability.js",
  "avatar.js",
  "nav-preview.js",
  "nav-mobile.js",
  "sidebar-preview.js",
  "projects.js",
  "notes-list.js",
  "collection.js",
  "clients-board.js",
  "photo-gallery.js",
  "inline-previews.js",
  "exploration.js",
  "admin-auth.js",
  "robots.txt",
  ".nojekyll",
];

const ROOT_DIRS = [
  "_partials",
  "about",
  "admin",
  "assets",
  "books",
  "clients",
  "data",
  "exploration",
  "notes",
  "projects",
  "rabbit-hole",
  "social",
];

const SKIP_NAMES = new Set([
  ".DS_Store",
  ".git",
  ".gitignore",
  "node_modules",
  ".wrangler",
  ".dev.vars",
  ".env",
  "ARTICLE-GUIDE.md",
  "SOCIAL-GUIDE.md",
]);

function shouldSkip(name) {
  if (SKIP_NAMES.has(name)) return true;
  if (name.endsWith(".md")) return true;
  if (name.endsWith(".map")) return true;
  return false;
}

function copyDir(src, dest) {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src)) {
    if (shouldSkip(entry)) continue;
    const from = join(src, entry);
    const to = join(dest, entry);
    const st = statSync(from);
    if (st.isDirectory()) copyDir(from, to);
    else cpSync(from, to);
  }
}

rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });

let copied = 0;
for (const file of ROOT_FILES) {
  const from = join(ROOT, file);
  if (!existsSync(from)) {
    console.warn("skip missing root file:", file);
    continue;
  }
  cpSync(from, join(DIST, file));
  copied += 1;
}

for (const dir of ROOT_DIRS) {
  const from = join(ROOT, dir);
  if (!existsSync(from)) {
    console.warn("skip missing dir:", dir);
    continue;
  }
  copyDir(from, join(DIST, dir));
  copied += 1;
}

// Emit draft index from noindex notes so preview hosts can list them.
{
  const { execFileSync } = await import("node:child_process");
  const { writeFileSync } = await import("node:fs");
  try {
    const out = execFileSync(
      process.execPath,
      [join(ROOT, "scripts/list-draft-notes.mjs"), "--json"],
      { encoding: "utf8" }
    );
    const drafts = JSON.parse(out);
    const payload = {
      items: drafts.map((d, i) => ({
        title: d.title,
        slug: d.slug,
        href: d.path,
        author: "Julian Kreth",
        date: null,
        draft: true,
        viewTransitionName: "note-draft-" + i,
      })),
    };
    writeFileSync(
      join(DIST, "data", "drafts.json"),
      JSON.stringify(payload, null, 2) + "\n"
    );
    console.log(`Draft notes indexed: ${payload.items.length}`);
  } catch (err) {
    console.warn("skip drafts.json:", err.message);
  }
}

function countFiles(dir) {
  let n = 0;
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) n += countFiles(p);
    else n += 1;
  }
  return n;
}

const total = countFiles(DIST);
console.log(`Built ${relative(ROOT, DIST)}: ${copied} roots, ${total} files`);
