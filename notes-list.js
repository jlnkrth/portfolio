// Renders the notes archive list from data/notes.json (+ drafts.json when present)
(function () {
  "use strict";

  var listEl = document.querySelector("[data-notes-list]");
  if (!listEl) return;

  function formatDate(iso) {
    if (!iso) return "";
    var d = new Date(iso + "T12:00:00");
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function archiveRow(item, opts) {
    var compact = opts && opts.compact;
    var name = item.viewTransitionName
      ? ' style="view-transition-name: ' + item.viewTransitionName + '"'
      : "";
    var current =
      opts && opts.currentPath && item.href === opts.currentPath
        ? ' aria-current="page"'
        : "";
    var meta = item.draft
      ? "Draft"
      : item.author && item.date
        ? item.author + " · " + formatDate(item.date)
        : item.author || formatDate(item.date);

    var rowClass =
      "notes-archive__row" +
      (compact ? " notes-archive__row--compact" : "") +
      (item.draft ? " notes-archive__row--draft" : "");

    if (compact) {
      return (
        '<a class="' +
        rowClass +
        '" href="' +
        item.href +
        '"' +
        name +
        current +
        '><span class="notes-archive__row-title">' +
        '<span class="notes-archive__row-title-inner">' +
        item.title +
        "</span></span></a>"
      );
    }

    return (
      '<a class="' +
      rowClass +
      '" href="' +
      item.href +
      '"' +
      name +
      current +
      '><span class="notes-archive__row-title">' +
      item.title +
      '</span><span class="notes-archive__row-meta">' +
      meta +
      "</span></a>"
    );
  }

  function buildIndexHtml(items) {
    var rows = items
      .map(function (item) {
        return archiveRow(item, { compact: true });
      })
      .join("");

    return (
      '<nav class="notes-index" aria-label="Article archive">' +
      '<div class="notes-index__head">' +
      '<a class="label notes-index__head-link" href="/notes/" aria-label="Open the Archive">' +
      '<span class="notes-index__title">Archive</span></a>' +
      "</div>" +
      '<div class="notes-index__list-wrap"><div class="notes-archive notes-archive--index" data-notes-list>' +
      rows +
      "</div></div></nav>"
    );
  }

  function render(published, drafts) {
    var items = (published || []).slice().sort(function (a, b) {
      return (b.date || "").localeCompare(a.date || "");
    });
    var draftItems = (drafts || []).slice();

    listEl.className = "notes-archive";
    var html = items
      .map(function (item) {
        return archiveRow(item);
      })
      .join("");

    if (draftItems.length) {
      html +=
        '<p class="notes-archive__drafts-label label">Drafts on this build</p>' +
        draftItems
          .map(function (item) {
            return archiveRow(item);
          })
          .join("");
    }

    listEl.innerHTML = html;

    var allForIndex = items.concat(draftItems);
    listEl.addEventListener("click", function (event) {
      var clicked = event.target.closest("a.notes-archive__row");
      if (!clicked) return;
      try {
        sessionStorage.setItem(
          "kreth-notes-index-html",
          buildIndexHtml(allForIndex)
        );
        sessionStorage.setItem("kreth-notes-index", "1");
      } catch (_) {}
    });
  }

  Promise.all([
    fetch("/data/notes.json?v=3").then(function (r) {
      return r.json();
    }),
    fetch("/data/drafts.json?v=1")
      .then(function (r) {
        return r.ok ? r.json() : { items: [] };
      })
      .catch(function () {
        return { items: [] };
      }),
  ])
    .then(function (pair) {
      render(pair[0].items || [], pair[1].items || []);
    })
    .catch(function () {
      listEl.innerHTML = '<p class="muted">Could not load notes.</p>';
    });
})();
