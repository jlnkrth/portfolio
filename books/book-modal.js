// Opens a book overview in a modal instead of navigating to the detail page.
(function () {
  if (window.__bookModal) return;
  window.__bookModal = true;

  var STATUS = [
    { key: "finished", label: "Finished", tone: "green" },
    { key: "re-reading", label: "Re-reading", tone: "orange" },
    { key: "on-shelf", label: "On the shelf", tone: "grey" },
  ];

  var VERDICT = [
    { key: "recommend", label: "Recommend", tone: "purple" },
    { key: "solid", label: "Solid", tone: "blue" },
    { key: "skip", label: "Skip", tone: "grey" },
  ];

  var READ = {
    entertaining: { label: "Entertaining", tone: "orange", emoji: "🍿" },
    educational: { label: "Educational", tone: "purple", emoji: "🎓" },
    "must-read": { label: "Must Read", tone: "gold", emoji: "⭐" },
  };

  var root = null;
  var dialog = null;
  var scrollEl = null;
  var canvasEl = null;
  var badgeEl = null;
  var statusEl = null;
  var verdictEl = null;
  var titleEl = null;
  var leadEl = null;
  var closeBtn = null;
  var lastFocus = null;
  var isOpen = false;
  var dataPromise = null;

  function ensureCss() {
    if (document.querySelector('link[href^="/books/book-modal.css"]')) return;
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/books/book-modal.css";
    document.head.appendChild(link);
  }

  function slugFromHref(href) {
    if (!href || href.charAt(0) === "#") return "";
    var path = href.split("?")[0].split("#")[0];
    var match = path.match(/\/books\/([^/]+)\/?$/);
    if (!match || match[1] === "index.html") return "";
    try {
      return decodeURIComponent(match[1]);
    } catch (_) {
      return match[1];
    }
  }

  function loadData() {
    if (!dataPromise) {
      dataPromise = Promise.all([
        fetch("/data/books.json").then(function (response) {
          if (!response.ok) throw new Error("books");
          return response.json();
        }),
        fetch("/data/collections.json").then(function (response) {
          if (!response.ok) throw new Error("collections");
          return response.json();
        }),
      ]).then(function (pair) {
        var catalog = {};
        var items = (pair[1].books && pair[1].books.items) || [];
        items.forEach(function (item) {
          if (item && item.slug) catalog[item.slug] = item;
        });
        return { books: pair[0], catalog: catalog };
      });
    }
    return dataPromise;
  }

  function pill(label, tone, active) {
    var el = document.createElement("span");
    el.className = "book-modal__pill";
    el.setAttribute("data-active", active ? "true" : "false");
    el.setAttribute("data-tone", tone);
    el.textContent = label;
    return el;
  }

  function fillControl(slot, label, options, activeKey) {
    var match = null;
    options.forEach(function (option) {
      if (option.key === activeKey) match = option;
    });
    slot.replaceChildren();
    if (!match) {
      slot.hidden = true;
      return;
    }
    slot.hidden = false;
    var wrap = document.createElement("div");
    wrap.className = "book-modal__control";
    var heading = document.createElement("p");
    heading.className = "book-modal__label";
    heading.textContent = label;
    wrap.appendChild(heading);
    wrap.appendChild(pill(match.label, match.tone, true));
    slot.appendChild(wrap);
  }

  function mount() {
    if (root) return;

    root = document.createElement("div");
    root.className = "book-modal";
    root.hidden = true;

    var backdrop = document.createElement("button");
    backdrop.className = "book-modal__backdrop";
    backdrop.type = "button";
    backdrop.setAttribute("aria-label", "Close");
    backdrop.addEventListener("click", close);

    dialog = document.createElement("div");
    dialog.className = "book-modal__dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "book-modal-title");

    closeBtn = document.createElement("button");
    closeBtn.className = "book-modal__close";
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "Close");
    closeBtn.innerHTML =
      '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
    closeBtn.addEventListener("click", close);

    scrollEl = document.createElement("div");
    scrollEl.className = "book-modal__scroll";

    var tray = document.createElement("div");
    tray.className = "book-modal__tray";
    var panel = document.createElement("div");
    panel.className = "book-modal__panel";
    var top = document.createElement("div");
    top.className = "book-modal__top";

    canvasEl = document.createElement("div");
    canvasEl.className = "book-modal__canvas";
    badgeEl = document.createElement("div");
    badgeEl.className = "book-modal__badge-slot";
    badgeEl.hidden = true;
    canvasEl.appendChild(badgeEl);
    var facts = document.createElement("div");
    facts.className = "book-modal__facts";
    statusEl = document.createElement("div");
    verdictEl = document.createElement("div");
    facts.appendChild(statusEl);
    facts.appendChild(verdictEl);

    var bottom = document.createElement("div");
    bottom.className = "book-modal__bottom";
    titleEl = document.createElement("h2");
    titleEl.className = "book-modal__heading";
    titleEl.id = "book-modal-title";
    leadEl = document.createElement("p");
    leadEl.className = "book-modal__lead";
    bottom.appendChild(titleEl);
    bottom.appendChild(leadEl);

    top.appendChild(canvasEl);
    top.appendChild(facts);
    panel.appendChild(top);
    panel.appendChild(bottom);
    tray.appendChild(panel);

    scrollEl.appendChild(tray);
    dialog.appendChild(closeBtn);
    dialog.appendChild(scrollEl);
    root.appendChild(backdrop);
    root.appendChild(dialog);
    document.body.appendChild(root);
  }

  function renderBadge(readType) {
    var spec = READ[readType];
    badgeEl.replaceChildren();
    if (!spec) {
      badgeEl.hidden = true;
      return;
    }
    badgeEl.hidden = false;
    badgeEl.appendChild(pill(spec.emoji + " " + spec.label, spec.tone, true));
  }

  function renderCover(title, image) {
    canvasEl.replaceChildren(badgeEl);
    if (image) {
      var img = document.createElement("img");
      img.className = "book-modal__cover";
      img.src = image;
      img.alt = title ? title + " book cover" : "";
      canvasEl.appendChild(img);
    } else {
      var placeholder = document.createElement("div");
      placeholder.className = "book-modal__placeholder";
      placeholder.textContent = title ? title.charAt(0) : "?";
      canvasEl.appendChild(placeholder);
    }
  }

  function hasText(value) {
    return typeof value === "string" && value.trim().length > 0;
  }

  function render(slug, data, fallbackTitle) {
    var book = (data.books && data.books[slug]) || {};
    var item = (data.catalog && data.catalog[slug]) || {};
    var title = item.title || fallbackTitle || slug;
    titleEl.textContent = title;
    if (hasText(book.lead)) {
      leadEl.hidden = false;
      leadEl.textContent = book.lead;
    } else {
      leadEl.hidden = true;
      leadEl.textContent = "";
    }
    renderCover(title, item.image || "");
    renderBadge(book.readType || "");
    fillControl(statusEl, "Status", STATUS, book.status || "");
    fillControl(verdictEl, "Verdict", VERDICT, book.verdict || "");
  }

  function show() {
    mount();
    if (root.parentNode !== document.body) document.body.appendChild(root);
    lastFocus = document.activeElement;
    root.hidden = false;
    isOpen = true;
    document.body.classList.add("book-modal-open");
    scrollEl.scrollTop = 0;
    closeBtn.focus({ preventScroll: true });
  }

  function close() {
    if (!isOpen || !root) return;
    isOpen = false;
    root.hidden = true;
    document.body.classList.remove("book-modal-open");
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
    leadEl.hidden = true;
    leadEl.textContent = "";
    renderCover(fallbackTitle || "", "");
    renderBadge("");
    fillControl(statusEl, "Status", STATUS, "");
    fillControl(verdictEl, "Verdict", VERDICT, "");
    loadData()
      .then(function (data) {
        if (!isOpen) return;
        render(slug, data, fallbackTitle);
      })
      .catch(function () {
        if (!isOpen) return;
        titleEl.textContent = fallbackTitle || "Book";
        leadEl.hidden = false;
        leadEl.textContent = "Could not load this book.";
      });
  }

  function onClick(event) {
    if (event.defaultPrevented) return;
    if (event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    var link = event.target.closest && event.target.closest("a[href]");
    if (!link || link.target === "_blank") return;
    var slug = slugFromHref(link.getAttribute("href"));
    if (!slug) return;
    event.preventDefault();
    var titleNode = link.querySelector(
      ".book-featured__title, .collection-card__title"
    );
    open(slug, titleNode ? titleNode.textContent.trim() : "");
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

  if (
    document.querySelector(
      "a.book-featured__link, [data-collection='books'], a[href*='/books/']"
    )
  ) {
    var early = document.querySelectorAll("a[href*='/books/']");
    for (var i = 0; i < early.length; i++) {
      if (slugFromHref(early[i].getAttribute("href"))) {
        loadData();
        break;
      }
    }
  }
})();
