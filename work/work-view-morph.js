// Desk ↔ list FLIP: stickers fly to favicon slots (and back).
(function () {
  "use strict";

  var STORAGE_KEY = "kreth-work-view-morph";
  var MAX_AGE_MS = 4000;
  var DURATION_MS = 280;
  var STAGGER_MS = 14;
  var EASE = "cubic-bezier(0.77, 0, 0.175, 1)";
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function readPayload() {
    try {
      var raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || !data.dir || !Array.isArray(data.items)) return null;
      if (Date.now() - (data.ts || 0) > MAX_AGE_MS) {
        sessionStorage.removeItem(STORAGE_KEY);
        return null;
      }
      return data;
    } catch (_) {
      return null;
    }
  }

  function clearPayload() {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch (_) {}
  }

  function writePayload(dir, items) {
    try {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ dir: dir, ts: Date.now(), items: items })
      );
    } catch (_) {}
  }

  function visibleEnough(rect) {
    return rect.width > 2 && rect.height > 2;
  }

  function captureStickers() {
    var nodes = document.querySelectorAll(
      '.sticker-board--scattered .sticker[data-work-slug][data-tile-dx="0"][data-tile-dy="0"]'
    );
    var items = [];
    nodes.forEach(function (el) {
      var slug = el.getAttribute("data-work-slug");
      if (!slug) return;
      var rect = el.getBoundingClientRect();
      if (!visibleEnough(rect)) return;
      var img = el.querySelector("img");
      var rot = 0;
      try {
        var t = getComputedStyle(el).transform;
        if (t && t !== "none") {
          var m = new DOMMatrixReadOnly(t);
          rot = (Math.atan2(m.b, m.a) * 180) / Math.PI;
        }
      } catch (_) {
        var cssRot = getComputedStyle(el).getPropertyValue("--rot");
        rot = parseFloat(cssRot) || 0;
      }
      items.push({
        slug: slug,
        src: img && img.currentSrc ? img.currentSrc : img ? img.src : "",
        x: rect.left,
        y: rect.top,
        w: rect.width,
        h: rect.height,
        r: rot,
        radius: 14,
      });
    });
    return items;
  }

  function captureIcons() {
    var nodes = document.querySelectorAll(
      ".work-archive__row[data-work-slug] .work-archive__icon"
    );
    var items = [];
    nodes.forEach(function (el) {
      var row = el.closest("[data-work-slug]");
      var slug = row && row.getAttribute("data-work-slug");
      if (!slug) return;
      var rect = el.getBoundingClientRect();
      if (!visibleEnough(rect)) return;
      var src = el.tagName === "IMG" ? el.currentSrc || el.src : "";
      items.push({
        slug: slug,
        src: src,
        x: rect.left,
        y: rect.top,
        w: rect.width,
        h: rect.height,
        r: 0,
        radius: 3,
      });
    });
    return items;
  }

  function measureTarget(el) {
    if (!el) return null;
    var rect = el.getBoundingClientRect();
    if (!visibleEnough(rect)) return null;
    var radius = 3;
    try {
      radius = parseFloat(getComputedStyle(el).borderRadius) || radius;
    } catch (_) {}
    return {
      x: rect.left,
      y: rect.top,
      w: rect.width,
      h: rect.height,
      r: 0,
      radius: radius,
      el: el,
    };
  }

  function ensureLayer() {
    var layer = document.querySelector(".work-view-morph");
    if (layer) return layer;
    layer = document.createElement("div");
    layer.className = "work-view-morph";
    layer.setAttribute("aria-hidden", "true");
    document.body.appendChild(layer);
    return layer;
  }

  function finish(layer, hidden, onDone) {
    if (layer && layer.parentNode) layer.parentNode.removeChild(layer);
    hidden.forEach(function (el) {
      el.classList.remove("work-view-morph-hidden");
    });
    document.documentElement.classList.remove("is-work-view-morphing");
    clearPayload();
    if (typeof onDone === "function") onDone();
  }

  function play(payload, getTargetEl, onDone) {
    if (!payload || !payload.items || !payload.items.length) {
      clearPayload();
      if (typeof onDone === "function") onDone();
      return;
    }

    document.documentElement.classList.add("is-work-view-morphing");
    var layer = ensureLayer();
    layer.replaceChildren();
    var hidden = [];
    var pending = 0;
    var settled = false;

    function settle() {
      if (settled) return;
      settled = true;
      finish(layer, hidden, onDone);
    }

    payload.items.forEach(function (from, index) {
      var targetEl = getTargetEl(from.slug);
      var to = measureTarget(targetEl);
      if (!to) return;

      targetEl.classList.add("work-view-morph-hidden");
      hidden.push(targetEl);

      var ghost = document.createElement("div");
      ghost.className = "work-view-morph__item";
      ghost.style.left = from.x + "px";
      ghost.style.top = from.y + "px";
      ghost.style.width = from.w + "px";
      ghost.style.height = from.h + "px";
      ghost.style.borderRadius = (from.radius || 8) + "px";
      ghost.style.transform = "translate(0px, 0px) rotate(" + (from.r || 0) + "deg) scale(1, 1)";

      if (from.src) {
        var img = document.createElement("img");
        img.src = from.src;
        img.alt = "";
        img.draggable = false;
        ghost.appendChild(img);
      }
      layer.appendChild(ghost);

      var sx = to.w / Math.max(from.w, 0.001);
      var sy = to.h / Math.max(from.h, 0.001);
      var tx = to.x - from.x;
      var ty = to.y - from.y;
      var delay = Math.min(index * STAGGER_MS, 180);

      pending += 1;
      var anim = ghost.animate(
        [
          {
            transform:
              "translate(0px, 0px) rotate(" +
              (from.r || 0) +
              "deg) scale(1, 1)",
            borderRadius: (from.radius || 8) + "px",
            boxShadow: "0 1px 2px rgba(33, 32, 28, 0.05)",
          },
          {
            transform:
              "translate(" +
              tx +
              "px, " +
              ty +
              "px) rotate(0deg) scale(" +
              sx +
              ", " +
              sy +
              ")",
            borderRadius: (to.radius || 3) / Math.max(Math.min(sx, sy), 0.001) + "px",
            boxShadow: "0 0 0 rgba(33, 32, 28, 0)",
          },
        ],
        {
          duration: DURATION_MS,
          delay: delay,
          easing: EASE,
          fill: "forwards",
        }
      );

      anim.finished.then(
        function () {
          pending -= 1;
          if (pending <= 0) settle();
        },
        function () {
          pending -= 1;
          if (pending <= 0) settle();
        }
      );
    });

    if (pending <= 0) {
      settle();
      return;
    }

    window.setTimeout(settle, DURATION_MS + 220);
  }

  function go(href, dir) {
    if (reduceMotion) return false;
    var items = dir === "desk-to-list" ? captureStickers() : captureIcons();
    if (!items.length) return false;
    writePayload(dir, items);
    window.location.href = href;
    return true;
  }

  function hasPending(dir) {
    var payload = readPayload();
    if (!payload) return false;
    if (dir && payload.dir !== dir) return false;
    return true;
  }

  function playPending(opts) {
    opts = opts || {};
    var payload = readPayload();
    if (!payload) {
      if (typeof opts.onDone === "function") opts.onDone(false);
      return false;
    }
    if (opts.dir && payload.dir !== opts.dir) {
      if (typeof opts.onDone === "function") opts.onDone(false);
      return false;
    }
    if (reduceMotion) {
      clearPayload();
      if (typeof opts.onDone === "function") opts.onDone(false);
      return false;
    }

    var getTarget =
      typeof opts.getTarget === "function"
        ? opts.getTarget
        : function () {
            return null;
          };

    // Wait a frame so layout (list/desk) has settled before measuring.
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        play(payload, getTarget, function () {
          if (typeof opts.onDone === "function") opts.onDone(true);
        });
      });
    });
    return true;
  }

  // Avoid a one-frame flash of real stickers/icons before ghosts mount.
  if (hasPending()) {
    document.documentElement.classList.add("is-work-view-morphing");
  }

  window.krethWorkViewMorph = {
    go: go,
    hasPending: hasPending,
    playPending: playPending,
    clear: clearPayload,
  };
})();
