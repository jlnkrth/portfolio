#!/usr/bin/env node
/**
 * Enrich data/books.json with author, published, pages, and lead from Open Library.
 * Preserves existing entries (notes, highlights, status, verdict overrides).
 * Run from portfolio/: node scripts/enrich-books-json.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const booksPath = path.join(root, "data/books.json");
const collections = JSON.parse(
  fs.readFileSync(path.join(root, "data/collections.json"), "utf8")
);

const booksMeta = JSON.parse(fs.readFileSync(booksPath, "utf8"));

/** Ambiguous titles — Open Library often returns the wrong edition */
const MANUAL_OVERRIDES = {
  titan: {
    author: "Ron Chernow",
    published: "1998",
    pages: "832",
    lead: "The definitive biography of John D. Rockefeller, Sr.",
  },
  principles: {
    author: "Ray Dalio",
    published: "2017",
    pages: "592",
    lead: "Life and work principles from the founder of Bridgewater Associates.",
  },
  originals: {
    author: "Adam Grant",
    published: "2016",
    pages: "336",
    lead: "How non-conformists move the world forward.",
  },
  switch: {
    author: "Chip Heath",
    published: "2010",
    pages: "320",
    lead: "How to change things when change is hard.",
  },
  remote: {
    author: "Jason Fried",
    published: "2013",
    pages: "256",
    lead: "Office not required — building a calm company that works from anywhere.",
  },
  "hackers-amp-painters": {
    author: "Paul Graham",
    published: "2004",
    pages: "272",
    lead: "Big ideas from the computer age — startups, hackers, and how to make things people want.",
  },
  "so-good-they-can-x27-t-ignore-you": {
    author: "Cal Newport",
    published: "2012",
    pages: "304",
    lead: "Why skills trump passion in the quest for work you love.",
  },
  "made-to-stick": { published: "2007" },
};

function sleep(ms) {
  return new Promise(function (r) {
    setTimeout(r, ms);
  });
}

function cleanLead(text) {
  if (!text) return "";
  text = String(text).replace(/\s+/g, " ").trim();
  if (text.length > 220) {
    text = text.slice(0, 217).trim() + "…";
  }
  return text;
}

function firstSentence(text) {
  if (!text) return "";
  var m = text.match(/^(.+?[.!?])(\s|$)/);
  return m ? m[1] : text.slice(0, 160);
}

async function lookupOpenLibrary(title) {
  var url =
    "https://openlibrary.org/search.json?title=" +
    encodeURIComponent(title) +
    "&limit=5&fields=title,author_name,first_publish_year,number_of_pages_median,first_sentence";
  var res = await fetch(url);
  if (!res.ok) return null;
  var data = await res.json();
  if (!data.docs || !data.docs.length) return null;

  var normalized = title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  var doc =
    data.docs.find(function (d) {
      var t = (d.title || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      return t === normalized || t.includes(normalized) || normalized.includes(t);
    }) || data.docs[0];

  var author = Array.isArray(doc.author_name)
    ? doc.author_name[0]
    : doc.author_name;
  var sentence = Array.isArray(doc.first_sentence)
    ? doc.first_sentence[0]
    : doc.first_sentence;

  return {
    author: author || "",
    published: doc.first_publish_year ? String(doc.first_publish_year) : "",
    pages: doc.number_of_pages_median ? String(doc.number_of_pages_median) : "",
    lead: cleanLead(sentence || ""),
  };
}

async function main() {
  var updated = 0;
  var skipped = 0;

  for (var book of collections.books.items) {
    var slug = book.slug;
    var existing = booksMeta[slug] || {};

    if (slug === "coming-soon") {
      booksMeta[slug] = {
        lead: "More books on the shelf soon.",
        status: "on-shelf",
        verdict: "skip",
        notes: "## Notes\n\nComing soon.",
        highlights: "## Highlights\n\nComing soon.",
        ...existing,
      };
      updated += 1;
      continue;
    }

    if (
      existing.author &&
      existing.published &&
      existing.lead &&
      existing.lead.indexOf("On my reading list") === -1
    ) {
      skipped += 1;
      continue;
    }

    var lookup = await lookupOpenLibrary(book.title);
    await sleep(120);

    var entry = {
      status: existing.status || "finished",
      verdict: existing.verdict || "solid",
      notes: existing.notes || "## Notes\n\nNo notes yet.",
      highlights: existing.highlights || "## Highlights\n\nNo highlights yet.",
      ...existing,
    };

    if (lookup) {
      if (!entry.author && lookup.author) entry.author = lookup.author;
      if (!entry.published && lookup.published) entry.published = lookup.published;
      if (!entry.pages && lookup.pages) entry.pages = lookup.pages;
      if (
        !entry.lead ||
        entry.lead.indexOf("On my reading list") !== -1
      ) {
        entry.lead =
          lookup.lead ||
          firstSentence("Notes and highlights from " + book.title + ".");
      }
    } else if (!entry.lead) {
      entry.lead = "On my reading list — notes and highlights for " + book.title + ".";
    }

    booksMeta[slug] = entry;
    updated += 1;
    console.log("  " + book.title + " → " + (entry.author || "?"));
  }

  for (var slug of Object.keys(MANUAL_OVERRIDES)) {
    if (booksMeta[slug]) {
      booksMeta[slug] = { ...booksMeta[slug], ...MANUAL_OVERRIDES[slug] };
    }
  }

  fs.writeFileSync(booksPath, JSON.stringify(booksMeta, null, 2) + "\n");
  console.log("Wrote " + booksPath);
  console.log("Updated " + updated + ", skipped " + skipped + " (already complete)");
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});
