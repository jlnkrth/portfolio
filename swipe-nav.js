// Mobile swipe-from-behind site menu. Desktop is a no-op.
(function () {
  var EDGE = 28;
  var PANEL = 300;
  var SNAP = 0.34;
  var VELOCITY = 0.45;

  function isMobile() {
    return window.matchMedia && window.matchMedia("(max-width: 767px)").matches;
  }

  function prefersReducedMotion() {
    return (
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  function isVisible(el) {
    if (!el) return false;
    var node = el;
    while (node && node !== document.body) {
      var style = window.getComputedStyle(node);
      if (style.display === "none" || style.visibility === "hidden") return false;
      node = node.parentElement;
    }
    var box = el.getBoundingClientRect();
    return box.width > 0 && box.height > 0;
  }

  function hasVisibleProfileCard() {
    var cards = document.querySelectorAll(".profile-card");
    for (var i = 0; i < cards.length; i++) {
      if (cards[i].closest(".swipe-nav")) continue;
      if (isVisible(cards[i])) return true;
    }
    return false;
  }

  function cardAvatarSrc() {
    var img = document.querySelector(".profile-card img.avatar, .profile-card [data-avatar]");
    return (img && img.getAttribute("src")) || "/assets/avatar.avif";
  }

  function keepOut(node) {
    if (!node || node.nodeType !== 1) return false;
    return (
      node.matches(
        "script, style, .swipe-nav, .swipe-nav__frame, .swipe-nav__trigger, [data-hidden-footer], .hidden-footer"
      )
    );
  }

  function init() {
    if (window.__swipeNavInit) return;
    if (!isMobile()) return;
    window.__swipeNavInit = true;

    var panelWidth = Math.min(PANEL, Math.round(window.innerWidth * 0.82));
    var progress = 0;
    var open = false;
    var dragging = false;
    var startX = 0;
    var startY = 0;
    var startProgress = 0;
    var lastX = 0;
    var lastT = 0;
    var velocity = 0;
    var axis = "";
    var pointerId = null;
    var ignoreClick = false;

    var nav = document.createElement("div");
    nav.className = "swipe-nav";
    nav.id = "swipe-nav";
    nav.setAttribute("role", "dialog");
    nav.setAttribute("aria-modal", "true");
    nav.setAttribute("aria-label", "Site menu");
    nav.setAttribute("aria-hidden", "true");
    nav.innerHTML =
      '<div class="swipe-nav__panel">' +
      '<a class="swipe-nav__brand" href="/" aria-label="Home">' +
      '<img class="swipe-nav__brand-img" src="/assets/avatar.avif" alt="" width="40" height="40" data-avatar />' +
      "</a>" +
      '<nav class="swipe-nav__primary" aria-label="Primary">' +
      '<a href="/projects/">Projects</a>' +
      '<a href="/books/">Books</a>' +
      '<a href="/clients/">Clients</a>' +
      '<a href="/notes/">Archive</a>' +
      '<a href="/about/">About</a>' +
      "</nav>" +
      '<nav class="swipe-nav__secondary" aria-label="More">' +
      '<a href="mailto:julian@karmastudio.co?subject=Contact%20me">Contact</a>' +
      '<a href="https://github.com/jlnkrth" target="_blank" rel="noreferrer">GitHub</a>' +
      "</nav>" +
      '<a class="swipe-nav__who" href="/about/">' +
      '<img class="swipe-nav__who-img" src="/assets/avatar.avif" alt="" width="36" height="36" data-avatar />' +
      "<span>Julian Kreth</span>" +
      "</a>" +
      "</div>";

    var trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "swipe-nav__trigger";
    trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute("aria-controls", "swipe-nav");
    trigger.setAttribute("aria-label", "Open menu");
    trigger.innerHTML =
      '<img class="avatar" src="' +
      cardAvatarSrc() +
      '" alt="" width="44" height="44" data-avatar />';

    var frame = document.querySelector(".swipe-nav__frame");
    if (!frame) {
      frame = document.createElement("div");
      frame.className = "swipe-nav__frame";
      var moving = [];
      Array.prototype.forEach.call(document.body.childNodes, function (node) {
        if (keepOut(node)) return;
        moving.push(node);
      });
      moving.forEach(function (node) {
        frame.appendChild(node);
      });
      document.body.insertBefore(frame, document.body.firstChild);
    }

    document.body.insertBefore(nav, document.body.firstChild);
    frame.appendChild(trigger);
    document.body.classList.add("swipe-nav-ready");

    function syncTrigger() {
      var hide = hasVisibleProfileCard();
      trigger.hidden = hide;
      trigger.tabIndex = hide ? -1 : 0;
      trigger.setAttribute("aria-hidden", hide ? "true" : "false");
      var img = trigger.querySelector("img");
      if (img) {
        img.className = "avatar";
        img.setAttribute("src", cardAvatarSrc());
      }
    }

    var focusables = [];

    function refreshFocusables() {
      focusables = Array.prototype.slice.call(
        nav.querySelectorAll('a[href], button:not([disabled])')
      );
    }

    function setProgress(next, animate) {
      progress = Math.max(0, Math.min(1, next));
      var x = Math.round(progress * panelWidth);
      var scale = prefersReducedMotion() ? 1 : 1 - progress * 0.035;
      var radius = Math.round(progress * 18);
      var reduce = prefersReducedMotion();
      frame.style.transition =
        animate && !reduce ? "transform 280ms ease, border-radius 280ms ease" : "none";
      if (progress <= 0) {
        frame.style.transform = "";
        frame.style.borderRadius = "";
      } else {
        frame.style.transform =
          "translate3d(" + x + "px,0,0) scale(" + scale + ")";
        frame.style.borderRadius = radius + "px";
      }
      frame.classList.toggle("is-offset", progress > 0.01);
      document.body.classList.toggle("swipe-nav-open", progress > 0.5);
    }

    function setOpen(next) {
      open = !!next;
      setProgress(open ? 1 : 0, true);
      trigger.setAttribute("aria-expanded", open ? "true" : "false");
      trigger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      nav.setAttribute("aria-hidden", open ? "false" : "true");
      document.body.classList.toggle("swipe-nav-open", open);
      if (open) {
        refreshFocusables();
        var first = focusables[0];
        if (first) first.focus();
      } else if (!trigger.hidden) {
        trigger.focus();
      }
    }

    function onPointerDown(event) {
      if (!isMobile()) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      if (document.body.classList.contains("footer-revealed")) return;
      if (event.target.closest("input, textarea, select, [data-note-toc]")) return;

      var x = event.clientX;
      var y = event.clientY;
      if (!open && x > EDGE) return;
      if (open && x < panelWidth) return;

      dragging = true;
      axis = "";
      pointerId = event.pointerId;
      startX = x;
      startY = y;
      startProgress = progress;
      lastX = x;
      lastT = Date.now();
      velocity = 0;
      frame.style.transition = "none";
      try {
        frame.setPointerCapture(event.pointerId);
      } catch (_) {}
    }

    function onPointerMove(event) {
      if (!dragging || event.pointerId !== pointerId) return;
      var x = event.clientX;
      var y = event.clientY;
      var dx = x - startX;
      var dy = y - startY;
      if (!axis) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
        if (axis === "y") {
          dragging = false;
          return;
        }
      }
      if (axis !== "x") return;
      event.preventDefault();
      var now = Date.now();
      var dt = Math.max(1, now - lastT);
      velocity = (x - lastX) / dt;
      lastX = x;
      lastT = now;
      var next = startProgress + dx / panelWidth;
      setProgress(next, false);
    }

    function onPointerUp(event) {
      if (!dragging || (pointerId != null && event.pointerId !== pointerId)) {
        dragging = false;
        return;
      }
      dragging = false;
      pointerId = null;
      if (axis === "x") {
        ignoreClick = true;
        window.setTimeout(function () {
          ignoreClick = false;
        }, 0);
      }
      if (axis === "y" || !axis) {
        setProgress(open ? 1 : 0, true);
        return;
      }
      var shouldOpen =
        velocity > VELOCITY || (velocity > -VELOCITY && progress >= SNAP);
      setOpen(shouldOpen);
    }

    function onKeydown(event) {
      if (!open) return;
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab" || !focusables.length) return;
      var first = focusables[0];
      var last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    function onFrameClick(event) {
      if (ignoreClick) return;
      if (!open) return;
      if (event.target.closest(".swipe-nav")) return;
      if (event.target.closest(".swipe-nav__trigger")) return;
      setOpen(false);
    }

    trigger.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(!open);
    });

    var topLogo = document.querySelector(".top-nav__logo");
    if (topLogo) {
      topLogo.addEventListener("click", function (event) {
        if (!isMobile()) return;
        event.preventDefault();
        setOpen(!open);
      });
    }

    frame.addEventListener("pointerdown", onPointerDown);
    frame.addEventListener("pointermove", onPointerMove, { passive: false });
    frame.addEventListener("pointerup", onPointerUp);
    frame.addEventListener("pointercancel", onPointerUp);
    frame.addEventListener("click", onFrameClick);
    document.addEventListener("keydown", onKeydown);

    window.addEventListener("resize", function () {
      panelWidth = Math.min(PANEL, Math.round(window.innerWidth * 0.82));
      if (!isMobile()) {
        setOpen(false);
        frame.style.transform = "";
        frame.style.borderRadius = "";
        document.body.classList.remove("swipe-nav-open");
      } else {
        setProgress(open ? 1 : 0, false);
      }
    });

    nav.querySelectorAll("a[href]").forEach(function (link) {
      link.addEventListener("click", function () {
        setOpen(false);
      });
    });

    if (window.initAvatars) window.initAvatars(document.body);
    syncTrigger();
    if (typeof MutationObserver !== "undefined") {
      new MutationObserver(function () {
        syncTrigger();
      }).observe(document.body, { childList: true, subtree: true });
    }
    window.addEventListener("resize", syncTrigger);

    setProgress(0, false);
  }

  function start() {
    if (isMobile()) init();
    window.addEventListener("resize", function () {
      if (isMobile() && !window.__swipeNavInit) init();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
