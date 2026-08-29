#!/usr/bin/env node
/**
 * Generate static book detail pages from data/collections.json + data/books.json
 * Run from portfolio/: node scripts/generate-book-pages.mjs
 */
import path from "path";
import { fileURLToPath } from "url";
import { loadCollections, loadBooksMeta, writeBookPage } from "./book-page-lib.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const collections = loadCollections(root);
const booksMeta = loadBooksMeta(root);

let count = 0;
for (const book of collections.books.items) {
  writeBookPage(root, book, booksMeta[book.slug] || {});
  count += 1;
}

console.log("Generated " + count + " book pages in books/");
