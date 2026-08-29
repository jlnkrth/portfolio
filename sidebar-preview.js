// Sidebar collection links with hover preview modals (matches kreth.webflow.io)
var SIDEBAR_LIST_CACHE_KEY = "kreth-sidebar-list-html";
var SIDEBAR_LIST_CACHE_VERSION = "3";
var SIDEBAR_LIST_CACHE_VERSION_KEY = "kreth-sidebar-list-version";

function sidebarListCacheIsCurrent() {
  try {
    return (
      sessionStorage.getItem(SIDEBAR_LIST_CACHE_VERSION_KEY) ===
      SIDEBAR_LIST_CACHE_VERSION
    );
  } catch (_) {
    return false;
  }
}

function listLooksStale(list) {
  if (!list || !list.children.length) return true;
  // Old "Projects (coming soon)" rows must never stick around.
  if (list.querySelector(".is-disabled, .collections__meta")) return true;
  var projects = list.querySelector('a.collections__link[href="/projects/"]');
  return !projects;
}

window.initSidebarPreview = function initSidebarPreview() {
  var list = document.querySelector("[data-sidebar-list]");
  if (!list) return;

  // Allow a forced rebuild when chrome restored an outdated list.
  if (list.dataset.sidebarReady === "1" && !listLooksStale(list)) return;

  function restoreListCache() {
    try {
      if (!sidebarListCacheIsCurrent()) {
        sessionStorage.removeItem(SIDEBAR_LIST_CACHE_KEY);
        return false;
      }
      var cached = sessionStorage.getItem(SIDEBAR_LIST_CACHE_KEY);
      if (!cached) return false;
      list.innerHTML = cached;
      if (listLooksStale(list)) {
        list.innerHTML = "";
        sessionStorage.removeItem(SIDEBAR_LIST_CACHE_KEY);
        return false;
      }
      return list.children.length > 0;
    } catch (_) {
      return false;
    }
  }

  function saveListCache() {
    try {
      sessionStorage.setItem(
        SIDEBAR_LIST_CACHE_VERSION_KEY,
        SIDEBAR_LIST_CACHE_VERSION
      );
      sessionStorage.setItem(SIDEBAR_LIST_CACHE_KEY, list.innerHTML);
    } catch (_) {}
    if (window.persistChromeCache) window.persistChromeCache();
  }

  function markReady() {
    list.dataset.sidebarReady = "1";
    saveListCache();
  }

  function renderFromNetwork() {
    return Promise.all([
      fetch("/data/sidebar.json?v=" + SIDEBAR_LIST_CACHE_VERSION).then(
        function (r) {
          return r.json();
        }
      ),
      fetch("/data/collections.json?v=" + SIDEBAR_LIST_CACHE_VERSION).then(
        function (r) {
          return r.json();
        }
      ),
    ]).then(function (results) {
      var sidebar = results[0];
      var collections = results[1];
      list.innerHTML = "";
      delete list.dataset.sidebarReady;

      sidebar.links.forEach(function (link) {
        list.appendChild(buildRow(link, collections));
      });

      markReady();
    });
  }

  if (!listLooksStale(list) && sidebarListCacheIsCurrent()) {
    markReady();
    return;
  }

  if (restoreListCache()) {
    markReady();
    return;
  }

  renderFromNetwork().catch(function () {});
};

function buildRow(link, collections) {
  var li = document.createElement("li");
  li.className = "collections__row";

  if (link.disabled) {
    var disabled = document.createElement("span");
    disabled.className = "collections__link is-disabled";
    disabled.innerHTML =
      link.label +
      (link.comingSoon
        ? ' <span class="collections__meta">(coming soon)</span>'
        : "");
    li.appendChild(disabled);
  } else {
    var anchor = document.createElement("a");
    anchor.className = "collections__link";
    anchor.href = link.href;
    anchor.textContent = link.label;
    if (link.external) {
      anchor.target = "_blank";
      anchor.rel = "noreferrer";
    }
    li.appendChild(anchor);
  }

  li.appendChild(buildModal(link, collections));
  return li;
}

function buildModal(link, collections) {
  var modal = document.createElement("div");
  modal.className = "collections__modal";
  modal.setAttribute("aria-hidden", "true");

  var head = document.createElement("div");
  head.className = "collections__modal-head";

  var title = document.createElement("span");
  title.className = "collections__modal-title";
  title.textContent = link.modalTitle || link.label;
  head.appendChild(title);

  var meta = document.createElement("span");
  meta.className = "collections__modal-meta";
  if (link.meta) {
    meta.textContent = link.meta;
  } else if (link.collection && collections[link.collection]) {
    var col = collections[link.collection];
    var n = Array.isArray(col.items) ? col.items.length : col.count || 0;
    meta.textContent = n + " items";
  }
  head.appendChild(meta);
  modal.appendChild(head);

  var body = document.createElement("div");
  body.className = "collections__modal-body";

  if (link.previewImage) {
    body.classList.add("collections__modal-body--screenshot");
    var shot = document.createElement("img");
    shot.className = "collections__modal-shot";
    shot.src = link.previewImage;
    shot.alt = "";
    shot.loading = "lazy";
    body.appendChild(shot);
  } else if (link.collection && collections[link.collection]) {
    var col = collections[link.collection];
    var kind = col.previewKind || link.collection;
    body.classList.add("collections__modal-body--" + kind);

    var grid = document.createElement("div");
    grid.className = "collections__modal-grid";

    col.items
      .filter(function (item) {
        return kind === "oss" ? true : Boolean(item.image);
      })
      .slice(0, 4)
      .forEach(function (item) {
        var card = document.createElement("a");
        card.className = "collections__modal-card collections__modal-card--" + kind;
        card.href = item.href;
        card.setAttribute("aria-label", item.title);
        if (item.external || (item.href && item.href.startsWith("http"))) {
          card.target = "_blank";
          card.rel = "noreferrer";
        }

        if (kind === "book") {
          var img = document.createElement("img");
          img.src = item.image;
          img.alt = "";
          img.loading = "lazy";
          card.appendChild(img);
        } else if (kind === "oss") {
          var mark = document.createElement("span");
          mark.className = "collections__modal-card-mark";
          mark.textContent = item.mark || item.title;
          card.appendChild(mark);
        } else {
          card.style.backgroundImage = 'url("' + item.image + '")';
        }

        grid.appendChild(card);
      });

    body.appendChild(grid);
  }

  modal.appendChild(body);

  var foot = document.createElement("div");
  foot.className = "collections__modal-foot";

  var footLabel = document.createElement("span");
  footLabel.textContent = link.footerLabel || link.label;
  foot.appendChild(footLabel);

  if (link.footerNote) {
    var note = document.createElement("span");
    note.className = "collections__modal-note";
    note.textContent = link.footerNote;
    foot.appendChild(note);
  } else if (link.showUpdated) {
    var updated = document.createElement("span");
    updated.className = "collections__modal-updated";
    updated.innerHTML =
      '<span class="collections__modal-updated-label">Last updated:</span> 10 hours ago';
    foot.appendChild(updated);
  }

  modal.appendChild(foot);
  return modal;
}

if (document.querySelector("[data-sidebar-list]")) {
  window.initSidebarPreview();
}
