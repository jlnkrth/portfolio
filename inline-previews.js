// Homepage inline preview links: clients fan, about facts, outdoors mosaic.
(function () {
  var HOVER_DELAY_MS = 160;
  var MOBILE_SHOWCASE_MS = 1100;
  var MOBILE_SHOWCASE_GAP_MS = 150;
  var CLIENT_SLUGS = ["elevenlabs", "workos", "standard-bots"];
  var SHOWCASE_KEYS = ["clients", "outdoors", "about"];
  var openKey = null;
  var hoverTimer = null;
  var showcaseTimer = null;
  var showcaseObserver = null;
  var showcaseQueue = [];
  var showcasedKeys = {};
  var showcaseRunning = false;
  var showcaseCancelled = false;
  var canHover =
    window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var isCoarsePointer =
    window.matchMedia("(hover: none), (pointer: coarse)").matches;
  var reduceMotion =
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function panelFor(key) {
    return document.querySelector('[data-inline-preview-panel="' + key + '"]');
  }

  function triggerFor(key) {
    return document.querySelector('[data-inline-preview="' + key + '"]');
  }

  function closeAll() {
    document.querySelectorAll("[data-inline-preview-panel]").forEach(function (panel) {
      panel.hidden = true;
      panel.classList.remove("is-open");
      panel.classList.remove("is-showcase");
      panel.removeAttribute("aria-hidden");
      panel.style.removeProperty("--inline-preview-left");
      panel.style.removeProperty("--inline-preview-top");
    });
    document.querySelectorAll("[data-inline-preview]").forEach(function (link) {
      link.classList.remove("is-previewing");
      if (canHover) {
        link.setAttribute("aria-expanded", "false");
      } else {
        link.removeAttribute("aria-expanded");
      }
    });
    openKey = null;
  }

  function positionPanel(link, panel) {
    var rect = link.getBoundingClientRect();
    var panelRect = panel.getBoundingClientRect();
    var width = panelRect.width || 280;
    var height = panelRect.height || 220;
    var gap = 10;
    var left = rect.left + rect.width / 2 - width / 2;
    var top = rect.bottom + gap;

    left = Math.max(12, Math.min(left, window.innerWidth - width - 12));
    if (top + height > window.innerHeight - 12) {
      top = Math.max(12, rect.top - height - gap);
    }
    top = Math.max(12, Math.min(top, window.innerHeight - height - 12));

    panel.style.setProperty("--inline-preview-left", Math.round(left) + "px");
    panel.style.setProperty("--inline-preview-top", Math.round(top) + "px");
  }

  function openPanel(key, showcase) {
    if (!canHover && !showcase) return;
    var link = triggerFor(key);
    var panel = panelFor(key);
    if (!link || !panel) return;

    if (openKey && openKey !== key) closeAll();

    panel.hidden = false;
    if (showcase) {
      panel.classList.add("is-showcase");
      panel.setAttribute("aria-hidden", "true");
      link.classList.add("is-previewing");
    } else {
      panel.classList.add("is-open");
      link.setAttribute("aria-expanded", "true");
    }
    openKey = key;
    positionPanel(link, panel);

    // Let the collapsed logo cards paint before fanning out on touch.
    requestAnimationFrame(function () {
      if (showcase && openKey === key) panel.classList.add("is-open");
      positionPanel(link, panel);
    });
  }

  function scheduleOpen(key) {
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(function () {
      openPanel(key);
    }, HOVER_DELAY_MS);
  }

  function cancelOpen() {
    clearTimeout(hoverTimer);
    hoverTimer = null;
  }

  function playNextShowcase() {
    if (showcaseCancelled || showcaseRunning || !showcaseQueue.length) return;
    showcaseRunning = true;
    var key = showcaseQueue.shift();
    openPanel(key, true);

    showcaseTimer = setTimeout(function () {
      closeAll();
      showcaseTimer = setTimeout(function () {
        showcaseRunning = false;
        playNextShowcase();
      }, MOBILE_SHOWCASE_GAP_MS);
    }, MOBILE_SHOWCASE_MS);
  }

  function queueShowcase(key) {
    if (showcaseCancelled || showcasedKeys[key]) return;
    showcasedKeys[key] = true;
    showcaseQueue.push(key);
    showcaseQueue.sort(function (a, b) {
      return SHOWCASE_KEYS.indexOf(a) - SHOWCASE_KEYS.indexOf(b);
    });
    playNextShowcase();
  }

  function cancelShowcase() {
    if (!isCoarsePointer || showcaseCancelled) return;
    showcaseCancelled = true;
    showcaseQueue = [];
    showcaseRunning = false;
    clearTimeout(showcaseTimer);
    if (showcaseObserver) showcaseObserver.disconnect();
    closeAll();
  }

  function startTouchShowcase() {
    if (!isCoarsePointer || canHover || reduceMotion) return;

    var links = SHOWCASE_KEYS.map(triggerFor).filter(Boolean);
    if (!links.length) return;

    // User input always wins; the one-time sequence never blocks navigation.
    document.addEventListener("pointerdown", cancelShowcase, {
      capture: true,
      once: true,
    });

    if (!("IntersectionObserver" in window)) {
      SHOWCASE_KEYS.forEach(queueShowcase);
      return;
    }

    showcaseObserver = new IntersectionObserver(
      function (entries) {
        entries
          .filter(function (entry) {
            return entry.isIntersecting;
          })
          .sort(function (a, b) {
            return (
              SHOWCASE_KEYS.indexOf(a.target.getAttribute("data-inline-preview")) -
              SHOWCASE_KEYS.indexOf(b.target.getAttribute("data-inline-preview"))
            );
          })
          .forEach(function (entry) {
            var key = entry.target.getAttribute("data-inline-preview");
            queueShowcase(key);
            showcaseObserver.unobserve(entry.target);
          });
      },
      { threshold: 0.5 },
    );

    links.forEach(function (link) {
      showcaseObserver.observe(link);
    });
  }

  function fillClientsFan(clients) {
    var fan = document.querySelector("[data-inline-clients-fan]");
    if (!fan) return;
    fan.innerHTML = "";

    var bySlug = {};
    (clients || []).forEach(function (item) {
      bySlug[item.slug] = item;
    });

    CLIENT_SLUGS.forEach(function (slug, index) {
      var item = bySlug[slug];
      if (!item) return;
      var card = document.createElement("span");
      card.className = "inline-preview__logo";
      card.style.setProperty("--fan-index", String(index));
      if (item.image) {
        var img = document.createElement("img");
        img.src = item.image;
        img.alt = "";
        card.appendChild(img);
      } else {
        card.textContent = (item.title || "?").charAt(0);
      }
      fan.appendChild(card);
    });
  }

  function bindTriggers() {
    document.querySelectorAll("[data-inline-preview]").forEach(function (link) {
      var key = link.getAttribute("data-inline-preview");
      if (!key) return;
      if (canHover) {
        link.setAttribute("aria-expanded", "false");
        link.setAttribute("aria-haspopup", "true");
      } else {
        link.removeAttribute("aria-expanded");
        link.removeAttribute("aria-haspopup");
      }

      link.addEventListener("mouseenter", function () {
        if (!canHover) return;
        scheduleOpen(key);
      });
      link.addEventListener("mouseleave", function (event) {
        if (!canHover) return;
        cancelOpen();
        var panel = panelFor(key);
        var next = event.relatedTarget;
        if (panel && next && panel.contains(next)) return;
        if (openKey === key) closeAll();
      });
      link.addEventListener("focus", function () {
        openPanel(key);
      });
      link.addEventListener("blur", function (event) {
        if (!canHover) return;
        var panel = panelFor(key);
        var next = event.relatedTarget;
        if (panel && next && panel.contains(next)) return;
        if (openKey === key) closeAll();
      });
    });

    document.querySelectorAll("[data-inline-preview-panel]").forEach(function (panel) {
      panel.addEventListener("mouseleave", function (event) {
        var key = panel.getAttribute("data-inline-preview-panel");
        var link = triggerFor(key);
        var next = event.relatedTarget;
        if (link && next && (link === next || link.contains(next))) return;
        if (openKey === key) closeAll();
      });
    });
  }

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && openKey) {
      event.preventDefault();
      closeAll();
    }
  });

  window.addEventListener("scroll", function () {
    if (openKey) closeAll();
  }, { passive: true });

  window.addEventListener("resize", function () {
    canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    isCoarsePointer =
      window.matchMedia("(hover: none), (pointer: coarse)").matches;
    if (!canHover || openKey) closeAll();
  });

  bindTriggers();

  var clientsReady = fetch("/data/collections.json?v=8")
    .then(function (response) {
      return response.json();
    })
    .then(function (data) {
      fillClientsFan(data.clients && data.clients.items);
    })
    .catch(function () {});

  clientsReady.then(startTouchShowcase);
})();
