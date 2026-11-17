// Fieldnotes-style Work index: client list + detail shell.
(function () {
  "use strict";

  var listEl = document.querySelector("[data-work-list]");
  var detailEl = document.querySelector("[data-work-detail]");
  var layoutEl = document.querySelector(".layout--work-index");
  var toggleEl = document.querySelector(".work-shell__toggle");
  if (!listEl || !detailEl || !layoutEl) return;

  var catalog = {};
  var items = [];
  var selectedSlug = "";

  function hasText(value) {
    return typeof value === "string" && value.trim().length > 0;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function slugFromHash() {
    var raw = (location.hash || "").replace(/^#/, "").trim();
    try {
      return decodeURIComponent(raw);
    } catch (_) {
      return raw;
    }
  }

  function setHash(slug) {
    var next = slug ? "#" + encodeURIComponent(slug) : "";
    if ((location.hash || "") === next) return;
    if (next) history.replaceState(null, "", next);
    else history.replaceState(null, "", location.pathname + location.search);
  }

  function faviconFor(item) {
    if (item && hasText(item.image)) return item.image;
    var detail = catalog[item && item.slug];
    if (detail && hasText(detail.image)) return detail.image;
    return "";
  }

  function acquiredLabel(detail) {
    if (!detail) return "";
    if (hasText(detail.acquiredBy)) return "Acquired by " + detail.acquiredBy;
    if (detail.acquired) return "Acquired";
    return "";
  }

  function metaFor(item) {
    var detail = catalog[item.slug] || {};
    var chips = detail.chips || [];
    if (chips.length) return chips[0];
    return item.external === false ? "Internal" : "Client";
  }

  function renderList() {
    listEl.replaceChildren();
    items.forEach(function (item) {
      var row = document.createElement("button");
      row.type = "button";
      row.className = "work-archive__row";
      row.setAttribute("data-work-slug", item.slug);
      if (item.slug === selectedSlug) {
        row.setAttribute("aria-current", "true");
      }

      var iconSrc = faviconFor(item);
      if (iconSrc) {
        var icon = document.createElement("img");
        icon.className = "work-archive__icon";
        icon.src = iconSrc;
        icon.alt = "";
        icon.loading = "lazy";
        icon.decoding = "async";
        icon.width = 18;
        icon.height = 18;
        row.appendChild(icon);
      } else {
        var fallback = document.createElement("span");
        fallback.className = "work-archive__icon work-archive__icon--fallback";
        fallback.setAttribute("aria-hidden", "true");
        fallback.textContent = (item.title || "?").charAt(0);
        row.appendChild(fallback);
      }

      var title = document.createElement("span");
      title.className = "work-archive__title";
      var titleInner = document.createElement("span");
      titleInner.className = "work-archive__title-inner";
      titleInner.textContent = item.title || item.slug;
      title.appendChild(titleInner);

      var acquired = acquiredLabel(catalog[item.slug] || {});
      if (acquired) {
        var acquiredChip = document.createElement("span");
        acquiredChip.className = "work-archive__acquired";
        acquiredChip.textContent = acquired;
        title.appendChild(acquiredChip);
      }
      row.appendChild(title);

      var meta = document.createElement("span");
      meta.className = "work-archive__meta";
      meta.textContent = metaFor(item);
      row.appendChild(meta);

      row.addEventListener("click", function () {
        selectClient(item.slug, true);
      });

      listEl.appendChild(row);
    });
  }

  function emptyDetail() {
    detailEl.innerHTML =
      '<div class="work-detail work-detail--empty" role="status">' +
      '<p class="work-detail__empty">Select a client</p>' +
      "</div>";
  }

  function paragraphs(text) {
    var chunks = String(text || "")
      .split(/\n\s*\n/)
      .map(function (part) {
        return part.trim();
      })
      .filter(Boolean);
    if (!chunks.length) {
      return "<p>More detail coming soon.</p>";
    }
    return chunks
      .map(function (chunk) {
        return "<p>" + escapeHtml(chunk.replace(/\n/g, " ")) + "</p>";
      })
      .join("");
  }

  function renderDetail(slug) {
    var listItem = items.find(function (item) {
      return item.slug === slug;
    });
    var detail = catalog[slug] || {};
    var title = detail.title || (listItem && listItem.title) || slug;
    var href = detail.href || (listItem && listItem.href) || "";
    var lead = detail.lead || "";
    var chips = detail.chips || [];
    var screenshot = detail.screenshot || "";
    var body = detail.body || "";
    var acquired = acquiredLabel(detail);

    var acquiredChipHtml = acquired
      ? '<span class="work-detail__chip work-detail__chip--acquired">' +
        escapeHtml(acquired) +
        "</span>"
      : "";

    var chipsHtml = chips.length
      ? '<div class="work-detail__chips" aria-label="Project types">' +
        chips
          .map(function (chip) {
            return (
              '<span class="work-detail__chip">' + escapeHtml(chip) + "</span>"
            );
          })
          .join("") +
        "</div>"
      : "";

    var visitHtml = hasText(href)
      ? '<a class="work-detail__visit" href="' +
        escapeHtml(href) +
        '" target="_blank" rel="noopener noreferrer">' +
        "Visit site" +
        '<svg class="work-detail__visit-icon" width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
        '<path d="M6.5 3.5H3.5A1.5 1.5 0 0 0 2 5v7.5A1.5 1.5 0 0 0 3.5 14H11a1.5 1.5 0 0 0 1.5-1.5v-3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>' +
        '<path d="M9.5 2.5H13.5V6.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>' +
        '<path d="M8 8L13.5 2.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>' +
        "</svg></a>"
      : "";

    var shotHtml = screenshot
      ? '<div class="work-detail__shot">' +
        '<div class="work-detail__shot-chrome" aria-hidden="true">' +
        '<span class="work-detail__shot-dot"></span>' +
        '<span class="work-detail__shot-dot"></span>' +
        '<span class="work-detail__shot-dot"></span>' +
        "</div>" +
        '<div class="work-detail__shot-frame">' +
        '<img class="work-detail__shot-img" src="' +
        escapeHtml(screenshot) +
        '" alt="' +
        escapeHtml(title) +
        ' website" width="1440" height="900" decoding="async" loading="eager" />' +
        "</div></div>"
      : '<div class="work-detail__shot work-detail__shot--empty">' +
        '<p class="work-detail__shot-empty">' +
        (hasText(href) ? "Screenshot coming soon." : "No live site linked.") +
        "</p></div>";

    detailEl.innerHTML =
      '<article class="work-detail" data-work-slug="' +
      escapeHtml(slug) +
      '">' +
      shotHtml +
      '<div class="work-detail__body">' +
      '<div class="work-detail__head">' +
      '<div class="work-detail__heading-wrap">' +
      "<h1 class=\"work-detail__heading\">" +
      escapeHtml(title) +
      "</h1>" +
      acquiredChipHtml +
      "</div>" +
      visitHtml +
      "</div>" +
      (hasText(lead)
        ? '<p class="work-detail__lead">' + escapeHtml(lead) + "</p>"
        : "") +
      chipsHtml +
      '<div class="work-detail__notes">' +
      '<p class="work-detail__label">About</p>' +
      '<div class="work-detail__notes-scroll">' +
      paragraphs(body) +
      "</div></div></div></article>";

    var img = detailEl.querySelector(".work-detail__shot-img");
    if (img) {
      if (img.complete && img.naturalWidth > 0) {
        img.classList.add("is-loaded");
      } else {
        img.addEventListener(
          "load",
          function () {
            img.classList.add("is-loaded");
          },
          { once: true }
        );
        img.addEventListener(
          "error",
          function () {
            var frame = img.closest(".work-detail__shot");
            if (!frame) return;
            frame.classList.add("work-detail__shot--empty");
            frame.innerHTML =
              '<p class="work-detail__shot-empty">Screenshot unavailable.</p>';
          },
          { once: true }
        );
      }
    }
  }

  function selectClient(slug, fromClick) {
    if (!slug || !items.some(function (item) { return item.slug === slug; })) {
      selectedSlug = "";
      setHash("");
      emptyDetail();
      renderList();
      return;
    }

    selectedSlug = slug;
    if (fromClick) setHash(slug);
    renderList();
    renderDetail(slug);
    if (toggleEl) toggleEl.hidden = false;

    var active = listEl.querySelector(
      '.work-archive__row[data-work-slug="' + slug + '"]'
    );
    if (active && typeof active.scrollIntoView === "function") {
      active.scrollIntoView({ block: "nearest" });
    }
  }

  function bindToggle() {
    if (!toggleEl) return;
    toggleEl.addEventListener("click", function () {
      var expanded = layoutEl.classList.toggle("layout--work-index-expanded");
      toggleEl.setAttribute("aria-pressed", expanded ? "true" : "false");
      toggleEl.setAttribute(
        "aria-label",
        expanded ? "Collapse work panel" : "Expand work panel"
      );
      try {
        if (expanded) sessionStorage.setItem("kreth-work-index-expanded", "1");
        else sessionStorage.removeItem("kreth-work-index-expanded");
      } catch (_) {}
    });

    try {
      if (sessionStorage.getItem("kreth-work-index-expanded") === "1") {
        layoutEl.classList.add("layout--work-index-expanded");
        toggleEl.setAttribute("aria-pressed", "true");
        toggleEl.setAttribute("aria-label", "Collapse work panel");
      }
    } catch (_) {}
  }

  function onHashChange() {
    var slug = slugFromHash();
    if (slug === selectedSlug) return;
    if (slug) selectClient(slug, false);
    else {
      selectedSlug = "";
      emptyDetail();
      renderList();
    }
  }

  Promise.all([
    fetch("/data/collections.json")
      .then(function (r) {
        if (!r.ok) throw new Error("collections");
        return r.json();
      })
      .catch(function () {
        return {};
      }),
    fetch("/data/work.json")
      .then(function (r) {
        if (!r.ok) throw new Error("work");
        return r.json();
      })
      .catch(function () {
        return {};
      }),
  ]).then(function (pair) {
    catalog = pair[1] || {};
    var work = (pair[0] && pair[0].work) || {};
    items = Array.isArray(work.items) ? work.items.slice() : [];

    // Prefer catalog order; fall back to work.json keys.
    if (!items.length) {
      items = Object.keys(catalog).map(function (slug) {
        return {
          slug: slug,
          title: catalog[slug].title || slug,
          href: catalog[slug].href || "",
          image: catalog[slug].image || "",
          external: true,
        };
      });
    }

    bindToggle();
    renderList();

    var initial = slugFromHash();
    if (initial) {
      selectClient(initial, false);
    } else if (items.length) {
      selectClient(items[0].slug, true);
    } else {
      emptyDetail();
    }

    if (
      window.krethWorkViewMorph &&
      window.krethWorkViewMorph.hasPending("desk-to-list")
    ) {
      window.krethWorkViewMorph.playPending({
        dir: "desk-to-list",
        getTarget: function (slug) {
          return listEl.querySelector(
            '.work-archive__row[data-work-slug="' +
              slug +
              '"] .work-archive__icon'
          );
        },
      });
    }

    window.addEventListener("hashchange", onHashChange);
  });
})();
