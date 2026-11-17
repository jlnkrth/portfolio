// Client sticker → project card (screenshot, chips, scrollable notes).
(function () {
  if (window.__workModal) return;
  window.__workModal = true;

  var root = null;
  var dialog = null;
  var scrollEl = null;
  var shotFrame = null;
  var titleEl = null;
  var leadEl = null;
  var acquiredEl = null;
  var chipsEl = null;
  var notesEl = null;
  var visitEl = null;
  var closeBtn = null;
  var lastFocus = null;
  var isOpen = false;
  var dataPromise = null;

  function ensureCss() {
    if (document.querySelector('link[href^="/work/work-modal.css"]')) return;
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/work/work-modal.css?v=9";
    document.head.appendChild(link);
  }

  function loadData() {
    if (!dataPromise) {
      dataPromise = fetch("/data/work.json")
        .then(function (response) {
          if (!response.ok) throw new Error("work");
          return response.json();
        })
        .catch(function () {
          return {};
        });
    }
    return dataPromise;
  }

  function shotSrc(item) {
    if (item && typeof item.screenshot === "string" && item.screenshot.trim()) {
      return item.screenshot.trim();
    }
    return "";
  }

  function mount() {
    if (root) return;

    root = document.createElement("div");
    root.className = "work-modal";
    root.hidden = true;

    var backdrop = document.createElement("button");
    backdrop.className = "work-modal__backdrop";
    backdrop.type = "button";
    backdrop.setAttribute("aria-label", "Close");
    backdrop.addEventListener("click", close);

    dialog = document.createElement("div");
    dialog.className = "work-modal__dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "work-modal-title");

    closeBtn = document.createElement("button");
    closeBtn.className = "work-modal__close";
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "Close");
    closeBtn.innerHTML =
      '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
    closeBtn.addEventListener("click", close);

    scrollEl = document.createElement("div");
    scrollEl.className = "work-modal__scroll";

    var tray = document.createElement("div");
    tray.className = "work-modal__tray";
    var panel = document.createElement("div");
    panel.className = "work-modal__panel";

    var shot = document.createElement("div");
    shot.className = "work-modal__shot";
    var chrome = document.createElement("div");
    chrome.className = "work-modal__shot-chrome";
    chrome.setAttribute("aria-hidden", "true");
    for (var i = 0; i < 3; i++) {
      var dot = document.createElement("span");
      dot.className = "work-modal__shot-dot";
      chrome.appendChild(dot);
    }
    shotFrame = document.createElement("div");
    shotFrame.className = "work-modal__shot-frame";
    shot.appendChild(chrome);
    shot.appendChild(shotFrame);

    var bodyWrap = document.createElement("div");
    bodyWrap.className = "work-modal__body-wrap";

    var head = document.createElement("div");
    head.className = "work-modal__head";
    var headingWrap = document.createElement("div");
    headingWrap.className = "work-modal__heading-wrap";
    titleEl = document.createElement("h2");
    titleEl.className = "work-modal__heading";
    titleEl.id = "work-modal-title";
    acquiredEl = document.createElement("span");
    acquiredEl.className = "work-modal__chip work-modal__chip--acquired";
    acquiredEl.hidden = true;
    headingWrap.appendChild(titleEl);
    headingWrap.appendChild(acquiredEl);

    visitEl = document.createElement("a");
    visitEl.className = "work-modal__visit";
    visitEl.target = "_blank";
    visitEl.rel = "noopener noreferrer";
    visitEl.appendChild(document.createTextNode("Visit site"));
    var visitIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    visitIcon.setAttribute("class", "work-modal__visit-icon");
    visitIcon.setAttribute("width", "12");
    visitIcon.setAttribute("height", "12");
    visitIcon.setAttribute("viewBox", "0 0 16 16");
    visitIcon.setAttribute("fill", "none");
    visitIcon.setAttribute("aria-hidden", "true");
    visitIcon.innerHTML =
      '<path d="M6.5 3.5H3.5A1.5 1.5 0 0 0 2 5v7.5A1.5 1.5 0 0 0 3.5 14H11a1.5 1.5 0 0 0 1.5-1.5v-3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>' +
      '<path d="M9.5 2.5H13.5V6.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="M8 8L13.5 2.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>';
    visitEl.appendChild(visitIcon);
    head.appendChild(headingWrap);
    head.appendChild(visitEl);

    leadEl = document.createElement("p");
    leadEl.className = "work-modal__lead";

    chipsEl = document.createElement("div");
    chipsEl.className = "work-modal__chips";
    chipsEl.setAttribute("aria-label", "Project types");

    var notes = document.createElement("div");
    notes.className = "work-modal__notes";
    var notesLabel = document.createElement("p");
    notesLabel.className = "work-modal__label";
    notesLabel.textContent = "About";
    notesEl = document.createElement("div");
    notesEl.className = "work-modal__notes-scroll";
    notesEl.tabIndex = 0;
    notes.appendChild(notesLabel);
    notes.appendChild(notesEl);

    bodyWrap.appendChild(head);
    bodyWrap.appendChild(leadEl);
    bodyWrap.appendChild(chipsEl);
    bodyWrap.appendChild(notes);

    panel.appendChild(shot);
    panel.appendChild(bodyWrap);
    tray.appendChild(panel);
    scrollEl.appendChild(tray);
    dialog.appendChild(closeBtn);
    dialog.appendChild(scrollEl);
    root.appendChild(backdrop);
    root.appendChild(dialog);
    document.body.appendChild(root);
  }

  function hasText(value) {
    return typeof value === "string" && value.trim().length > 0;
  }

  function acquiredLabel(item) {
    if (!item) return "";
    if (hasText(item.acquiredBy)) return "Acquired by " + item.acquiredBy;
    if (item.acquired) return "Acquired";
    return "";
  }

  function renderShot(title, item) {
    shotFrame.replaceChildren();
    var src = shotSrc(item);
    if (!src) {
      var empty = document.createElement("div");
      empty.className = "work-modal__shot-empty";
      empty.textContent = item && item.href
        ? "Screenshot coming soon."
        : "No live site linked for this project.";
      shotFrame.appendChild(empty);
      return;
    }
    var img = document.createElement("img");
    img.className = "work-modal__shot-img";
    img.alt = title ? title + " website" : "Website screenshot";
    img.decoding = "async";
    img.loading = "eager";
    img.width = 1440;
    img.height = 900;
    img.src = src;
    img.addEventListener("load", function () {
      img.classList.add("is-loaded");
    });
    img.addEventListener("error", function () {
      shotFrame.replaceChildren();
      var fail = document.createElement("div");
      fail.className = "work-modal__shot-empty";
      fail.textContent = "Screenshot unavailable right now.";
      shotFrame.appendChild(fail);
    });
    shotFrame.appendChild(img);
  }

  function renderChips(chips) {
    chipsEl.replaceChildren();
    if (!chips || !chips.length) {
      chipsEl.hidden = true;
      return;
    }
    chipsEl.hidden = false;
    chips.forEach(function (label) {
      var chip = document.createElement("span");
      chip.className = "work-modal__chip";
      chip.textContent = label;
      chipsEl.appendChild(chip);
    });
  }

  function renderBody(text) {
    notesEl.replaceChildren();
    notesEl.scrollTop = 0;
    var chunks = String(text || "")
      .split(/\n\s*\n/)
      .map(function (part) {
        return part.trim();
      })
      .filter(Boolean);
    if (!chunks.length) {
      var p = document.createElement("p");
      p.textContent = "More detail coming soon.";
      notesEl.appendChild(p);
      return;
    }
    chunks.forEach(function (chunk) {
      var p = document.createElement("p");
      p.textContent = chunk.replace(/\n/g, " ");
      notesEl.appendChild(p);
    });
  }

  function render(slug, catalog, fallbackTitle) {
    var item = (catalog && catalog[slug]) || {};
    var title = item.title || fallbackTitle || slug;
    titleEl.textContent = title;

    var acquired = acquiredLabel(item);
    if (acquired) {
      acquiredEl.hidden = false;
      acquiredEl.textContent = acquired;
    } else {
      acquiredEl.hidden = true;
      acquiredEl.textContent = "";
    }

    if (hasText(item.lead)) {
      leadEl.hidden = false;
      leadEl.textContent = item.lead;
    } else {
      leadEl.hidden = true;
      leadEl.textContent = "";
    }

    if (hasText(item.href)) {
      visitEl.hidden = false;
      visitEl.href = item.href;
    } else {
      visitEl.hidden = true;
      visitEl.removeAttribute("href");
    }

    renderShot(title, item);
    renderChips(item.chips || []);
    renderBody(item.body || "");
  }

  function show() {
    mount();
    if (root.parentNode !== document.body) document.body.appendChild(root);
    lastFocus = document.activeElement;
    root.hidden = false;
    isOpen = true;
    document.body.classList.add("work-modal-open");
    scrollEl.scrollTop = 0;
    closeBtn.focus({ preventScroll: true });
  }

  function close() {
    if (!isOpen || !root) return;
    isOpen = false;
    root.hidden = true;
    document.body.classList.remove("work-modal-open");
    if (lastFocus && typeof lastFocus.focus === "function") {
      lastFocus.focus({ preventScroll: true });
    }
  }

  function focusables() {
    return Array.prototype.filter.call(
      dialog.querySelectorAll(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      ),
      function (el) {
        return !el.closest("[hidden]");
      }
    );
  }

  function trapTab(event) {
    var nodes = focusables();
    if (!nodes.length) return;
    var first = nodes[0];
    var last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function open(slug, fallbackTitle) {
    ensureCss();
    show();
    titleEl.textContent = fallbackTitle || "Loading…";
    acquiredEl.hidden = true;
    acquiredEl.textContent = "";
    leadEl.hidden = true;
    leadEl.textContent = "";
    visitEl.hidden = true;
    renderChips([]);
    renderBody("");
    renderShot(fallbackTitle || "", null);
    loadData()
      .then(function (catalog) {
        if (!isOpen) return;
        render(slug, catalog, fallbackTitle);
      })
      .catch(function () {
        if (!isOpen) return;
        titleEl.textContent = fallbackTitle || "Project";
        leadEl.hidden = false;
        leadEl.textContent = "Could not load this project.";
      });
  }

  function onClick(event) {
    if (event.defaultPrevented) return;
    if (event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    var link =
      event.target.closest && event.target.closest("a.sticker[data-work-slug]");
    if (!link) return;
    var slug = link.getAttribute("data-work-slug");
    if (!slug) return;
    event.preventDefault();
    event.stopPropagation();
    open(slug, link.getAttribute("aria-label") || "");
  }

  function onKeydown(event) {
    if (!isOpen) return;
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key === "Tab") trapTab(event);
  }

  ensureCss();
  document.addEventListener("click", onClick, true);
  document.addEventListener("keydown", onKeydown);

  if (document.querySelector("[data-sticker-board], a.sticker")) {
    loadData();
  }

  window.WorkModal = { open: open, close: close };
})();
