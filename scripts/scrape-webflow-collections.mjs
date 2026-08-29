#!/usr/bin/env node
/**
 * One-time dev script: scrape kreth.webflow.io collections into data/collections.json
 * Run: node scripts/scrape-webflow-collections.mjs
 */
import { writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const BASE = "https://kreth.webflow.io";
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "../data/collections.json");

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function fetchHtml(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`Failed ${path}: ${res.status}`);
  return res.text();
}

function parseBooks(html) {
  const items = [];
  const re =
    /role="listitem" class="book_list-item-wrapper w-dyn-item">([\s\S]*?)<\/div>/g;
  for (const m of html.matchAll(re)) {
    const block = m[1];
    const title = block.match(/widget_label is-link">([^<]+)/)?.[1]?.trim();
    const image =
      block.match(/src="([^"]+)"[^>]*class="book_image"/)?.[1] ||
      block.match(/class="book_image"[^>]*src="([^"]+)"/)?.[1] ||
      "";
    if (!title) continue;
    const slug = slugify(title);
    items.push({
      title,
      slug,
      href: `/books/#${slug}`,
      image,
    });
  }
  return items;
}

function parseClients(html) {
  const items = [];
  const re =
    /role="listitem" class="main-client_item w-dyn-item">([\s\S]*?)<\/div>\s*<\/div>(?=<div data-sticker|<div role="listitem" class="main-client_item|<\/div>\s*<\/div>\s*<\/div>)/g;
  for (const m of html.matchAll(re)) {
    const block = m[1];
    const title = block.match(/widget_label is-name">([^<]+)/)?.[1]?.trim();
    const external =
      block.match(/data-item="link" href="([^"]+)"/)?.[1] || "";
    const image =
      block.match(/client_logo"[^>]*src="([^"]+)"/)?.[1] ||
      block.match(/src="([^"]+)"[^>]*client_logo/)?.[1] ||
      "";
    if (!title) continue;
    const slug = slugify(title);
    items.push({
      title,
      slug,
      href: external || `/clients/#${slug}`,
      external: Boolean(external),
      image,
    });
  }
  return items;
}

function parseWork(html) {
  const projectSlugs = [
    ...new Set(
      [...html.matchAll(/href="\/projects\/([^"]+)"/g)].map((m) => m[1])
    ),
  ];
  const slugByClient = Object.fromEntries(
    projectSlugs.map((s) => [s.toLowerCase(), s])
  );

  const items = [];
  const re =
    /class="work_list-item-wrapper w-dyn-item">([\s\S]*?)<\/div>\s*<\/div>\s*(?=<div data-cursor|<div class="work_list-item-wrapper)/g;
  for (const m of html.matchAll(re)) {
    const block = m[1];
    const title = block.match(/work_list-item-name">([^<]+)/)?.[1]?.trim();
    const clientMatch = block.match(
      /work_list-item-client is-desktop[\s\S]*?<\/div>\s*<div>([^<]*)<\/div>/
    );
    const client = clientMatch?.[1]?.trim() || "";
    const external =
      block.match(/work_list-item-content w-inline-block" href="([^"]+)"/)?.[1] ||
      block.match(/work_list-item-background-wrapper w-inline-block" href="([^"]+)"/)?.[1] ||
      "";
    const imgMatch = block.match(
      /work_list-item-background-wrapper[\s\S]*?<img src="([^"]+)"/
    );
    let image = imgMatch?.[1] || "";
    if (image.includes("placeholder")) image = "";
    const confidential =
      client === "Confidential" ||
      (block.includes("work_list-item-background-overlay") &&
        !block.includes("w-condition-invisible"));
    if (!title) continue;

    const clientKey = client.toLowerCase().replace(/[^a-z0-9]/g, "");
    const slug =
      slugByClient[clientKey] ||
      slugByClient[slugify(client)] ||
      slugify(client || title);

    items.push({
      title,
      slug,
      client: client || title,
      href: projectSlugs.includes(slug)
        ? `/rabbit-hole/${slug}/`
        : external
          ? external.startsWith("http")
            ? external
            : `https://${external}`
          : `/rabbit-hole/#${slug}`,
      image,
      confidential,
    });
  }

  // Re-order preview: sidebar project slugs first, then rest
  const previewOrder = ["livetrained", "newsbreak", "pult", "notch"];
  const ordered = [];
  for (const slug of previewOrder) {
    const found = items.find((i) => i.slug === slug);
    if (found) ordered.push(found);
  }
  for (const item of items) {
    if (!ordered.includes(item)) ordered.push(item);
  }
  return ordered;
}

function parseAbout(html) {
  const main = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)?.[1] || html;
  const sections = [];
  const h2Blocks = [...main.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)];
  for (const h2 of h2Blocks) {
    const heading = h2[1].replace(/<[^>]+>/g, "").trim();
    if (!heading || heading.length > 120) continue;
    sections.push({ heading });
  }
  return sections;
}

async function main() {
  const [booksHtml, clientsHtml, workHtml, aboutHtml] = await Promise.all([
    fetchHtml("/books"),
    fetchHtml("/clients"),
    fetchHtml("/work"),
    fetchHtml("/about"),
  ]);

  const books = parseBooks(booksHtml);
  const clients = parseClients(clientsHtml);
  const rabbitHoleItems = parseWork(workHtml);

  const missingImages = {
    books: books.filter((i) => !i.image).length,
    clients: clients.filter((i) => !i.image).length,
    rabbitHole: rabbitHoleItems.filter((i) => !i.image).length,
  };

  const data = {
    rabbitHole: {
      label: "Rabbit Hole",
      path: "/rabbit-hole/",
      count: rabbitHoleItems.length,
      previewKind: "project",
      items: rabbitHoleItems,
    },
    books: {
      label: "Books",
      path: "/books/",
      count: books.length,
      previewKind: "book",
      items: books,
    },
    clients: {
      label: "Clients",
      path: "/clients/",
      count: clients.length,
      previewKind: "client",
      items: clients,
    },
    about: {
      path: "/about/",
      sections: parseAbout(aboutHtml),
    },
  };

  writeFileSync(OUT, JSON.stringify(data, null, 2) + "\n");
  console.log("Wrote", OUT);
  console.log("Counts:", {
    books: books.length,
    clients: clients.length,
    rabbitHole: rabbitHoleItems.length,
  });
  console.log("Missing images:", missingImages);
  if (books[0]) console.log("Preview books:", books.slice(0, 3).map((b) => b.title));
  if (rabbitHoleItems[0])
    console.log(
      "Preview projects:",
      rabbitHoleItems.slice(0, 3).map((p) => p.client)
    );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
