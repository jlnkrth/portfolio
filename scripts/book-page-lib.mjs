// Shared rendering logic for book detail pages.
// Used by generate-book-pages.mjs (batch) and edit-server.mjs (single-page saves).
import fs from "fs";
import path from "path";

export const STATUS = {
  finished: { label: "Finished", tone: "green" },
  "re-reading": { label: "Re-reading", tone: "orange" },
  "on-shelf": { label: "On the shelf", tone: "grey" },
};

export const VERDICT = {
  recommend: { label: "Recommend", tone: "purple" },
  solid: { label: "Solid", tone: "blue" },
  skip: { label: "Skip", tone: "grey" },
};

export const READ_TYPE = {
  entertaining: { label: "Entertaining", tone: "orange" },
  educational: { label: "Educational", tone: "purple" },
  "must-read": { label: "Must Read", tone: "gold" },
};

const READ_TYPE_EMOJI = {
  entertaining: "🍿",
  educational: "🎓",
  "must-read": "⭐",
};

export function readTypeBadgeInner(readTypeKey) {
  var key = READ_TYPE[readTypeKey] ? readTypeKey : "educational";
  var item = READ_TYPE[key];
  return READ_TYPE_EMOJI[key] + " " + escapeHtml(item.label);
}

export function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function loadCollections(root) {
  return JSON.parse(
    fs.readFileSync(path.join(root, "data/collections.json"), "utf8")
  );
}

export function loadBooksMeta(root) {
  return JSON.parse(fs.readFileSync(path.join(root, "data/books.json"), "utf8"));
}

export function saveBooksMeta(root, booksMeta) {
  fs.writeFileSync(
    path.join(root, "data/books.json"),
    JSON.stringify(booksMeta, null, 2) + "\n",
    "utf8"
  );
}

function segRow(options, activeKey, toneMap) {
  return options
    .map(function (key) {
      var item = toneMap[key];
      var active = key === activeKey ? ' data-active="true"' : "";
      return (
        '<span class="exp-seg__btn"' +
        active +
        ' data-key="' +
        key +
        '" data-tone="' +
        item.tone +
        '">' +
        escapeHtml(item.label) +
        "</span>"
      );
    })
    .join("\n                    ");
}

function readTypeBadge(readTypeKey) {
  var key = READ_TYPE[readTypeKey] ? readTypeKey : "educational";
  var item = READ_TYPE[key];
  return (
    '<span class="book-read-badge exp-seg__btn" data-active="true" data-key="' +
    key +
    '" data-tone="' +
    item.tone +
    '">' +
    readTypeBadgeInner(key) +
    "</span>"
  );
}

function coverMarkup(title, image) {
  if (image) {
    return (
      '<img\n                  class="book-cover"\n                  src="' +
      escapeHtml(image) +
      '"\n                  alt="' +
      escapeHtml(title + " book cover") +
      '"\n                />'
    );
  }
  return (
    '<div class="book-cover book-cover--placeholder" aria-hidden="true">Coming soon</div>'
  );
}

var META_FIELDS = [
  { key: "author", label: "author" },
  { key: "published", label: "published" },
  { key: "pages", label: "pages" },
  { key: "genre", label: "genre" },
  { key: "format", label: "format" },
];

// Counts content "blocks": paragraphs separated by blank lines, with each
// numbered list item counted individually. Matches the convention used in
// the sidebar (notes = distinct points, highlights = quotes).
export function countBlocks(text) {
  if (!text) return 0;
  var count = 0;
  var inBlock = false;
  text.split("\n").forEach(function (line) {
    var t = line.trim();
    if (!t || t.startsWith("##") || t === "No notes yet." || t === "No highlights yet." || t === "Coming soon.") {
      inBlock = false;
      return;
    }
    if (/^\d+\.\s/.test(t)) {
      count += 1;
      inBlock = false;
      return;
    }
    if (!inBlock) {
      count += 1;
      inBlock = true;
    }
  });
  return count;
}

function idxListRow(label, value, opts) {
  opts = opts || {};
  var cls = "idx-list__row";
  if (opts.total) cls += " idx-list__row--total";
  var valueCls = opts.status ? "idx-list__status" : "idx-list__count";
  if (opts.locked) valueCls += " idx-list__status--locked";
  var valueText = opts.status ? "[ " + value + " ]" : String(value);
  return (
    '<div class="' +
    cls +
    '" data-idx="' +
    escapeHtml(label) +
    '"><span>' +
    escapeHtml(label) +
    '</span><span class="' +
    valueCls +
    '">' +
    escapeHtml(valueText) +
    "</span></div>"
  );
}

