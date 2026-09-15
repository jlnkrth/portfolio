// Renders the notes archive list from data/notes.json
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
    var meta =
      item.author && item.date
        ? item.author + " · " + formatDate(item.date)
        : item.author || formatDate(item.date);

    if (compact) {
      return (
        '<a class="notes-archive__row notes-archive__row--compact" href="' +
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
      '<a class="notes-archive__row" href="' +
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

  fetch("/data/notes.json?v=2")
    .then(function (r) {
      return r.json();
    })
    .then(function (data) {
      var items = (data.items || []).slice().sort(function (a, b) {
        return (b.date || "").localeCompare(a.date || "");
      });

      listEl.className = "notes-archive";
      listEl.innerHTML = items
        .map(function (item) {
          return archiveRow(item);
        })
        .join("");

      listEl.addEventListener("click", function (event) {
        var clicked = event.target.closest("a.notes-archive__row");
        if (!clicked) return;
        try {
          sessionStorage.setItem("kreth-notes-index-html", buildIndexHtml(items));
          sessionStorage.setItem("kreth-notes-index", "1");
        } catch (_) {}
      });
    })
    .catch(function () {
      listEl.innerHTML = '<p class="muted">Could not load notes.</p>';
    });
})();
