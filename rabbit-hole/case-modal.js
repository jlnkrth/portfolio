// Opens a rabbit-hole case study in a modal instead of navigating anywhere.
// Layout follows the Office Commun case-study pattern: statement headline,
// lede, facts row, hero shot, optional narrative sections, CTA, next project.
(function () {
  if (window.__caseModal) return;
  window.__caseModal = true;

  var root = null;
  var dialog = null;
  var scrollEl = null;
  var panelEl = null;
  var closeBtn = null;
  var lastFocus = null;
  var isOpen = false;
  var dataPromise = null;
  var currentSlug = "";

  function ensureCss() {
    if (document.querySelector('link[href^="/rabbit-hole/case-modal.css"]')) return;
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/rabbit-hole/case-modal.css";
    document.head.appendChild(link);
  }

  function slugFromHref(href) {
    if (!href) return "";
    var hash = "";
    if (href.charAt(0) === "#") {
      hash = href.slice(1);
    } else {
      var path = href.split("?")[0];
      var hashIndex = path.indexOf("#");
      if (hashIndex !== -1) {
        if (path.slice(0, hashIndex).replace(/\/$/, "") !== "/rabbit-hole") return "";
        hash = path.slice(hashIndex + 1);
      } else {
        var match = path.match(/^\/rabbit-hole\/([^/]+)\/?$/);
        if (!match || match[1] === "index.html") return "";
        hash = match[1];
      }
    }
    try {
      return decodeURIComponent(hash);
    } catch (_) {
      return hash;
    }
  }

  function loadData() {
    if (!dataPromise) {
      dataPromise = fetch("/data/collections.json")
        .then(function (response) {
          if (!response.ok) throw new Error("collections");
          return response.json();
        })
        .then(function (data) {
          return (data.rabbitHole && data.rabbitHole.items) || [];
        });
    }
    return dataPromise;
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function mount() {
    if (root) return;

    root = el("div", "case-modal");
    root.hidden = true;

    var backdrop = document.createElement("button");
    backdrop.className = "case-modal__backdrop";
    backdrop.type = "button";
    backdrop.setAttribute("aria-label", "Close");
    backdrop.addEventListener("click", close);

    dialog = el("div", "case-modal__dialog");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "case-modal-title");

    closeBtn = document.createElement("button");
    closeBtn.className = "case-modal__close";
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "Close");
    closeBtn.innerHTML =
      '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
    closeBtn.addEventListener("click", close);

    scrollEl = el("div", "case-modal__scroll");
    var tray = el("div", "case-modal__tray");
    panelEl = el("div", "case-modal__panel");
    tray.appendChild(panelEl);
    scrollEl.appendChild(tray);

    dialog.appendChild(closeBtn);
    dialog.appendChild(scrollEl);
    root.appendChild(backdrop);
    root.appendChild(dialog);
    document.body.appendChild(root);
  }

  function fact(label, value) {
    var cell = el("div", "case-modal__fact");
    cell.appendChild(el("dt", "case-modal__fact-label", label));
    var dd = el("dd", "case-modal__fact-value");
    if (typeof value === "string") {
      dd.textContent = value;
    } else {
      value.forEach(function (chunk) {
        var line = el("span", "case-modal__fact-line", chunk);
        dd.appendChild(line);
      });
    }
    cell.appendChild(dd);
    return cell;
  }

  function buildMedia(item) {
    var media = el("div", "case-modal__media");
    if (item.image) {
      var img = document.createElement("img");
      img.src = item.image;
      img.alt = (item.client || item.title || "Project") + " — website screenshot";
      img.decoding = "async";
      media.appendChild(img);
    } else {
      media.classList.add("case-modal__media--empty");
      media.appendChild(
        el(
          "span",
          "case-modal__media-placeholder",
          item.confidential ? "Confidential" : (item.client || "?").charAt(0)
        )
      );
    }
    return media;
  }

  function render(item, items) {
    panelEl.replaceChildren();

    var hero = el("header", "case-modal__hero");
    var kicker = el("p", "case-modal__kicker", "Case study");
    var heading = el("h2", "case-modal__heading", item.what || item.client || item.title);
    heading.id = "case-modal-title";
    hero.appendChild(kicker);
    hero.appendChild(heading);
    if (item.lede) hero.appendChild(el("p", "case-modal__lede", item.lede));
    panelEl.appendChild(hero);

    var facts = el("dl", "case-modal__facts");
    facts.appendChild(fact("Client", item.client || "—"));
    if (item.what) facts.appendChild(fact("What it is", item.what));
    if (item.year) facts.appendChild(fact("Year", String(item.year)));
    if (item.services && item.services.length) {
      facts.appendChild(fact("Services", item.services));
    }
    panelEl.appendChild(facts);

    panelEl.appendChild(buildMedia(item));

    if (Array.isArray(item.sections)) {
      var body = el("div", "case-modal__body");
      item.sections.forEach(function (section) {
        if (!section) return;
        if (section.heading) {
          body.appendChild(el("h3", "case-modal__section-heading", section.heading));
        }
        (section.body || []).forEach(function (paragraph) {
          body.appendChild(el("p", "case-modal__paragraph", paragraph));
        });
      });
      if (body.childNodes.length) panelEl.appendChild(body);
    }

    var actions = el("div", "case-modal__actions");
    var cta = document.createElement("a");
    cta.className = "case-modal__cta";
    cta.href = "mailto:julian@karmastudio.co?subject=Project%20Inquiry";
    cta.textContent = "Start a similar project";
    actions.appendChild(cta);
    if (item.website) {
      var visit = document.createElement("a");
      visit.className = "case-modal__visit";
      visit.href = item.website;
      visit.target = "_blank";
      visit.rel = "noreferrer";
      visit.textContent = "Visit website ↗";
      actions.appendChild(visit);
    }
    panelEl.appendChild(actions);

    var index = -1;
    items.forEach(function (candidate, i) {
      if (candidate.slug === item.slug) index = i;
    });
    if (index !== -1 && items.length > 1) {
      var next = items[(index + 1) % items.length];
      var foot = el("div", "case-modal__next");
      foot.appendChild(el("span", "case-modal__next-label", "Next"));
      var nextBtn = document.createElement("button");
      nextBtn.type = "button";
      nextBtn.className = "case-modal__next-link";
      nextBtn.appendChild(el("span", "case-modal__next-client", next.client || next.title));
      if (next.what) {
        nextBtn.appendChild(el("span", "case-modal__next-what", " · " + next.what));
      }
      nextBtn.addEventListener("click", function () {
        currentSlug = next.slug;
        render(next, items);
        scrollEl.scrollTop = 0;
        closeBtn.focus({ preventScroll: true });
      });
      foot.appendChild(nextBtn);
      panelEl.appendChild(foot);
    }
  }

  function renderMessage(title, message) {
    panelEl.replaceChildren();
    var hero = el("header", "case-modal__hero");
    var heading = el("h2", "case-modal__heading", title);
    heading.id = "case-modal-title";
    hero.appendChild(heading);
    if (message) hero.appendChild(el("p", "case-modal__lede", message));
    panelEl.appendChild(hero);
  }

  function show() {
    mount();
    if (root.parentNode !== document.body) document.body.appendChild(root);
    lastFocus = document.activeElement;
    root.hidden = false;
    isOpen = true;
    document.body.classList.add("case-modal-open");
    scrollEl.scrollTop = 0;
    closeBtn.focus({ preventScroll: true });
  }

  function close() {
    if (!isOpen || !root) return;
    isOpen = false;
    root.hidden = true;
    document.body.classList.remove("case-modal-open");
    if (lastFocus && typeof lastFocus.focus === "function") {
      lastFocus.focus({ preventScroll: true });
    }
  }

  function focusables() {
    return Array.prototype.filter.call(
      dialog.querySelectorAll(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      ),
      function (node) {
        return !node.closest("[hidden]");
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
    currentSlug = slug;
    renderMessage(fallbackTitle || "Loading…", "");
    loadData()
      .then(function (items) {
        if (!isOpen || currentSlug !== slug) return;
        var match = null;
        items.forEach(function (item) {
          if (item.slug === slug) match = item;
        });
        if (match) {
          render(match, items);
        } else {
          close();
        }
      })
      .catch(function () {
        if (!isOpen || currentSlug !== slug) return;
        renderMessage(fallbackTitle || "Case study", "Could not load this case study.");
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
    var titleNode = link.querySelector(".collection-card__title");
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

  function openFromHash() {
    var slug = slugFromHref(window.location.hash);
    if (!slug) return;
    loadData().then(function (items) {
      var match = items.some(function (item) {
        return item.slug === slug;
      });
      if (match) open(slug, "");
    });
  }

  ensureCss();
  document.addEventListener("click", onClick, true);
  document.addEventListener("keydown", onKeydown);

  if (document.querySelector("[data-collection='rabbitHole']")) {
    loadData();
    openFromHash();
  }
})();