function idxListMarkup(meta, notes, highlights, statusKey, verdictKey) {
  var rows = [];
  var notesCount = countBlocks(notes);
  var highlightsCount = countBlocks(highlights);

  if (Array.isArray(meta.details)) {
    meta.details.forEach(function (row) {
      if (row && row.label != null && row.value != null) {
        rows.push(idxListRow(row.label, row.value));
      }
    });
  } else {
    META_FIELDS.forEach(function (field) {
      if (meta[field.key] != null && meta[field.key] !== "") {
        rows.push(idxListRow(field.label, meta[field.key]));
      }
    });
  }

  rows.push(idxListRow("notes", notesCount));
  rows.push(idxListRow("highlights", highlightsCount));
  rows.push('<span class="idx-list__divider" aria-hidden="true"></span>');
  rows.push(idxListRow("total", notesCount + highlightsCount, { total: true }));
  rows.push(
    idxListRow("status", STATUS[statusKey].label.toLowerCase(), { status: true })
  );
  rows.push(
    idxListRow("verdict", VERDICT[verdictKey].label.toLowerCase(), { status: true })
  );

  return (
    '<aside class="book-detail__meta" aria-label="Book details">\n' +
    '            <div class="idx-list">\n              ' +
    rows.join("\n              ") +
    "\n            </div>\n          </aside>"
  );
}

export function renderPage(book, meta) {
  var slug = book.slug;
  var title = book.title;
  var statusKey = STATUS[meta.status] ? meta.status : "finished";
  var verdictKey = VERDICT[meta.verdict] ? meta.verdict : "solid";
  var readTypeKey = READ_TYPE[meta.readType] ? meta.readType : "educational";
  var lead =
    meta.lead || "On my reading list — notes and highlights for " + title + ".";
  var notes = meta.notes || "## Notes\n\nNo notes yet.";
  var highlights = meta.highlights || "## Highlights\n\nNo highlights yet.";

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)} — Books — Julian Kreth</title>
    <meta name="description" content="Notes and highlights from ${escapeHtml(title)}." />
    <link rel="canonical" href="https://kreth.work/books/${escapeHtml(slug)}/" />
    <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3EJK%3C/text%3E%3C/svg%3E" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,100..900&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="/styles.css" />
    <link rel="stylesheet" href="/components.css" />
    <link rel="stylesheet" href="/books/book-detail.css" />
  </head>
  <body>
    <div id="chrome-top"></div>
    <div class="layout">
      <div id="chrome-sidebar"></div>
      <div class="root">
        <main class="book-detail" data-book-slug="${escapeHtml(slug)}">
          <p class="exp-path"><a href="/books/" style="color: inherit; text-decoration: none">books</a> / ${escapeHtml(slug)}</p>

          <div class="exp-title">
            <h1 class="exp-title__heading">${escapeHtml(title)}</h1>
            <p class="exp-title__lead">${escapeHtml(lead)}</p>
          </div>

          <div class="book-detail__body">
            <div class="book-detail__main">
          <section class="exp-stage" aria-label="Book overview">
            <div class="exp-stage__panel">
              <div class="exp-stage__canvas">
                ${readTypeBadge(readTypeKey)}
                ${coverMarkup(title, book.image)}
              </div>
              <div class="exp-stage__controls">
                <div class="exp-control">
                  <span class="exp-control__label">Status</span>
                  <div class="exp-seg exp-seg--static" role="group" aria-label="Reading status">
                    ${segRow(["finished", "re-reading", "on-shelf"], statusKey, STATUS)}
                  </div>
                </div>
                <div class="exp-control">
                  <span class="exp-control__label">Verdict</span>
                  <div class="exp-seg exp-seg--static" role="group" aria-label="Verdict">
                    ${segRow(["recommend", "solid", "skip"], verdictKey, VERDICT)}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section class="exp-stage" aria-label="Notes and highlights">
            <div class="exp-stage__panel">
              <div class="exp-code" data-tabs>
                <div class="exp-code__bar">
                  <div class="exp-code__tabs" role="tablist">
                    <button class="exp-code__tab" role="tab" data-active="true" data-tab="notes" type="button">Notes.md</button>
                    <button class="exp-code__tab" role="tab" data-tab="highlights" type="button">Highlights.md</button>
                  </div>
                  <button class="exp-btn-compact" data-copy-active type="button">Copy</button>
                </div>
                <pre class="exp-code__body" data-panel="notes">${escapeHtml(notes)}</pre>
                <pre class="exp-code__body" data-panel="highlights" hidden>${escapeHtml(highlights)}</pre>
              </div>
            </div>
          </section>
            </div>

          ${idxListMarkup(meta, notes, highlights, statusKey, verdictKey)}
          </div>
        </main>
      </div>
    </div>

    <script src="/layout.js"></script>
    <script src="/books/book-detail.js"></script>
  </body>
</html>
`;
}

export function writeBookPage(root, book, meta) {
  var dir = path.join(root, "books", book.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), renderPage(book, meta), "utf8");
}
