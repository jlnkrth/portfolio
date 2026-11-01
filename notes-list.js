// Renders the notes archive list from data/notes.json (+ upcoming + drafts).
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
    var meta;
    if (item.draft) {
      meta = '<span class="notes-archive__chip">Draft</span>';
    } else if (item.soon) {
      meta = '<span class="notes-archive__chip">Coming soon</span>';
    } else if (item.author && item.date) {
      meta = item.author + " · " + formatDate(item.date);
    } else {
      meta = item.author || formatDate(item.date);
    }

    var rowClass =
      "notes-archive__row" +
      (compact ? " notes-archive__row--compact" : "") +
      (item.draft ? " notes-archive__row--draft" : "") +
      (item.soon ? " notes-archive__row--soon" : "");

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
      '<nav class="notes-index" aria-label="Fieldnotes">' +
      '<div class="notes-index__head">' +
      '<a class="label notes-index__head-link" href="/notes/" aria-label="Open Fieldnotes">' +
      '<span class="notes-index__title">Fieldnotes</span></a>' +
      "</div>" +
      '<div class="notes-index__list-wrap"><div class="notes-archive notes-archive--index" data-notes-list>' +
      rows +
      "</div></div></nav>"
    );
  }

  function render(published, upcoming, drafts) {
    var publishedItems = (published || []).slice().sort(function (a, b) {
      return (b.date || "").localeCompare(a.date || "");
    });
    var soonItems = (upcoming || []).slice();
    var draftItems = (drafts || []).slice();

    listEl.className = "notes-archive";
    // Fieldnotes index: shipping queue only. Published notes stay on Home /
    // article rails (layout.js reads notes.json directly).
    var pageItems = soonItems.concat(draftItems);
    listEl.innerHTML = pageItems
      .map(function (item) {
        return archiveRow(item);
      })
      .join("");

    var allForIndex = publishedItems.concat(soonItems).concat(draftItems);
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

  function fetchJson(url) {
    return fetch(url)
      .then(function (r) {
        return r.ok ? r.json() : { items: [] };
      })
      .catch(function () {
        return { items: [] };
      });
  }

  Promise.all([
    fetch("/data/notes.json?v=4").then(function (r) {
      if (!r.ok) throw new Error("notes");
      return r.json();
    }),
    fetchJson("/data/notes-upcoming.json?v=1"),
    fetchJson("/data/drafts.json?v=1"),
  ])
    .then(function (triple) {
      render(
        triple[0].items || [],
        triple[1].items || [],
        triple[2].items || []
      );
    })
    .catch(function () {
      listEl.innerHTML = '<p class="muted">Could not load notes.</p>';
    });
})();
