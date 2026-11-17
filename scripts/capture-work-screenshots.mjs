#!/usr/bin/env node
/**
 * Capture above-the-fold desktop screenshots for work cards via Firecrawl.
 * Saves PNGs under assets/work/ and writes `screenshot` paths into data/work.json.
 *
 * Images are stored only in this repo (and whatever hosts the site). Firecrawl
 * is used as a capture tool with storeInCache:false — nothing is written to
 * Masse infra.
 *
 * Auth: FIRECRAWL_API_KEY, or the first fc-… key in ~/.config/goose/config.yaml
 * or ~/.cursor/mcp.json.
 *
 * Usage: node scripts/capture-work-screenshots.mjs [--only slug,slug] [--force]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "assets", "work");
const WORK_JSON = path.join(ROOT, "data", "work.json");
const VIEWPORT = { width: 1440, height: 900 };
const GAP_MS = 7000; // ~8–9 req/min under typical hobby limits

function parseArgs(argv) {
  const out = { only: null, force: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--force") out.force = true;
    else if (a === "--only") {
      out.only = new Set(
        String(argv[++i] || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      );
    }
  }
  return out;
}

function readKey() {
  if (process.env.FIRECRAWL_API_KEY) return process.env.FIRECRAWL_API_KEY;
  const homes = [
    path.join(process.env.HOME || "", ".config/goose/config.yaml"),
    path.join(process.env.HOME || "", ".cursor/mcp.json"),
  ];
  for (const file of homes) {
    try {
      const text = fs.readFileSync(file, "utf8");
      const m = text.match(/fc-[A-Za-z0-9_-]{10,}/);
      if (m) return m[0];
    } catch {
      /* skip */
    }
  }
  throw new Error("No FIRECRAWL_API_KEY found");
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function scrapeScreenshot(apiKey, href) {
  const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url: href,
      formats: [
        {
          type: "screenshot",
          fullPage: false,
          quality: 82,
          viewport: VIEWPORT,
        },
      ],
      waitFor: 3000,
      mobile: false,
      storeInCache: false,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.success) {
    const err = body.error || body.message || `HTTP ${res.status}`;
    const errObj = new Error(err);
    errObj.status = res.status;
    throw errObj;
  }
  const shot = body.data && body.data.screenshot;
  if (!shot) throw new Error("No screenshot in response");
  return shot;
}

async function downloadTo(urlOrData, dest) {
  if (typeof urlOrData === "string" && urlOrData.startsWith("data:")) {
    const b64 = urlOrData.split(",", 2)[1];
    fs.writeFileSync(dest, Buffer.from(b64, "base64"));
    return;
  }
  const res = await fetch(urlOrData);
  if (!res.ok) throw new Error(`Download failed HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, buf);
}

function normalizeHref(href) {
  const h = String(href || "").trim();
  if (!h || h.startsWith("#")) return "";
  if (/^https?:\/\//i.test(h)) return h;
  return "https://" + h.replace(/^\/+/, "");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const apiKey = readKey();
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const work = JSON.parse(fs.readFileSync(WORK_JSON, "utf8"));
  const jobs = Object.entries(work)
    .map(([slug, item]) => ({ slug, item, href: normalizeHref(item.href) }))
    .filter((j) => j.href)
    .filter((j) => !args.only || args.only.has(j.slug));

  console.log(`Capturing ${jobs.length} desktop screenshots (${VIEWPORT.width}×${VIEWPORT.height})`);

  let ok = 0;
  const fails = [];

  for (let i = 0; i < jobs.length; i++) {
    const { slug, href } = jobs[i];
    const dest = path.join(OUT_DIR, `${slug}.png`);
    if (!args.force && fs.existsSync(dest) && fs.statSync(dest).size > 10_000) {
      console.log(`skip ${slug} (exists)`);
      work[slug].screenshot = `/assets/work/${slug}.png`;
      ok++;
      continue;
    }

    let attempt = 0;
    while (attempt < 4) {
      attempt++;
      try {
        process.stdout.write(`[${i + 1}/${jobs.length}] ${slug} … `);
        const shot = await scrapeScreenshot(apiKey, href);
        await downloadTo(shot, dest);
        const size = fs.statSync(dest).size;
        const head = fs.readFileSync(dest).subarray(0, 4);
        if (head[0] !== 0x89 && !(head[0] === 0xff && head[1] === 0xd8)) {
          throw new Error("Not an image file");
        }
        work[slug].screenshot = `/assets/work/${slug}.png`;
        console.log(`ok (${size} bytes)`);
        ok++;
        break;
      } catch (err) {
        const status = err.status;
        console.log(`fail: ${err.message}`);
        if (status === 429 && attempt < 4) {
          console.log("  rate limited — waiting 65s");
          await sleep(65_000);
          continue;
        }
        fails.push([slug, err.message]);
        break;
      }
    }

    if (i < jobs.length - 1) await sleep(GAP_MS);
  }

  fs.writeFileSync(WORK_JSON, JSON.stringify(work, null, 2) + "\n");
  console.log(`\nDone. ok=${ok} fail=${fails.length}`);
  for (const [slug, msg] of fails) console.log(`  ${slug}: ${msg}`);
  if (fails.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
