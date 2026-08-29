#!/usr/bin/env node
/**
 * Add Entertaining / Educational badge to book detail pages.
 * Updates data/books.json readType and patches each book index.html in place.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const ENTERTAINING = new Set([
  "super-pumped",
  "chaos-monkeys",
  "titan",
  "leonardo-da-vinci",
  "freakonomics",
  "no-rules-rules",
  "sapiens",
  "the-undoing-project",
  "outliers",
  "small-giants",
  "trillion-dollar-coach",
  "the-war-of-art",
  "the-daily-stoic",
  "remote",
  "discipline-equals-freedom",
  "the-4-hour-workweek",
  "ego-is-the-enemy",
  "hooked",
]);

const READ_TYPE = {
  entertaining: { label: "Entertaining", tone: "orange" },
  educational: { label: "Educational", tone: "purple" },
};

const collections = JSON.parse(
  fs.readFileSync(path.join(root, "data/collections.json"), "utf8")
);
const booksMetaPath = path.join(root, "data/books.json");
const booksMeta = JSON.parse(fs.readFileSync(booksMetaPath, "utf8"));

function badgeMarkup(readType) {
  const item = READ_TYPE[readType];
  return `<span class="book-read-badge exp-seg__btn" data-active="true" data-tone="${item.tone}">${item.label}</span>`;
}

const badgeRe =
  /\s*<span class="book-read-badge exp-seg__btn"[^>]*>(?:Entertaining|Educational)<\/span>\s*/g;

let patched = 0;

for (const book of collections.books.items) {
  const slug = book.slug;
  const readType = ENTERTAINING.has(slug) ? "entertaining" : "educational";

  if (!booksMeta[slug]) booksMeta[slug] = {};
  booksMeta[slug].readType = readType;

  const filePath = path.join(root, "books", slug, "index.html");
  if (!fs.existsSync(filePath)) continue;

  let html = fs.readFileSync(filePath, "utf8");
  html = html.replace(badgeRe, "\n                ");

  const marker = '<div class="exp-stage__canvas">';
  const insert = marker + "\n                " + badgeMarkup(readType);
  if (!html.includes("book-read-badge")) {
    html = html.replace(marker, insert);
    patched += 1;
  } else {
    html = html.replace(
      /<span class="book-read-badge exp-seg__btn"[^>]*>(?:Entertaining|Educational)<\/span>/,
      badgeMarkup(readType)
    );
  }

  fs.writeFileSync(filePath, html, "utf8");
}

fs.writeFileSync(booksMetaPath, JSON.stringify(booksMeta, null, 2) + "\n", "utf8");
console.log("Patched " + patched + " book pages; readType saved to data/books.json");
