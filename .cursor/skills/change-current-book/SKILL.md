---
name: change-current-book
description: >-
  Change the "Currently Reading" book on kreth.work. Use when the user asks to
  update the current book, currently reading card, reading card, or switch which
  book is shown on the About page.
---

# Change the currently reading book

The public "Currently Reading" card is **hardcoded HTML**, not driven by
`data/books.json` status. Book detail statuses (`finished` / `re-reading` /
`on-shelf`) are unrelated — do not invent a `reading` status.

## Source of truth

| File | Role |
| --- | --- |
| `about/index.html` | Live card visitors see (required) |
| `components.html` | Specimen under "Currently-reading card" (keep in sync) |

Card shape:

```html
<div class="reading-card">
  <span class="reading-card__label">Currently Reading</span>
  <a class="reading-card__cover" href="/books/<slug>/">
    <img src="/assets/books/<cover-file>" alt="<Title> by <Author>" loading="lazy" />
  </a>
</div>
```

Update **href**, **img src**, and **alt** together.

## Workflow

### 1. Resolve the target slug

```bash
# Prefer an existing collection entry
python3 - <<'PY'
import json
q = "alchemist".lower()  # user-supplied title fragment
with open("data/collections.json") as f:
    items = json.load(f)["books"]["items"]
for b in items:
    if q in b["title"].lower() or q in b["slug"]:
        print(b["slug"], "|", b["title"], "|", b.get("image"))
PY
```

Slug convention: lowercase kebab-case matching goodbooks.io
(`the-alchemist`, not `alchemist`).

### 2. If the book is missing, import it

Reuse the goodbooks import path (same metadata + cover pipeline as
`scripts/import-goodbooks.mjs`):

1. Confirm `https://goodbooks.io/books/<slug>` returns 200.
2. Parse JSON-LD / OG tags for title, author, cover URL.
3. Optionally enrich year/pages/lead via Open Library search.
4. Download cover to `assets/books/<slug>.<ext>` (usually `.avif`).
5. Insert into `data/collections.json` → `books.items` **before** the
   `coming-soon` placeholder; bump `books.count`.
6. Add meta in `data/books.json` with at least:

```json
{
  "lead": "...",
  "author": "...",
  "published": "...",
  "pages": "...",
  "status": "on-shelf",
  "verdict": "solid",
  "readType": "educational",
  "notes": "## Notes\n\nNo notes yet.",
  "highlights": "## Highlights\n\nNo highlights yet."
}
```

7. Generate the detail page:

```bash
node --input-type=module -e '
import { loadCollections, loadBooksMeta, writeBookPage } from "./scripts/book-page-lib.mjs";
const root = process.cwd();
const slug = "the-alchemist";
const book = loadCollections(root).books.items.find(b => b.slug === slug);
writeBookPage(root, book, loadBooksMeta(root)[slug]);
'
```

Or batch-regenerate: `node scripts/generate-book-pages.mjs`.

Open Library often returns a **reprint** year. Prefer the original publication
year when it is obviously wrong (e.g. The Alchemist → `1988`, not `2010`).

For a one-off import without editing the bulk `SLUGS` list in
`import-goodbooks.mjs`, copy that script's `importBook` flow into a short
`node --input-type=module` one-liner (parse → download cover → write JSON →
`writeBookPage`). Do not leave temporary scripts in the repo.

When editing `data/books.json`, use Node `saveBooksMeta` / `JSON.stringify`
(or a surgical text edit). Do **not** round-trip the file through Python
`json.dump` — it rewrites em dashes as `\u2014` and noisily diffs every book.

### 3. Point the reading card at the book

In both `about/index.html` and `components.html`, set:

- `href="/books/<slug>/"`
- `src` to the collection `image` path (must exist under `assets/books/`)
- `alt` to `"<Title> by <Author>"` from `data/books.json` / collections

### 4. Verify

- [ ] `assets/books/<cover>` exists on disk
- [ ] `books/<slug>/index.html` exists
- [ ] About card links and image match the new slug
- [ ] Components specimen matches About
- [ ] Local preview: About aside shows the new cover; clicking opens the book page

```bash
python3 -m http.server 8000
# open /about/ and /books/<slug>/
```

## Do not

- Change `layout.js` "Currently reading" — that title is for the **notes archive**
  current-article marker, not books.
- Add a new book status key unless product/design asks for it (`STATUS` in
  `scripts/book-page-lib.mjs` is only `finished` | `re-reading` | `on-shelf`).
- Update only About and leave the components specimen on the old book.
- Point the card at a slug with no cover file (broken image).

## Learnings from the Alchemist swap (2026-09)

- Previous card pointed at `unreasonable-hospitality` even though that book's
  status was `finished` — confirms the card is independent of status.
- The Alchemist was not in the collection; goodbooks.io slug `the-alchemist`
  worked and supplied an `.avif` cover.
- After import, regenerate the detail page if you edit `data/books.json` meta
  by hand (`writeBookPage` / `generate-book-pages.mjs`).
