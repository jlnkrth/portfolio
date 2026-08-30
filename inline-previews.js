// Homepage inline preview links: clients fan, about facts, outdoors mosaic.
(function () {
  var HOVER_DELAY_MS = 160;
  var CLIENT_SLUGS = ["elevenlabs", "workos", "standard-bots"];
  var openKey = null;
  var hoverTimer = null;
  var canHover =
    window.matchMedia("(hover: hover) and (pointer: fine)").matches;

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
      panel.style.removeProperty("--inline-preview-left");
      panel.style.removeProperty("--inline-preview-top");
    });
    document.querySelectorAll("[data-inline-preview]").forEach(function (link) {
      link.setAttribute("aria-expanded", "false");
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

    panel.style.setProperty("--inline-preview-left", Math.round(left) + "px");
    panel.style.setProperty("--inline-preview-top", Math.round(top) + "px");
  }

  function openPanel(key) {
    if (!canHover) return;
    var link = triggerFor(key);
    var panel = panelFor(key);
    if (!link || !panel) return;

    if (openKey && openKey !== key) closeAll();

    panel.hidden = false;
    panel.classList.add("is-open");
    link.setAttribute("aria-expanded", "true");
    openKey = key;
    positionPanel(link, panel);
    // Reposition after layout (fan images / mosaic) settles.
    requestAnimationFrame(function () {
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
      link.setAttribute("aria-expanded", "false");
      link.setAttribute("aria-haspopup", "true");

      if (!canHover) return;

      link.addEventListener("mouseenter", function () {
        scheduleOpen(key);
      });
      link.addEventListener("mouseleave", function (event) {
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
    if (!canHover || openKey) closeAll();
  });

  bindTriggers();

  fetch("/data/collections.json?v=8")
    .then(function (response) {
      return response.json();
    })
    .then(function (data) {
      fillClientsFan(data.clients && data.clients.items);
    })
    .catch(function () {});
})();
