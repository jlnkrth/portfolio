#!/usr/bin/env node
/** Fix generic goodbooks marketing copy used as book leads. */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { loadCollections, loadBooksMeta, saveBooksMeta, writeBookPage } from "./book-page-lib.mjs";
import { SLUGS } from "./import-goodbooks.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function cleanLead(text) {
  if (!text) return "";
  text = String(text).replace(/\s+/g, " ").trim();
  if (text.length > 220) text = text.slice(0, 217).trim() + "…";
  return text;
}

function badLead(lead) {
  return (
    !lead ||
    /Discover similar books|Interested in .+?\? Discover|On my reading list/.test(lead)
  );
}

async function lookup(title, author) {
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

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const collections = loadCollections(root);
  const booksMeta = loadBooksMeta(root);

  for (const slug of SLUGS) {
    const meta = booksMeta[slug];
    const book = collections.books.items.find((b) => b.slug === slug);
    if (!meta || !book) continue;

    book.title = book.title.trim();

    if (!badLead(meta.lead)) continue;

    const ol = await lookup(book.title, meta.author);
    await sleep(120);

    if (ol?.lead) meta.lead = ol.lead;
    else meta.lead = "Notes and highlights from " + book.title + ".";

    if (!meta.author && ol?.author) meta.author = ol.author;
    if (!meta.published && ol?.published) meta.published = ol.published;
    if (!meta.pages && ol?.pages) meta.pages = ol.pages;

    console.log(slug + " → " + meta.lead.slice(0, 90));
  }

  saveBooksMeta(root, booksMeta);
  fs.writeFileSync(
    path.join(root, "data/collections.json"),
    JSON.stringify(collections, null, 2) + "\n"
  );

  for (const slug of SLUGS) {
    const book = collections.books.items.find((b) => b.slug === slug);
    if (book) writeBookPage(root, book, booksMeta[slug]);
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
