// Mobile swipe-from-behind site menu. Desktop is a no-op.
// Profile / Menu chrome stays put; only page content slides to reveal the menu.
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
    var img = document.querySelector(
      ".profile-card img.avatar, .profile-card [data-avatar], .top-nav__logo-img[data-avatar]"
    );
    return (img && img.getAttribute("src")) || "/assets/avatar.avif";
  }

  function keepOut(node) {
    if (!node || node.nodeType !== 1) return false;
    return node.matches(
      "script, style, .swipe-nav, .swipe-nav__frame, .swipe-nav__trigger, .top-nav, .swipe-nav__stay, [data-hidden-footer], .hidden-footer"
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
    var scrollLocked = false;
    var lockY = 0;
    var menuButtons = Array.prototype.slice.call(
      document.querySelectorAll(".top-nav__menu-btn, [data-nav-menu-toggle]")
    );

    function rememberScroll() {
      if (scrollLocked) return;
      lockY = window.scrollY || window.pageYOffset || 0;
    }

    var nav = document.createElement("div");
    nav.className = "swipe-nav";
    nav.id = "swipe-nav";
    nav.setAttribute("role", "dialog");
    nav.setAttribute("aria-modal", "true");
    nav.setAttribute("aria-label", "Site menu");
    nav.setAttribute("aria-hidden", "true");
    nav.innerHTML =
      '<div class="swipe-nav__panel">' +
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
    // Keep the trigger on body so position:fixed stays viewport-bound and
    // is never trapped by the frame's transform / will-change.
    document.body.appendChild(trigger);
    document.body.classList.add("swipe-nav-ready");

    function placeStay(el) {
      if (!el || el.classList.contains("swipe-nav__stay")) return;
      el.classList.add("swipe-nav__stay");
      document.body.insertBefore(el, frame);
    }

    function ensureStayChrome() {
      if (!isMobile()) return;

      var topNav = document.querySelector(".top-nav");
      if (topNav) placeStay(topNav);

      var layout = frame.querySelector(".layout");
      var sidebar = layout && layout.querySelector(":scope > .sidebar");
      if (!sidebar) {
        sidebar = document.querySelector("body > .sidebar.swipe-nav__stay");
      }
      if (sidebar) {
        var card = sidebar.querySelector(".profile-card");
        if (card && isVisible(card)) {
          placeStay(sidebar);
        }
      }
    }

    function restoreStayChrome() {
      var sidebar = document.querySelector("body > .sidebar.swipe-nav__stay");
      var layout = frame.querySelector(".layout");
      if (sidebar && layout) {
        sidebar.classList.remove("swipe-nav__stay");
        layout.insertBefore(sidebar, layout.firstChild);
      }
      var topNav = document.querySelector("body > .top-nav.swipe-nav__stay");
      if (topNav) {
        topNav.classList.remove("swipe-nav__stay");
        document.body.insertBefore(topNav, frame);
      }
    }

    function syncChrome() {
      var hasCard = isMobile() && hasVisibleProfileCard();
      document.body.classList.toggle("mobile-profile-card", hasCard);
      // Identity lives in the card or the navbar logo — never a floating trigger.
      trigger.hidden = true;
      trigger.tabIndex = -1;
      trigger.setAttribute("aria-hidden", "true");
      if (isMobile()) ensureStayChrome();
      else restoreStayChrome();
      menuButtons = Array.prototype.slice.call(
        document.querySelectorAll(".top-nav__menu-btn, [data-nav-menu-toggle]")
      );
    }

    function syncMenuButtons() {
      menuButtons.forEach(function (btn) {
        btn.setAttribute("aria-expanded", open ? "true" : "false");
      });
    }

    var focusables = [];

    function refreshFocusables() {
      focusables = Array.prototype.slice.call(
        nav.querySelectorAll("a[href], button:not([disabled])")
      );
    }

    function setProgress(next, animate) {
      progress = Math.max(0, Math.min(1, next));
      var x = Math.round(progress * panelWidth);
      var scale = prefersReducedMotion() ? 1 : 1 - progress * 0.035;
      var radius = Math.round(progress * 18);
      var reduce = prefersReducedMotion();
      var revealed = progress > 0.01;
      frame.style.transition =
        animate && !reduce
          ? "transform 280ms ease, border-radius 280ms ease"
          : "none";
      if (progress <= 0) {
        frame.style.transform = "";
        frame.style.borderRadius = "";
      } else {
        frame.style.transform =
          "translate3d(" + x + "px,0,0) scale(" + scale + ")";
        frame.style.borderRadius = radius + "px";
      }
      frame.classList.toggle("is-offset", revealed);
      nav.classList.toggle("is-revealed", revealed);
      document.body.classList.toggle("swipe-nav-open", progress > 0.5);
    }

    function lockScroll() {
      if (scrollLocked) return;
      var now = window.scrollY || window.pageYOffset || 0;
      if (now > 0) lockY = now;
      scrollLocked = true;
      document.documentElement.classList.add("swipe-nav-locked");
      document.body.classList.add("swipe-nav-locked");
      document.body.style.position = "fixed";
      document.body.style.top = "-" + lockY + "px";
      document.body.style.left = "0";
      document.body.style.right = "0";
      document.body.style.width = "100%";
    }

    function unlockScroll() {
      if (!scrollLocked) return;
      scrollLocked = false;
      document.documentElement.classList.remove("swipe-nav-locked");
      document.body.classList.remove("swipe-nav-locked");
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.left = "";
      document.body.style.right = "";
      document.body.style.width = "";
      window.scrollTo(0, lockY);
    }

    function setOpen(next) {
      open = !!next;
      if (open) lockScroll();
      setProgress(open ? 1 : 0, true);
      trigger.setAttribute("aria-expanded", open ? "true" : "false");
      trigger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      nav.setAttribute("aria-hidden", open ? "false" : "true");
      syncMenuButtons();
      document.body.classList.toggle("swipe-nav-open", open);
      if (open) {
        refreshFocusables();
      } else {
        unlockScroll();
      }
    }

    function onPointerDown(event) {
      if (!isMobile()) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      if (document.body.classList.contains("footer-revealed")) return;
      if (event.target.closest("input, textarea, select, [data-note-toc]")) return;
      // Stay chrome handles its own taps; don't start an edge drag from it.
      if (event.target.closest(".swipe-nav__stay, .top-nav, .profile-card")) return;

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
        lockScroll();
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
      if (event.target.closest(".swipe-nav__stay, .top-nav, .profile-card")) return;
      setOpen(false);
    }

    document.addEventListener("pointerdown", rememberScroll, { passive: true });
    document.addEventListener("touchstart", rememberScroll, { passive: true });

    trigger.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(!open);
      trigger.blur();
    });

    function onTouchMove(event) {
      if (!open && !scrollLocked) return;
      event.preventDefault();
    }

    document.addEventListener(
      "click",
      function (event) {
        if (!isMobile()) return;
        var btn = event.target.closest(
          ".top-nav__menu-btn, [data-nav-menu-toggle], .profile-card__menu"
        );
        if (!btn) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        setOpen(!open);
        btn.blur();
      },
      true
    );

    frame.addEventListener("pointerdown", onPointerDown);
    frame.addEventListener("pointermove", onPointerMove, { passive: false });
    frame.addEventListener("pointerup", onPointerUp);
    frame.addEventListener("pointercancel", onPointerUp);
    frame.addEventListener("click", onFrameClick);
    document.addEventListener("keydown", onKeydown);
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener(
      "wheel",
      function (event) {
        if (!open && !scrollLocked) return;
        event.preventDefault();
      },
      { passive: false }
    );

    window.addEventListener("resize", function () {
      panelWidth = Math.min(PANEL, Math.round(window.innerWidth * 0.82));
      if (!isMobile()) {
        setOpen(false);
        frame.style.transform = "";
        frame.style.borderRadius = "";
        document.body.classList.remove("swipe-nav-open");
        unlockScroll();
        restoreStayChrome();
      } else {
        ensureStayChrome();
        setProgress(open ? 1 : 0, false);
      }
    });

    nav.querySelectorAll("a[href]").forEach(function (link) {
      link.addEventListener("click", function () {
        setOpen(false);
      });
    });

    if (window.initAvatars) window.initAvatars(document.body);
    syncChrome();
    if (typeof MutationObserver !== "undefined") {
      new MutationObserver(function () {
        syncChrome();
      }).observe(document.body, { childList: true, subtree: true });
    }
    window.addEventListener("resize", syncChrome);

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
