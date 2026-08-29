#!/usr/bin/env node
/**
 * Import books from goodbooks.io into collections.json + books.json,
 * download cover images to assets/books/, and regenerate detail pages.
 *
 * Run from portfolio/: node scripts/import-goodbooks.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { loadCollections, loadBooksMeta, saveBooksMeta, writeBookPage } from "./book-page-lib.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const assetsDir = path.join(root, "assets/books");
const collectionsPath = path.join(root, "data/collections.json");

export const SLUGS = [
  "company-of-one",
  "thinking-fast-and-slow",
  "atomic-habits",
  "meditations",
  "surely-youre-joking-mr-feynman",
  "homo-deus",
  "measure-what-matters",
  "21-lessons-for-the-21st-century",
  "addiction-by-design",
  "all-marketers-are-liars",
  "algorithms-to-live-by",
  "alibaba",
  "al-qaeda",
  "american-kingpin",
  "an-outline-of-psycho-analysis",
  "antisocial",
  "antifragile",
  "a-random-walk-down-wall-street",
  "amp-it-up",
  "behave",
  "benjamin-franklin-walter-isaacson",
  "black-rednecks-white-liberals",
  "blue-ocean-strategy",
  "blueprint",
  "bogle-on-mutual-funds",
  "brave-new-work",
  "brave-new-world",
  "breath",
  "brotopia",
  "build",
  "built-to-sell",
  "but-how-do-it-know",
  "capital-in-the-twenty-first-century",
  "character-counts",
  "class-warfare",
  "cognitive-psychology",
  "code",
  "company-man",
  "complexity-m-mitchell-waldrop",
  "confessions-of-an-advertising-man",
  "conspiracy",
  "cosmos",
  "creativity-inc",
  "crush-it",
  "das-kapital",
  "david-and-goliath",
  "diplomacy",
  "dont-burn-this-book",
  "dont-shoot-the-dog",
  "do-the-work",
  "elon-musk-walter-isaacson",
  "emotional-design",
  "endeavor",
  "enough",
  "escape-from-freedom",
  "everything-is-obvious",
  "fahrenheit-451",
  "faraday-maxwell-and-the-electromagnetic-field",
  "fascism",
  "fear-and-loathing-in-las-vegas",
  "finding-flow",
  "finite-and-infinite-games",
  "flash-boys",
  "food-lab",
  "frenemies",
  "from-bacteria-to-bach-and-back",
  "genghis-khan-and-the-making-of-the-modern-world",
  "grid-systems-in-graphic-design",
  "growth-hacker-marketing",
  "guerilla-marketing",
  "hacking-growth",
  "hatching-twitter",
  "hit-makers",
  "how-to",
  "how-to-change-your-mind",
  "how-to-fail-at-almost-everything-and-still-win-big",
  "how-to-hide-an-empire",
  "how-to-keep-your-cool",
  "how-to-write-a-good-advertisement",
  "identity-designed",
  "ikigai",
  "infinite-powers",
  "influence",
  "jab-jab-jab-right-hook",
  "john-bogle-on-investing",
  "kitchen-confidential",
  "leaders-eat-last",
  "let-my-people-go-surfing",
  "liars-poker",
  "linchpin",
  "lord-of-the-flies",
  "losing-my-virginity",
  "lying",
  "made-in-america",
  "making-ideas-happen",
  "making-sense",
  "manufacturing-consent",
  "master-of-one",
  "mastery-robert-greene",
  "merchants-of-doubt",
  "misbehaving",
  "moneyball",
  "more-from-less",
  "more-money-than-god",
  "nobody-wants-to-read-your-sh-t",
  "nudge",
  "on-booze",
  "outlive",
  "secrets-of-sand-hill-road",
  "setting-the-table",
  "shoe-dog",
  "steal-like-an-artist",
  "stillness-is-the-key",
  "superfans",
  "surrounded-by-idiots",
  "that-will-never-work",
  "the-100-startup",
  "the-12-week-year",
  "the-48-laws-of-power",
  "the-4-hour-body",
  "the-8020-principle",
  "the-age-of-surveillance-capitalism",
  "the-arabs",
  "the-attention-merchants",
  "the-box",
  "the-brand-gap",
  "the-brand-flip",
  "the-changing-world-order",
  "the-checklist-manifesto",
  "the-circle",
  "the-compound-effect",
  "the-creative-act",
  "the-design-of-everyday-things",
  "the-effective-executive",
  "the-elephant-in-the-brain",
  "the-emperor-wears-no-clothes",
  "the-end-of-power",
  "the-evolution-of-everything",
  "the-fifth-risk",
  "the-firm",
  "the-fran-lebowitz-reader",
  "the-hard-thing-about-hard-things",
  "the-hitchhikers-guide-to-the-galaxy",
  "the-inevitable",
  "the-infinite-game",
  "the-inner-game-of-tennis",
  "the-innovators",
  "the-innovators-dilemma",
  "the-laws-of-human-nature",
  "the-little-book-of-common-sense-investing",
  "the-machiavellians",
  "the-messy-middle",
  "the-misbehaviour-of-markets",
  "the-new-new-thing",
  "the-no-asshole-rule",
  "the-paypal-wars",
  "the-power-of-habit",
  "the-rape-of-nanking",
  "the-rise-and-fall-of-the-third-reich",
  "the-search-for-modern-china",
  "the-signal-and-the-noise",
  "the-smartest-guys-in-the-room",
  "the-subtle-art-of-not-giving-a-fck",
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function decodeHtml(text) {
  return String(text || "")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function cleanLead(text) {
  if (!text) return "";
  text = String(text).replace(/\s+/g, " ").trim();
  if (text.length > 220) text = text.slice(0, 217).trim() + "…";
  return text;
}

function parseAuthorFromOgTitle(ogTitle) {
  const decoded = decodeHtml(ogTitle);
  const m = decoded.match(/\sby\s+(.+)$/i);
  return m ? m[1].trim() : "";
}

function imageExtFromUrl(url) {
  const m = url.match(/\.(avif|webp|jpe?g|png)(?:\?|$)/i);
  return m ? m[1].toLowerCase() : "avif";
}

function parseGoodbooksBook(html) {
  const ldMatch = html.match(
    /<script type="application\/ld\+json" class="schemantra">([\s\S]*?)<\/script>/
  );
  if (!ldMatch) return null;

  let book;
  try {
    book = JSON.parse(ldMatch[1]);
  } catch {
    return null;
  }
  if (book["@type"] !== "Book" || !book.name) return null;

  const ogTitle = html.match(/property="og:title" content="([^"]+)"/)?.[1] || "";
  const ogDescription =
    html.match(/property="og:description" content="([^"]+)"/)?.[1] || "";

  let author = parseAuthorFromOgTitle(ogTitle);
  if (!author && book.author) {
    author =
      book.author.name ||
      [book.author.givenName, book.author.familyName].filter(Boolean).join(" ");
  }

  return {
    title: decodeHtml(book.name),
    author: decodeHtml(author),
    imageUrl: book.image || html.match(/property="og:image" content="([^"]+)"/)?.[1] || "",
    description: decodeHtml(ogDescription),
  };
}

async function lookupOpenLibrary(title, author) {
  const q = author ? `${title} ${author}` : title;
  const url =
    "https://openlibrary.org/search.json?q=" +
    encodeURIComponent(q) +
    "&limit=5&fields=title,author_name,first_publish_year,number_of_pages_median,first_sentence";

  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.docs?.length) return null;

  const normalized = title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const doc =
    data.docs.find((d) => {
      const t = (d.title || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      return t === normalized || t.includes(normalized) || normalized.includes(t);
    }) || data.docs[0];

  const sentence = Array.isArray(doc.first_sentence)
    ? doc.first_sentence[0]
    : doc.first_sentence;

  return {
    author: Array.isArray(doc.author_name) ? doc.author_name[0] : doc.author_name || "",
    published: doc.first_publish_year ? String(doc.first_publish_year) : "",
    pages: doc.number_of_pages_median ? String(doc.number_of_pages_median) : "",
    lead: cleanLead(sentence || ""),
  };
}

async function downloadCover(imageUrl, slug) {
  if (!imageUrl) return "";
  const ext = imageExtFromUrl(imageUrl);
  const filename = `${slug}.${ext}`;
  const dest = path.join(assetsDir, filename);
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Image download failed (${res.status})`);
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  return `/assets/books/${filename}`;
}

async function importBook(slug, existingSlugs) {
  if (existingSlugs.has(slug)) {
    return { slug, skipped: true, reason: "already in collection" };
  }

  const pageUrl = `https://goodbooks.io/books/${slug}`;
  const res = await fetch(pageUrl);
  if (!res.ok) {
    return { slug, error: `HTTP ${res.status}` };
  }

  const html = await res.text();
  const parsed = parseGoodbooksBook(html);
  if (!parsed?.title) {
    return { slug, error: "Could not parse book metadata" };
  }

  const ol = await lookupOpenLibrary(parsed.title, parsed.author);
  await sleep(120);

  const author = parsed.author || ol?.author || "";
  const published = ol?.published || "";
  const pages = ol?.pages || "";
  let lead = ol?.lead || "";
  if (!lead) {
    lead = `Notes and highlights from ${parsed.title}.`;
  }

  const image = await downloadCover(parsed.imageUrl, slug);

  return {
    slug,
    collectionItem: {
      title: parsed.title,
      slug,
      href: `/books/${slug}/`,
      image,
    },
    meta: {
      lead,
      author,
      published,
      pages,
      status: "on-shelf",
      verdict: "solid",
      readType: "educational",
      notes: "## Notes\n\nNo notes yet.",
      highlights: "## Highlights\n\nNo highlights yet.",
    },
  };
}

async function main() {
  fs.mkdirSync(assetsDir, { recursive: true });

  const collections = loadCollections(root);
  const booksMeta = loadBooksMeta(root);
  const existingSlugs = new Set(collections.books.items.map((b) => b.slug));

  const results = [];
  const newItems = [];

  for (let i = 0; i < SLUGS.length; i++) {
    const slug = SLUGS[i];
    process.stdout.write(`[${i + 1}/${SLUGS.length}] ${slug}… `);
    try {
      const result = await importBook(slug, existingSlugs);
      results.push(result);
      if (result.skipped) {
        console.log("skip (" + result.reason + ")");
      } else if (result.error) {
        console.log("FAIL — " + result.error);
      } else {
        newItems.push(result.collectionItem);
        booksMeta[slug] = result.meta;
        existingSlugs.add(slug);
        console.log("ok — " + result.collectionItem.title);
      }
    } catch (err) {
      results.push({ slug, error: err.message });
      console.log("FAIL — " + err.message);
    }
    await sleep(150);
  }

  if (newItems.length) {
    const comingSoonIdx = collections.books.items.findIndex((b) => b.slug === "coming-soon");
    if (comingSoonIdx === -1) {
      collections.books.items.push(...newItems);
    } else {
      collections.books.items.splice(comingSoonIdx, 0, ...newItems);
    }
    collections.books.count = collections.books.items.length;
    fs.writeFileSync(collectionsPath, JSON.stringify(collections, null, 2) + "\n");
    saveBooksMeta(root, booksMeta);

    let pages = 0;
    for (const item of newItems) {
      const book = collections.books.items.find((b) => b.slug === item.slug);
      writeBookPage(root, book, booksMeta[item.slug]);
      pages += 1;
    }

    console.log("\nAdded " + newItems.length + " books to collections.json");
    console.log("Generated " + pages + " book detail pages");
    console.log("Covers saved to assets/books/");
  }

  const failed = results.filter((r) => r.error);
  if (failed.length) {
    console.log("\nFailed (" + failed.length + "):");
    failed.forEach((r) => console.log("  " + r.slug + ": " + r.error));
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
