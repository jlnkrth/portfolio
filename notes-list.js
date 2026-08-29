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
        item.title +
        "</span></a>"
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
      '<nav class="notes-index" aria-label="Notes index">' +
      '<div class="notes-index__head">' +
      '<a class="label notes-index__head-link" href="/notes/" aria-label="Back to all Notes">' +
      '<span class="notes-index__back-prefix" aria-hidden="true">' +
      '<svg class="icon icon-tabler notes-index__back-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M5 12h14"/><path d="M5 12l6 6"/><path d="M5 12l6 -6"/>' +
      "</svg><span class=\"notes-index__back-text\">Back to all</span></span>" +
      '<span class="notes-index__title">Notes</span></a>' +
      "</div>" +
      '<div class="notes-index__list-wrap"><div class="notes-archive notes-archive--index" data-notes-list>' +
      rows +
      "</div></div></nav>"
    );
  }

  fetch("/data/notes.json")
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
