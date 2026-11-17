// Homepage Writing column — same soon queue + row chrome as Fieldnotes.
(function () {
  "use strict";

  var listEl = document.querySelector("[data-writing-list]");
  if (!listEl) return;

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function row(item) {
    var name = /^[a-zA-Z0-9_-]+$/.test(item.viewTransitionName || "")
      ? ' style="view-transition-name: ' + item.viewTransitionName + '"'
      : "";
    return (
      '<a class="notes-archive__row notes-archive__row--soon" href="' +
      escapeHtml(item.href) +
      '"' +
      name +
      ">" +
      '<span class="notes-archive__row-title">' +
      '<span class="notes-archive__row-title-inner">' +
      escapeHtml(item.title) +
      "</span></span>" +
      '<span class="notes-archive__row-meta">' +
      '<span class="notes-archive__chip">Coming soon</span>' +
      "</span></a>"
    );
  }

  listEl.classList.add("notes-archive");

  var limit = parseInt(listEl.getAttribute("data-writing-limit"), 10);

  function markOverflow() {
    listEl.querySelectorAll(".notes-archive__row").forEach(function (rowEl) {
      var title = rowEl.querySelector(".notes-archive__row-title");
      var inner = rowEl.querySelector(".notes-archive__row-title-inner");
      if (!title || !inner) return;
      rowEl.classList.toggle(
        "is-overflowing",
        inner.scrollWidth - title.clientWidth > 1
      );
    });
  }

  fetch("/data/notes-upcoming.json?v=1")
    .then(function (response) {
      if (!response.ok) throw new Error("upcoming");
      return response.json();
    })
    .then(function (data) {
      var items = (data.items || []).slice();
      if (limit > 0) items = items.slice(0, limit);
      listEl.innerHTML = items.map(row).join("");
      requestAnimationFrame(function () {
        markOverflow();
        if (typeof window.krethSyncHomeBottomBand === "function") {
          window.krethSyncHomeBottomBand();
        }
      });
    })
    .catch(function () {
      listEl.innerHTML = '<p class="muted">Could not load writing.</p>';
    });

  window.addEventListener("resize", function () {
    requestAnimationFrame(markOverflow);
  });
})();
