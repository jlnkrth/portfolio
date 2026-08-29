// Injects shared top chrome + sidebar partials (nav, profile, now playing).
(function () {
  var SIDEBAR_CACHE_KEY = "kreth-sidebar-html";
  var TOP_CACHE_KEY = "kreth-top-chrome-html";
  var CHROME_CACHE_VERSION = "8";
  var CHROME_CACHE_VERSION_KEY = "kreth-chrome-cache-version";

  var topSlot = document.getElementById("chrome-top");
  var sidebarSlot = document.getElementById("chrome-sidebar");

  // Persistent notes index: when the user arrives from /notes/, keep a
  // compact titles-only index pinned left of the article. Runs synchronously
  // so the cross-document view transition can morph list items into it.
  (function () {
    var path = location.pathname.replace(/index\.html$/, "");
    var isArticlePage = /^\/notes\/(?!_)[^/]+\/$/.test(path);
    try {
      if (isArticlePage && sessionStorage.getItem("kreth-notes-index") === "1") {
        var layoutEl = document.querySelector(".layout");
        var rootEl = layoutEl && layoutEl.querySelector(".root");
        var indexHtml = sessionStorage.getItem("kreth-notes-index-html");
        if (layoutEl && rootEl && indexHtml) {
          layoutEl.classList.add("layout--notes-index");
          if (sessionStorage.getItem("kreth-notes-index-expanded") === "1") {
            layoutEl.classList.add("layout--notes-index-expanded");
            layoutEl.style.setProperty("--notes-expand", "1");
            layoutEl._notesManualExpand = true;
          }
          rootEl.insertAdjacentHTML("beforebegin", indexHtml);
          var indexEl = layoutEl.querySelector(".notes-index");
          upgradeNotesIndexHead(indexEl);
          var current = layoutEl.querySelector('.notes-index a[href="' + path + '"]');
          if (current) {
            current.setAttribute("aria-current", "page");
            current.setAttribute("title", "Back to all notes");
          }
          initNotesIndexArticleShell(layoutEl, rootEl);
          initNotesIndexNavigation(layoutEl);
          initNotesIndexToc(layoutEl, rootEl.querySelector(".article"));
        }
      } else if (!isArticlePage) {
        clearNotesIndexMode();
      }
    } catch (_) {}
  })();

  function clearNotesIndexMode() {
    try {
      sessionStorage.removeItem("kreth-notes-index");
      sessionStorage.removeItem("kreth-notes-index-html");
      sessionStorage.removeItem("kreth-notes-index-expanded");
    } catch (_) {}
  }

  function upgradeNotesIndexHead(index) {
    if (!index) return;
    var head = index.querySelector(".notes-index__head");
    if (!head) return;

    if (!index.querySelector(".notes-index__head-link")) {
      head.innerHTML =
        '<a class="label notes-index__head-link" href="/notes/" aria-label="Back to all Notes">' +
        '<span class="notes-index__back-prefix" aria-hidden="true">' +
        '<svg class="icon icon-tabler notes-index__back-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M5 12h14"/><path d="M5 12l6 6"/><path d="M5 12l6 -6"/>' +
        "</svg><span class=\"notes-index__back-text\">Back to all</span></span>" +
        '<span class="notes-index__title">Notes</span></a>';
    } else {
      var headLink = index.querySelector(".notes-index__head-link");
      var backText = index.querySelector(".notes-index__back-text");
      if (headLink) headLink.setAttribute("aria-label", "Back to all Notes");
      if (backText && backText.textContent.trim() === "Show all") {
        backText.textContent = "Back to all";
      }
    }

    try {
      sessionStorage.setItem("kreth-notes-index-html", index.outerHTML);
    } catch (_) {}
  }

  function initNotesIndexNavigation(layoutEl) {
    var index = layoutEl.querySelector(".notes-index");
    if (!index || index.dataset.navBound) return;
    index.dataset.navBound = "1";

    index.addEventListener("click", function (event) {
      var item = event.target.closest("a.item");
      if (!item || item.getAttribute("aria-current") !== "page") return;
      event.preventDefault();
      clearNotesIndexMode();
      window.location.href = "/notes/";
    });
  }

  function initNotesIndexArticleShell(layoutEl, rootEl) {
    var article = rootEl.querySelector(".article");
    if (!article || article.closest(".article-shell")) return;

    var shell = document.createElement("div");
    shell.className = "article-shell card";
    article.parentNode.insertBefore(shell, article);

    // The shell stays pinned at viewport height; only this inner scroller
    // moves. All scroll-driven behavior reads from it instead of window.
    var scroller = document.createElement("div");
    scroller.className = "article-shell__scroll";
    scroller.appendChild(article);
    shell.appendChild(scroller);

    var toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "article-shell__toggle";
    var expanded = layoutEl.classList.contains("layout--notes-index-expanded");
    toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
    toggle.setAttribute("aria-label", expanded ? "Minimize article" : "Expand article");
    toggle.innerHTML =
      '<svg class="article-shell__toggle-icon article-shell__toggle-icon--expand" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<polyline points="15 3 21 3 21 9"></polyline>' +
      '<polyline points="9 21 3 21 3 15"></polyline>' +
      '<line x1="21" y1="3" x2="14" y2="10"></line>' +
      '<line x1="3" y1="21" x2="10" y2="14"></line>' +
      "</svg>" +
      '<svg class="article-shell__toggle-icon article-shell__toggle-icon--collapse" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<polyline points="4 14 10 14 10 20"></polyline>' +
      '<polyline points="20 10 14 10 14 4"></polyline>' +
      '<line x1="14" y1="10" x2="21" y2="3"></line>' +
      '<line x1="3" y1="21" x2="10" y2="14"></line>' +
      "</svg>";
    shell.insertBefore(toggle, scroller);

    toggle.addEventListener("click", function () {
      var isExpanded = !layoutEl.classList.contains("layout--notes-index-expanded");
      setNotesIndexExpanded(layoutEl, isExpanded);
      layoutEl._notesManualExpand = isExpanded;
      if (!isExpanded && scroller.scrollTop > 0) {
        // Don't let the next wheel instantly re-expand; the content keeps
        // scrolling natively until the user is back at the top.
        layoutEl._notesScrubSuspended = true;
      }
      if (layoutEl._notesUpdateScrollLock) layoutEl._notesUpdateScrollLock();
    });

    // The page itself never scrolls in this layout; undo any restored offset
    // so the pinned card sits exactly where the CSS expects it. Scroll
    // restoration runs after load, so reset again then.
    window.scrollTo(0, 0);
    window.addEventListener("load", function () {
      window.scrollTo(0, 0);
    });

    bindNotesIndexScrollExpand(layoutEl);
  }

  function setNotesIndexExpanded(layoutEl, isExpanded) {
    var toggle = layoutEl.querySelector(".article-shell__toggle");
    if (isExpanded) {
      layoutEl.classList.add("layout--notes-index-expanded");
    } else {
      layoutEl.classList.remove("layout--notes-index-expanded");
    }
    layoutEl.style.setProperty("--notes-expand", isExpanded ? "1" : "0");
    if (toggle) {
      toggle.setAttribute("aria-expanded", isExpanded ? "true" : "false");
      toggle.setAttribute("aria-label", isExpanded ? "Minimize article" : "Expand article");
    }
    if (isExpanded) {
      measureNotesToc(layoutEl);
    }
    try {
      if (isExpanded) {
        sessionStorage.setItem("kreth-notes-index-expanded", "1");
      } else {
        sessionStorage.removeItem("kreth-notes-index-expanded");
      }
    } catch (_) {}
  }

  // Preview ↔ expanded, two-stage: the first scroll gesture only plays the
  // expand transition (TOC reveals, article widens) while the content stays
  // pinned — the scroller is overflow-locked in preview. Once expanded, the
  // next gesture scrolls the content normally and the TOC collapses to lines
  // (observer in initNotesIndexToc). Scrolling up at the very top plays the
  // collapse transition back to preview.
  function bindNotesIndexScrollExpand(layoutEl) {
    if (!layoutEl || !layoutEl.classList.contains("layout--notes-index")) return;
    if (layoutEl._notesIndexScrub) return;

    var scroller = layoutEl.querySelector(".article-shell__scroll");
    if (!scroller) return;

    // Slightly past the 0.35s layout transition so a continued gesture can't
    // scroll the content before the expand settles.
    var TRANSITION_LOCK_MS = 450;

    function updateLock() {
      var expanded = layoutEl.classList.contains("layout--notes-index-expanded");
      var locked =
        layoutEl._notesExpandSnapping ||
        (!expanded && !layoutEl._notesScrubSuspended);
      scroller.classList.toggle("is-scroll-locked", locked);
    }
    layoutEl._notesUpdateScrollLock = updateLock;

    function playTransition(toExpanded) {
      layoutEl._notesExpandSnapping = true;
      layoutEl._notesManualExpand = false;
      setNotesIndexExpanded(layoutEl, toExpanded);
      updateLock();
      window.setTimeout(function () {
        layoutEl._notesExpandSnapping = false;
        updateLock();
      }, TRANSITION_LOCK_MS);
    }

    function onWheel(event) {
      if (window.innerWidth < 1280) return;
      if (layoutEl._notesExpandSnapping) return;

      var expanded = layoutEl.classList.contains("layout--notes-index-expanded");

      if (!expanded) {
        // Suspended after a manual minimize mid-article: content scrolls
        // natively until the user returns to the top (see onScroll).
        if (layoutEl._notesScrubSuspended) return;
        if (event.deltaY > 0) playTransition(true);
        return;
      }

      // Expanded, content back at the top, scrolling up: back to preview.
      if (
        event.deltaY < 0 &&
        scroller.scrollTop <= 0 &&
        !layoutEl._notesManualExpand
      ) {
        playTransition(false);
      }
    }

    function onScroll() {
      if (layoutEl._notesScrubSuspended && scroller.scrollTop <= 0) {
        layoutEl._notesScrubSuspended = false;
        updateLock();
      }
    }

    // Touchpad/mouse wheel anywhere on the page drives the state change —
    // the page itself never scrolls in this layout.
    window.addEventListener("wheel", onWheel, { passive: true });

    // Basic touch fallback for wheel-less devices at desktop widths.
    var touchStartY = null;
    window.addEventListener(
      "touchstart",
      function (event) {
        touchStartY = event.touches[0].clientY;
      },
      { passive: true }
    );
    window.addEventListener(
      "touchmove",
      function (event) {
        if (touchStartY == null) return;
        var deltaY = touchStartY - event.touches[0].clientY;
        if (Math.abs(deltaY) > 12) {
          touchStartY = null;
          onWheel({ deltaY: deltaY });
        }
      },
      { passive: true }
    );

    layoutEl._notesIndexScrub = onWheel;
    scroller.addEventListener("scroll", onScroll, { passive: true });
    updateLock();
  }

  // Keeps line lengths matched to the *visible* text width so the text→lines
  // morph starts exactly at the clipped text edge, never past the rail border.
  function updateTocTruncation(layoutEl) {
    var tocInner = layoutEl && layoutEl.querySelector(".notes-toc-inner");
    if (!tocInner) return;
    tocInner.querySelectorAll(".toc-a").forEach(function (link) {
      var textEl = link.querySelector(".toc-text");
      var textInner = link.querySelector(".toc-text-inner");
      if (!textEl || !textInner) return;
      var visibleWidth = textInner.offsetWidth;
      if (visibleWidth > 0) {
        link.style.setProperty("--expanded-link-width", String(visibleWidth));
      }
      textEl.classList.toggle(
        "is-truncated",
        textInner.scrollWidth > textInner.offsetWidth + 1
      );
    });
  }

  function measureNotesTocHeights(tocInner) {
    if (!tocInner) return;
    var wasCollapsed = tocInner.classList.contains("toc-collapsed");
    if (wasCollapsed) tocInner.classList.remove("toc-collapsed");
    tocInner.querySelectorAll(".toc-a").forEach(function (link) {
      link.style.setProperty("--expanded-link-height", link.offsetHeight + "px");
    });
    if (wasCollapsed) tocInner.classList.add("toc-collapsed");
  }

  function measureNotesToc(layoutEl) {
    var tocInner = layoutEl.querySelector(".notes-toc-inner");
    var tocWrap = layoutEl.querySelector(".notes-toc-wrap");
    if (!tocInner || !tocWrap) return;

    var restoreDisplay = false;
    if (getComputedStyle(tocWrap).display === "none") {
      tocWrap.style.display = "block";
      tocWrap.style.visibility = "hidden";
      restoreDisplay = true;
    }

    requestAnimationFrame(function () {
      measureNotesTocHeights(tocInner);
      updateTocTruncation(layoutEl);
      tocInner.classList.add("is-ready");
      if (restoreDisplay) {
        tocWrap.style.display = "";
        tocWrap.style.visibility = "";
      }
    });
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function slugifyHeading(text, used) {
    var base =
      String(text)
        .toLowerCase()
        .replace(/[^\w\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-") || "section";
    var slug = base;
    var n = 2;
    while (used[slug]) {
      slug = base + "-" + n;
      n += 1;
    }
    used[slug] = true;
    return slug;
  }

  function initNotesIndexToc(layoutEl, article) {
    if (!article) return;
    var index = layoutEl.querySelector(".notes-index");
    if (!index || index.querySelector(".notes-toc-wrap")) return;

    var headings = article.querySelectorAll("h2");
    if (headings.length < 2) return;

    var used = {};
    var slugCounts = {};
    headings.forEach(function (heading) {
      slugCounts[heading.textContent.replace(/\s+/g, " ").trim()] =
        (slugCounts[heading.textContent.replace(/\s+/g, " ").trim()] || 0) + 1;
    });

    function sectionSlug(text) {
      var base =
        text
          .toLowerCase()
          .trim()
          .replace(/^[\d.]+\s*/, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "") || "section";
      if (slugCounts[text] === 1) return base;
      used[text] = (used[text] || 0) + 1;
      return base + "-" + used[text];
    }

    var introId = "introduction";
    var introSection = document.createElement("div");
    introSection.className = "article-content-section";
    introSection.id = introId;
    var hasIntro = false;

    headings.forEach(function (heading) {
      var text = heading.textContent.replace(/\s+/g, " ").trim();
      var id = sectionSlug(text);
      var wrapper = document.createElement("div");
      wrapper.className = "article-content-section";
      wrapper.id = id;
      heading.parentNode.insertBefore(wrapper, heading);
      wrapper.appendChild(heading);
      var sibling = wrapper.nextSibling;
      while (sibling && !(sibling.nodeType === 1 && sibling.matches("h2"))) {
        var next = sibling.nextSibling;
        wrapper.appendChild(sibling);
        sibling = next;
      }
    });

    if (headings.length) {
      var firstWrapper = headings[0].parentNode;
      var node = article.firstChild;
      while (node && node !== firstWrapper) {
        var after = node.nextSibling;
        if (node !== introSection && !(node.nodeType === 1 && node.matches("h2"))) {
          introSection.appendChild(node);
        }
        node = after;
      }
      if (introSection.childNodes.length) {
        article.insertBefore(introSection, article.firstChild);
        hasIntro = true;
      }
    }

    var tocSections = [];
    if (hasIntro) {
      tocSections.push({ id: introId, text: "Introduction", el: introSection });
    }
    headings.forEach(function (heading) {
      var wrapper = heading.parentNode;
      tocSections.push({
        id: wrapper.id,
        text: heading.textContent.replace(/\s+/g, " ").trim(),
        el: wrapper,
      });
    });

    var html =
      '<div class="notes-toc-wrap"><div class="notes-toc-inner">' +
      '<div class="toc-label">In this article</div><ul class="toc-list">';
    tocSections.forEach(function (section, i) {
      html +=
        '<li class="toc-item' +
        (i === 0 ? " active" : "") +
        '"><a href="#' +
        section.id +
        '" class="toc-a" title="' +
        escapeHtml(section.text) +
        '"><div class="toc-line"></div><div class="toc-text"><span class="toc-text-inner">' +
        escapeHtml(section.text) +
        "</span></div></a></li>";
    });
    html += "</ul></div></div>";

    var head = index.querySelector(".notes-index__head");
    if (!head) return;
    head.insertAdjacentHTML("afterend", html);

    var tocWrap = index.querySelector(".notes-toc-wrap");
    var tocInner = tocWrap.querySelector(".notes-toc-inner");
    var activeLink = tocWrap.querySelector(".toc-a");
    var scroller = layoutEl.querySelector(".article-shell__scroll");
    var isScrolling = false;
    var scrollTimer;

    measureNotesToc(layoutEl);

    if (typeof ResizeObserver !== "undefined" && !layoutEl._notesTocResize) {
      layoutEl._notesTocResize = new ResizeObserver(function () {
        updateTocTruncation(layoutEl);
      });
      layoutEl._notesTocResize.observe(tocWrap);
    }

    function setActiveSection(sectionEl) {
      if (!sectionEl) return;
      var link = tocWrap.querySelector('a[href="#' + sectionEl.id + '"]');
      if (link === activeLink) return;
      requestAnimationFrame(function () {
        if (activeLink) {
          var prevItem = activeLink.closest(".toc-item");
          if (prevItem) prevItem.classList.remove("active");
        }
        requestAnimationFrame(function () {
          if (link) {
            var nextItem = link.closest(".toc-item");
            if (nextItem) nextItem.classList.add("active");
            activeLink = link;
          }
        });
      });
    }

    tocWrap.addEventListener("click", function (event) {
      event.stopPropagation();
      var link = event.target.closest("a.toc-a");
      if (!link || !link.hash) return;
      event.preventDefault();
      if (link.hash === "#" + introId && hasIntro) {
        if (scroller) {
          scroller.scrollTo({ top: 0, behavior: "smooth" });
        } else {
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
        setActiveSection(introSection);
        return;
      }
      var target = document.querySelector(link.hash);
      if (!target) return;
      isScrolling = true;
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(function () {
        isScrolling = false;
      }, 2000);
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveSection(target);
    });

    var observer = new IntersectionObserver(
      function (entries) {
        if (isScrolling) return;
        entries.sort(function (a, b) {
          return a.target.getBoundingClientRect().top - b.target.getBoundingClientRect().top;
        });
        for (var i = 0; i < entries.length; i += 1) {
          var entry = entries[i];
          var rootBounds = entry.rootBounds;
          var rect = entry.boundingClientRect;
          if (rootBounds && rootBounds.bottom - rect.bottom > rootBounds.bottom / 2) continue;
          if (entry.isIntersecting) {
            setActiveSection(entry.target);
            break;
          }
          var sectionNodes = tocSections.map(function (s) {
            return s.el;
          });
          var idx = sectionNodes.indexOf(entry.target);
          if (rect.top > 0) {
            setActiveSection(sectionNodes[Math.max(idx - 1, 0)]);
            break;
          }
        }
      },
      { root: scroller, threshold: [0], rootMargin: "0% 0% -50% 0%" }
    );

    tocSections.forEach(function (section) {
      observer.observe(section.el);
    });

    var title = article.querySelector("h1");
    if (title) {
      // The expand transition happens with the content pinned, so the reader
      // sees the written-out chapter list on its own. Once they start
      // scrolling the content (title exits, plus a small margin), the TOC
      // eases into lines.
      new IntersectionObserver(
        function (entries) {
          var shouldCollapse = !entries[0].isIntersecting;
          if (shouldCollapse) {
            measureNotesTocHeights(tocInner);
          }
          tocInner.classList.toggle("toc-collapsed", shouldCollapse);
        },
        { root: scroller, threshold: 0, rootMargin: "100px 0px 0px 0px" }
      ).observe(title);
    }

    tocInner.addEventListener("mouseenter", function () {
      if (!tocInner.classList.contains("toc-collapsed")) return;
      tocInner.classList.add("transitioning");
      setTimeout(function () {
        tocInner.classList.remove("transitioning");
      }, 350);
    });
  }

  if (!topSlot && !sidebarSlot) return;

  function invalidateChromeCaches() {
    try {
      sessionStorage.removeItem(SIDEBAR_CACHE_KEY);
      sessionStorage.removeItem(TOP_CACHE_KEY);
      sessionStorage.removeItem("kreth-sidebar-list-html");
      sessionStorage.removeItem("kreth-sidebar-list-version");
    } catch (_) {}
  }

  function readSidebarCache() {
    try {
      if (sessionStorage.getItem(CHROME_CACHE_VERSION_KEY) !== CHROME_CACHE_VERSION) {
        invalidateChromeCaches();
        return null;
      }
      return sessionStorage.getItem(SIDEBAR_CACHE_KEY);
    } catch (_) {
      return null;
    }
  }

  function readTopCache() {
    try {
      if (sessionStorage.getItem(CHROME_CACHE_VERSION_KEY) !== CHROME_CACHE_VERSION) {
        invalidateChromeCaches();
        return null;
      }
      return sessionStorage.getItem(TOP_CACHE_KEY);
    } catch (_) {
      return null;
    }
  }

  function restoreChromeFromCache() {
    var restored = false;

    if (topSlot) {
      var topHtml = readTopCache();
      if (topHtml) {
        topSlot.innerHTML = topHtml;
        restored = true;
      }
    }

    if (sidebarSlot) {
      var sidebarHtml = readSidebarCache();
      if (sidebarHtml) {
        sidebarSlot.outerHTML = sidebarHtml;
        sidebarSlot = null;
        restored = true;
      }
    }

    return restored;
  }

  window.persistChromeCache = function persistChromeCache() {
    try {
      sessionStorage.setItem(CHROME_CACHE_VERSION_KEY, CHROME_CACHE_VERSION);
      var top = document.getElementById("chrome-top");
      if (top && top.innerHTML) {
        sessionStorage.setItem(TOP_CACHE_KEY, top.innerHTML);
      }
      var sidebar = document.querySelector(".sidebar");
      if (sidebar) {
        sessionStorage.setItem(SIDEBAR_CACHE_KEY, sidebar.outerHTML);
      }
    } catch (_) {}
  };

  restoreChromeFromCache();

  function initCopyButtons() {
    document.querySelectorAll("[data-copy-btn]").forEach(function (btn) {
      if (btn.dataset.copyBound) return;
      btn.dataset.copyBound = "1";
      btn.addEventListener("click", async function (e) {
        e.stopPropagation();
        var host = btn.closest("[data-copy]");
        var text = host ? host.getAttribute("data-copy") : "";
        if (!text) return;
        try {
          await navigator.clipboard.writeText(text);
          flashCopied(btn);
        } catch (_) {}
      });
    });

    document.querySelectorAll("[data-copy]").forEach(function (el) {
      if (el.dataset.copyBound) return;
      el.dataset.copyBound = "1";
      el.addEventListener("click", async function (e) {
        if (e.target.closest("[data-copy-btn]")) return;
        try {
          await navigator.clipboard.writeText(el.getAttribute("data-copy"));
          var btn = el.querySelector("[data-copy-btn]");
          flashCopied(btn || el);
        } catch (_) {}
      });
    });
  }

  function flashCopied(el) {
    if (!el) return;
    if (el.matches("button") && !el.querySelector("span") && el.querySelector("svg")) {
      el.setAttribute("data-copied", "true");
      var prev = el.getAttribute("aria-label");
      el.setAttribute("aria-label", "Copied");
      setTimeout(function () {
        el.removeAttribute("data-copied");
        if (prev) el.setAttribute("aria-label", prev);
      }, 1200);
      return;
    }
    var label = el.querySelector("span:last-child") || el;
    if (label.children.length) return;
    var original = label.textContent;
    label.textContent = "Copied";
    setTimeout(function () {
      label.textContent = original;
    }, 1200);
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[src="' + src + '"]');
      if (existing) {
        resolve();
        return;
      }
      var s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.body.appendChild(s);
    });
  }

  function restoreAvailabilityCache(root) {
    if (!root) return;
    var el = root.querySelector("[data-availability]");
    if (!el) return;

    try {
      var cache = JSON.parse(sessionStorage.getItem("kreth-availability"));
      if (!cache) return;
      if (cache.lat && el.getAttribute("data-lat") !== cache.lat) return;
      if (cache.lon && el.getAttribute("data-lon") !== cache.lon) return;

      var timeEl = el.querySelector(".availability__time");
      var weatherEl = el.querySelector(".availability__weather");
      if (timeEl && cache.time) timeEl.textContent = cache.time;
      if (weatherEl && cache.weatherHtml) {
        weatherEl.innerHTML = cache.weatherHtml;
        if (cache.weatherTitle) {
          weatherEl.setAttribute("title", cache.weatherTitle);
        }
      }
      if (cache.available != null) {
        el.setAttribute("data-available", cache.available ? "true" : "false");
      }
      if (cache.title) el.setAttribute("title", cache.title);
      if (cache.ariaLabel) el.setAttribute("aria-label", cache.ariaLabel);
    } catch (_) {}
  }

  function injectTopChrome(html) {
    if (!topSlot || !html) return;
    if (html === readTopCache() && topSlot.innerHTML) return;
    topSlot.innerHTML = html;
    try {
      sessionStorage.setItem(TOP_CACHE_KEY, html);
    } catch (_) {}
    restoreAvailabilityCache(topSlot);
    if (window.initNavCurrent) window.initNavCurrent(topSlot);
  }

  function injectSidebar(html) {
    if (!html) return;
    var slot = sidebarSlot || document.querySelector(".sidebar");
    if (!slot) return;
    if (html === readSidebarCache() && slot.classList.contains("sidebar")) return;

    if (sidebarSlot) {
      sidebarSlot.outerHTML = html;
      sidebarSlot = null;
    } else {
      slot.outerHTML = html;
    }

    try {
      sessionStorage.setItem(SIDEBAR_CACHE_KEY, html);
    } catch (_) {}
  }

  var tasks = [];
  var hadSidebarCache = !!readSidebarCache();
  var hadTopCache = !!readTopCache();

  if (topSlot && !hadTopCache) {
    tasks.push(
      fetch("/_partials/top-chrome.html")
        .then(function (r) {
          return r.text();
        })
        .then(injectTopChrome)
    );
  } else if (topSlot) {
    restoreAvailabilityCache(topSlot);
  }

  if (sidebarSlot && !hadSidebarCache) {
    tasks.push(
      fetch("/_partials/sidebar.html")
        .then(function (r) {
          return r.text();
        })
        .then(injectSidebar)
    );
  }

  Promise.all(tasks)
    .then(function () {
      initCopyButtons();
      return Promise.all([
        loadScript("/availability.js"),
        loadScript("/now-playing.js"),
        loadScript("/nav-preview.js?v=8"),
        loadScript("/nav-mobile.js?v=8"),
        loadScript("/sidebar-preview.js?v=8"),
      ]);
    })
    .then(function () {
      if (window.initAvailabilityWidgets) window.initAvailabilityWidgets();
      if (window.initNowPlaying) window.initNowPlaying();
      if (window.initNavPreview) window.initNavPreview();
      if (window.initNavCurrent) window.initNavCurrent();
      if (window.initNavMobile) window.initNavMobile();
      if (window.initSidebarPreview) window.initSidebarPreview();
      window.persistChromeCache();
    })
    .catch(function () {});
})();
