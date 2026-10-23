// Floating reading-progress / TOC pill for note articles.
(function () {
  var RING_R = 7;
  var RING_C = 2 * Math.PI * RING_R;
  var SHOW_OFFSET = 72;

  function isNoteArticle() {
    return (
      document.body.classList.contains("note-page") &&
      !!document.querySelector(".layout > .root .article") &&
      !document.querySelector(".about-page, .project-page")
    );
  }

  function prefersReducedMotion() {
    return (
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  function slugify(text) {
    var base =
      String(text)
        .toLowerCase()
        .trim()
        .replace(/^[\d.]+\s*/, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") || "section";
    return base;
  }

  function uniqueId(base, el) {
    var id = base;
    var n = 1;
    var existing = document.getElementById(id);
    while (existing && existing !== el) {
      n += 1;
      id = base + "-" + n;
      existing = document.getElementById(id);
    }
    return id;
  }

  function collectHeadings(article) {
    var nodes = article.querySelectorAll("h2, h3");
    var items = [];
    nodes.forEach(function (el) {
      var text = el.textContent.replace(/\s+/g, " ").trim();
      if (!text) return;
      if (!el.id) {
        el.id = uniqueId(slugify(text), el);
      }
      items.push({
        el: el,
        id: el.id,
        text: text,
        level: el.tagName === "H3" ? 3 : 2,
      });
    });
    return items;
  }

  function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
  }

  function init() {
    if (window.__noteTocInit) return;
    if (!isNoteArticle()) return;

    var article = document.querySelector(".layout > .root .article");
    if (!article) return;

    var headings = collectHeadings(article);
    if (!headings.length) return;

    window.__noteTocInit = true;

    var root = document.createElement("div");
    root.className = "note-toc";
    root.setAttribute("data-note-toc", "");
    root.setAttribute("hidden", "");

    var menuId = "note-toc-menu";
    var labelId = "note-toc-label";

    var itemsHtml = headings
      .map(function (item, index) {
        return (
          '<button type="button" class="note-toc__item' +
          (item.level === 3 ? " note-toc__item--h3" : "") +
          '" role="option" id="note-toc-opt-' +
          index +
          '" data-index="' +
          index +
          '" data-id="' +
          item.id +
          '">' +
          item.text.replace(/</g, "&lt;") +
          "</button>"
        );
      })
      .join("");

    root.innerHTML =
      '<button type="button" class="note-toc__pill" aria-expanded="false" aria-haspopup="listbox" aria-controls="' +
      menuId +
      '">' +
      '<svg class="note-toc__ring" viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">' +
      '<circle class="note-toc__ring-track" cx="10" cy="10" r="' +
      RING_R +
      '" fill="none"></circle>' +
      '<circle class="note-toc__ring-fill" cx="10" cy="10" r="' +
      RING_R +
      '" fill="none" transform="rotate(-90 10 10)"></circle>' +
      "</svg>" +
      '<span class="note-toc__name">' +
      '<span class="note-toc__label" id="' +
      labelId +
      '">Index</span>' +
      '<svg class="note-toc__chevron" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">' +
      '<path d="M3 4.5L6 7.5L9 4.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"></path>' +
      "</svg>" +
      "</span>" +
      '<span class="note-toc__pct" data-note-toc-pct>0%</span>' +
      "</button>" +
      '<div class="note-toc__menu" id="' +
      menuId +
      '" role="listbox" aria-labelledby="' +
      labelId +
      '" hidden>' +
      itemsHtml +
      "</div>";

    var host = document.querySelector(".swipe-nav__frame") || document.body;
    host.appendChild(root);

    var pill = root.querySelector(".note-toc__pill");
    var menu = root.querySelector(".note-toc__menu");
    var label = root.querySelector(".note-toc__label");
    var pctEl = root.querySelector("[data-note-toc-pct]");
    var fill = root.querySelector(".note-toc__ring-fill");
    var options = Array.prototype.slice.call(root.querySelectorAll(".note-toc__item"));

    fill.style.strokeDasharray = String(RING_C);
    fill.style.strokeDashoffset = String(RING_C);

    var open = false;
    var activeIndex = -1;
    var focusIndex = 0;
    var visible = false;
    var lastPct = -1;
    var lastLabel = "";
    var ticking = false;

    function setOpen(next) {
      open = !!next;
      root.classList.toggle("is-open", open);
      pill.setAttribute("aria-expanded", open ? "true" : "false");
      if (open) {
        menu.removeAttribute("hidden");
        focusIndex = activeIndex >= 0 ? activeIndex : -1;
        syncOptionState();
      } else {
        menu.setAttribute("hidden", "");
      }
    }

    function syncOptionState() {
      options.forEach(function (option, i) {
        var current = i === activeIndex;
        option.classList.toggle("is-current", current);
        option.setAttribute("aria-selected", current ? "true" : "false");
        option.classList.toggle("is-active", i === focusIndex);
      });
    }

    function setVisible(next) {
      if (visible === next) return;
      visible = next;
      root.classList.toggle("is-visible", visible);
      if (visible) {
        root.removeAttribute("hidden");
        root.removeAttribute("aria-hidden");
      } else {
        root.setAttribute("hidden", "");
        root.setAttribute("aria-hidden", "true");
        if (open) setOpen(false);
      }
    }

    function headerBottom() {
      var stage = article.querySelector(".essay-stage");
      var title = article.querySelector("h1");
      var mark = stage || title;
      if (!mark) return article.getBoundingClientRect().top + window.scrollY + 120;
      var rect = mark.getBoundingClientRect();
      return rect.bottom + window.scrollY;
    }

    function progress() {
      var rect = article.getBoundingClientRect();
      var top = rect.top + window.scrollY;
      var height = article.offsetHeight;
      var viewed = window.scrollY + window.innerHeight - top;
      return clamp(viewed / Math.max(height, 1), 0, 1);
    }

    function currentIndex() {
      var probe = SHOW_OFFSET + 28;
      var found = -1;
      for (var i = 0; i < headings.length; i++) {
        var top = headings[i].el.getBoundingClientRect().top;
        if (top - probe <= 0) found = i;
      }
      return found;
    }

    function sync() {
      ticking = false;
      var pct = Math.round(progress() * 100);
      var idx = currentIndex();
      var nextLabel = idx < 0 ? "Index" : headings[idx].text;
      var show = window.scrollY + SHOW_OFFSET > headerBottom() - 8;

      setVisible(show);
      if (!show) return;

      if (pct !== lastPct) {
        lastPct = pct;
        pctEl.textContent = pct + "%";
        fill.style.strokeDashoffset = String(RING_C * (1 - pct / 100));
      }

      if (nextLabel !== lastLabel || idx !== activeIndex) {
        lastLabel = nextLabel;
        activeIndex = idx;
        label.textContent = nextLabel;
        pill.setAttribute(
          "aria-label",
          nextLabel + ", " + pct + " percent read. Open table of contents."
        );
        syncOptionState();
      }
    }

    function onScrollOrResize() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(sync);
    }

    function scrollToHeading(item) {
      if (!item) return;
      var behavior = prefersReducedMotion() ? "auto" : "smooth";
      var top =
        item.el.getBoundingClientRect().top + window.scrollY - SHOW_OFFSET;
      window.scrollTo({ top: Math.max(0, top), behavior: behavior });
      if (history && history.replaceState) {
        history.replaceState(null, "", "#" + item.id);
      }
    }

    function closeFromOutside(event) {
      if (!open) return;
      if (root.contains(event.target)) return;
      setOpen(false);
    }

    pill.addEventListener("click", function () {
      setOpen(!open);
    });

    options.forEach(function (option, index) {
      option.addEventListener("click", function () {
        scrollToHeading(headings[index]);
        setOpen(false);
        pill.focus();
      });
    });

    root.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        if (!open) return;
        event.preventDefault();
        setOpen(false);
        pill.focus();
        return;
      }

      if (!open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
        if (event.target !== pill) return;
        event.preventDefault();
        setOpen(true);
        focusIndex = event.key === "ArrowUp" ? options.length - 1 : 0;
        options[focusIndex].focus();
        syncOptionState();
        return;
      }

      if (!open) return;
      var last = options.length - 1;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        focusIndex = focusIndex >= last ? 0 : Math.max(0, focusIndex) + 1;
        options[focusIndex].focus();
        syncOptionState();
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        focusIndex = focusIndex <= 0 ? last : focusIndex - 1;
        options[focusIndex].focus();
        syncOptionState();
      } else if (event.key === "Home") {
        event.preventDefault();
        focusIndex = 0;
        options[focusIndex].focus();
        syncOptionState();
      } else if (event.key === "End") {
        event.preventDefault();
        focusIndex = last;
        options[focusIndex].focus();
        syncOptionState();
      } else if (event.key === "Tab") {
        setOpen(false);
      }
    });

    document.addEventListener("pointerdown", closeFromOutside, true);
    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize);
    sync();
  }

  function start() {
    if (isNoteArticle()) {
      window.requestAnimationFrame(function () {
        window.setTimeout(init, 0);
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
