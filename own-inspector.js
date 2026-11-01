// Own-mode hover inspector. No-ops unless body.own-mode is present.
(function () {
  "use strict";

  var STORAGE_KEY = "kw-inspector";
  var outline = null;
  var overlay = null;
  var nameEl = null;
  var classesEl = null;
  var activeEl = null;
  var enabled = false;
  var bound = false;
  var reduceMotion = false;

  function hasOwnMode() {
    return !!(document.body && document.body.classList.contains("own-mode"));
  }

  function readEnabled() {
    try {
      var v = sessionStorage.getItem(STORAGE_KEY);
      if (v === null || v === undefined || v === "") return true;
      return v === "1";
    } catch (_) {
      return true;
    }
  }

  function writeEnabled(on) {
    try {
      sessionStorage.setItem(STORAGE_KEY, on ? "1" : "0");
    } catch (_) {}
  }

  function ensureUi() {
    if (outline) return;
    outline = document.createElement("div");
    outline.className = "own-inspector-outline";
    outline.setAttribute("aria-hidden", "true");

    overlay = document.createElement("div");
    overlay.className = "own-inspector-overlay";
    overlay.setAttribute("aria-hidden", "true");

    nameEl = document.createElement("span");
    nameEl.className = "own-inspector-overlay__name";
    classesEl = document.createElement("span");
    classesEl.className = "own-inspector-overlay__classes";
    overlay.appendChild(nameEl);
    overlay.appendChild(classesEl);

    document.documentElement.appendChild(outline);
    document.documentElement.appendChild(overlay);
  }

  function clearHighlight() {
    activeEl = null;
    if (outline) {
      outline.removeAttribute("data-active");
      outline.style.width = "0px";
      outline.style.height = "0px";
    }
    if (overlay) overlay.removeAttribute("data-active");
  }

  function classListText(el) {
    if (!el || !el.classList || !el.classList.length) return "(no classes)";
    return Array.prototype.slice.call(el.classList).join(" ");
  }

  function findTarget(from) {
    if (!from || from.nodeType !== 1) return null;
    if (from === document.documentElement || from === document.body) return null;
    if (outline && (from === outline || outline.contains(from))) return null;
    if (overlay && (from === overlay || overlay.contains(from))) return null;
    var tagged = from.closest ? from.closest("[data-component]") : null;
    return tagged || from;
  }

  function placeUi(el) {
    if (!el || !outline || !overlay) return;
    var rect = el.getBoundingClientRect();
    if (!rect.width && !rect.height) {
      clearHighlight();
      return;
    }

    outline.style.transform =
      "translate(" +
      Math.round(rect.left) +
      "px," +
      Math.round(rect.top) +
      "px)";
    outline.style.width = Math.max(0, Math.round(rect.width)) + "px";
    outline.style.height = Math.max(0, Math.round(rect.height)) + "px";
    outline.setAttribute("data-active", "true");

    var name = el.getAttribute("data-component");
    nameEl.textContent = name || el.tagName.toLowerCase();
    classesEl.textContent = classListText(el);

    var tipW = overlay.offsetWidth || 180;
    var tipH = overlay.offsetHeight || 36;
    var gap = 8;
    var left = Math.round(rect.left);
    var top = Math.round(rect.bottom + gap);

    if (left + tipW > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - tipW - 8);
    }
    if (left < 8) left = 8;

    if (top + tipH > window.innerHeight - 8) {
      top = Math.round(rect.top - tipH - gap);
    }
    if (top < 8) top = 8;

    overlay.style.transform = "translate(" + left + "px," + top + "px)";
    overlay.setAttribute("data-active", "true");
  }

  function highlight(el) {
    if (!enabled || !hasOwnMode()) {
      clearHighlight();
      return;
    }
    ensureUi();
    activeEl = el;
    placeUi(el);
  }

  function onPointerOver(e) {
    if (!enabled || !hasOwnMode()) return;
    var target = findTarget(e.target);
    if (!target) {
      clearHighlight();
      return;
    }
    if (target === activeEl) {
      placeUi(target);
      return;
    }
    highlight(target);
  }

  function onPointerOut(e) {
    if (!enabled || !hasOwnMode()) return;
    var related = e.relatedTarget;
    if (related && related.nodeType === 1) {
      if (outline && (related === outline || outline.contains(related))) return;
      if (overlay && (related === overlay || overlay.contains(related))) return;
      if (findTarget(related)) return;
    }
    clearHighlight();
  }

  function onScrollOrResize() {
    if (!enabled || !activeEl) return;
    placeUi(activeEl);
  }

  function setEnabled(on) {
    enabled = !!on;
    writeEnabled(enabled);
    if (!enabled) clearHighlight();
  }

  function onKeyDown(e) {
    if (!hasOwnMode()) return;

    var isToggle =
      (e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "E" || e.key === "e");
    if (isToggle) {
      e.preventDefault();
      setEnabled(!enabled);
      return;
    }

    if (e.key === "Escape" && enabled) {
      e.preventDefault();
      setEnabled(false);
    }
  }

  function bind() {
    if (bound) return;
    bound = true;
    document.addEventListener("pointerover", onPointerOver, true);
    document.addEventListener("pointerout", onPointerOut, true);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    document.addEventListener("keydown", onKeyDown, true);
  }

  function boot() {
    if (!hasOwnMode()) return;
    try {
      reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;
    } catch (_) {
      reduceMotion = false;
    }
    void reduceMotion;
    ensureUi();
    enabled = readEnabled();
    bind();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  window.krethOwnInspector = {
    enable: function () {
      setEnabled(true);
    },
    disable: function () {
      setEnabled(false);
    },
    isEnabled: function () {
      return enabled;
    },
  };
})();
