/* Polaroid stack: each print can be dragged across the desk. A tap with no
   movement still sends the top (unmoved) print to the back of the remaining
   pile. Enter/Space and arrow keys do the same. Photos come from
   #polaroid-data or assets/polaroids.json. All 20 figures are rendered;
   only the front few of the remaining pile, plus any already pulled out,
   get their src until they come forward. */
(function () {
  "use strict";

  var DATA_URL = "/assets/polaroids.json";
  var REST_SHADOW =
    "0 1px 1px rgba(50, 45, 35, 0.09), 0 3px 8px rgba(50, 45, 35, 0.10), " +
    "0 10px 18px -8px rgba(50, 45, 35, 0.12)";
  var LIFT_SHADOW =
    "0 1px 2px rgba(50, 45, 35, 0.10), 0 8px 16px -4px rgba(50, 45, 35, 0.16), " +
    "0 16px 28px -10px rgba(50, 45, 35, 0.12)";
  var LOCK_PX = 10;
  var PEEK = 6;
  var DESKTOP_SPREAD = "(min-width: 1100px)";

  /* Back to front. Offsets are from the right and top of the intro, with
     the oyster print tucked under the profile on the left. */
  var DESK_LAYOUT = [
    ["i-do-what-i-want", 397, 57],
    ["giza", 310, 290],
    ["trail-day", 20, 66],
    ["highway-1", 140, 241],
    ["definitely-not-italian", 400, 318],
    ["oysters-on-fire", null, 126],
    ["korean-fried-chicken", 130, 149],
    ["out-on-the-water", 264, 138],
    ["kickflip", 136, 292],
    ["new-york", 84, 437]
  ];

  /* Slot offsets for piles of 3 to 6. Index 0 is the top print. */
  var SLOTS = {
    3: [
      { x: "1px", y: "0px", rot: "-1.5deg", cap: "-0.4deg" },
      { x: "16px", y: "6px", rot: "7.4deg", cap: "0.6deg" },
      { x: "-14px", y: "7px", rot: "-7.2deg", cap: "-0.8deg" }
    ],
    4: [
      { x: "1px", y: "0px", rot: "-1.5deg", cap: "-0.4deg" },
      { x: "16px", y: "5px", rot: "7.2deg", cap: "0.6deg" },
      { x: "-16px", y: "6px", rot: "-7.6deg", cap: "-0.8deg" },
      { x: "9px", y: "14px", rot: "4.0deg", cap: "0.3deg" }
    ],
    5: [
      { x: "1px", y: "0px", rot: "-1.5deg", cap: "-0.5deg" },
      { x: "16px", y: "5px", rot: "7.2deg", cap: "0.6deg" },
      { x: "-16px", y: "6px", rot: "-7.8deg", cap: "-0.8deg" },
      { x: "10px", y: "14px", rot: "4.2deg", cap: "0.4deg" },
      { x: "-9px", y: "13px", rot: "-4.8deg", cap: "-0.3deg" }
    ],
    6: [
      { x: "1px", y: "0px", rot: "-1.5deg", cap: "-0.4deg" },
      { x: "16px", y: "4px", rot: "7.4deg", cap: "0.6deg" },
      { x: "-16px", y: "6px", rot: "-7.8deg", cap: "-0.8deg" },
      { x: "11px", y: "13px", rot: "4.6deg", cap: "0.4deg" },
      { x: "-10px", y: "14px", rot: "-5.0deg", cap: "-0.3deg" },
      { x: "4px", y: "10px", rot: "2.4deg", cap: "0.2deg" }
    ]
  };

  function reduced() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function isPhone() {
    return window.matchMedia && window.matchMedia("(max-width: 767px)").matches;
  }

  function slotsFor(n) {
    if (SLOTS[n]) return SLOTS[n];
    if (n > 6) {
      var base = SLOTS[6];
      var hidden = { x: "0px", y: "0px", rot: "0deg", cap: "0deg" };
      var out = [];
      for (var i = 0; i < n; i++) out.push(i < base.length ? base[i] : hidden);
      return out;
    }
    var base = SLOTS[Math.min(6, Math.max(3, n))] || SLOTS[5];
    var out = [];
    for (var i = 0; i < n; i++) out.push(base[i % base.length]);
    return out;
  }

  function isLoose(fig) {
    return fig.classList.contains("is-loose");
  }

  function stackedOf(figures) {
    return figures.filter(function (f) { return !isLoose(f); });
  }

  function parsePx(v) {
    var n = parseFloat(v);
    return isFinite(n) ? n : 0;
  }

  function parseDeg(v) {
    var n = parseFloat(v);
    return isFinite(n) ? n : 0;
  }

  function applyLooseTransform(fig) {
    if (fig._hoisted) {
      fig.style.left = fig._x + "px";
      fig.style.top = fig._y + "px";
      fig.style.transform = "rotate(" + fig._rot + "deg)";
    } else {
      fig.style.transform =
        "translate(" + fig._x + "px, " + fig._y + "px) rotate(" + fig._rot + "deg)";
    }
    fig.style.setProperty("--x", fig._x + "px");
    fig.style.setProperty("--y", fig._y + "px");
    fig.style.setProperty("--rot", fig._rot + "deg");
  }

  function ensureSpread(intro) {
    if (!intro) return null;
    var el = intro.querySelector(":scope > .polaroids__spread");
    if (el) return el;
    el = document.createElement("div");
    el.className = "polaroids__spread";
    el.setAttribute("data-desk-layer", "");
    intro.appendChild(el);
    return el;
  }

  function placeDefaultPhotos(root, figures, spread, wide) {
    if (figures.length <= PEEK) return;
    spread.classList.toggle("has-default-layout", wide);

    DESK_LAYOUT.forEach(function (placement, layer) {
      var name = placement[0];
      var fig = figures.find(function (photo) { return photo.dataset.photo === name; });
      if (!fig) return;

      if (!wide && fig.classList.contains("is-placed")) {
        fig.classList.remove("is-placed", "is-loose", "is-by-profile");
        fig._hoisted = false;
        root.appendChild(fig);
      } else if (wide && !isLoose(fig)) {
        fig.classList.remove("is-buried");
        fig.classList.add("is-placed", "is-loose");
        fig.classList.toggle("is-by-profile", placement[1] === null);
        fig.style.setProperty("--desk-right", placement[1] || 0);
        fig.style.setProperty("--desk-top", placement[2]);
        fig.style.zIndex = String(layer + 1);
        fig._hoisted = true;
        spread.appendChild(fig);
      }
    });

    applySlots(figures);
    ensureVisibleSources(figures);
    announce(root, figures);
  }

  /* Lift a print out of the rotated pile into the intro spread layer so it
     can paint above the notepad. Keep its on-screen position unchanged. */
  function hoistLoose(fig, spread) {
    if (fig._hoisted || !spread) return;
    var prev = fig.getBoundingClientRect();
    spread.appendChild(fig);
    fig._hoisted = true;
    fig.style.left = "0px";
    fig.style.top = "0px";
    fig.style.transform = "rotate(" + fig._rot + "deg)";
    var now = fig.getBoundingClientRect();
    fig._x = prev.left - now.left;
    fig._y = prev.top - now.top;
    applyLooseTransform(fig);
  }

  /* Keep hoisted prints on-screen so they cannot be lost sideways or
     open a horizontal page scroll. */
  function clampLoose(fig) {
    if (!fig._hoisted) return;
    applyLooseTransform(fig);
    var r = fig.getBoundingClientRect();
    var vw = document.documentElement.clientWidth || window.innerWidth;
    var vh = document.documentElement.clientHeight || window.innerHeight;
    var m = 8;
    var dx = 0, dy = 0;
    if (r.left < m) dx = m - r.left;
    else if (r.right > vw - m) dx = (vw - m) - r.right;
    if (r.top < m) dy = m - r.top;
    else if (r.bottom > vh - m) dy = (vh - m) - r.bottom;
    if (dx || dy) {
      fig._x += dx;
      fig._y += dy;
      applyLooseTransform(fig);
    }
  }

  var topZ = 20;

  function bringToFront(fig) {
    topZ += 1;
    fig.style.zIndex = String(topZ);
  }

  function applySlots(figures) {
    var pile = stackedOf(figures);
    var slots = slotsFor(pile.length);
    pile.forEach(function (fig, i) {
      var s = slots[i] || { x: "0px", y: "0px", rot: "0deg", cap: "0deg" };
      fig.dataset.slot = String(i);
      fig.style.setProperty("--slot", String(i));
      fig.style.setProperty("--x", s.x);
      fig.style.setProperty("--y", s.y);
      fig.style.setProperty("--rot", s.rot);
      fig.style.setProperty("--cap-rot", s.cap);
      fig.style.zIndex = String(10 - i);
      fig.style.transform = "";
      if (i < PEEK) fig.classList.remove("is-buried");
      else fig.classList.add("is-buried");
    });
  }

  function applySource(img) {
    if (!img || img.dataset.loaded === "1") return;
    var webp = img.dataset.webp;
    var jpg = img.dataset.jpg;
    if (webp) {
      var source = img.parentNode && img.parentNode.querySelector("source[type='image/webp']");
      if (source) source.srcset = webp;
    }
    if (jpg) img.src = jpg;
    img.dataset.loaded = "1";
  }

  function ensureVisibleSources(figures) {
    stackedOf(figures).slice(0, PEEK).forEach(function (fig) {
      applySource(fig.querySelector(".polaroid__photo"));
    });
    figures.forEach(function (fig) {
      if (isLoose(fig)) applySource(fig.querySelector(".polaroid__photo"));
    });
  }

  function photoSize() {
    return isPhone() ? 136 : 185;
  }

  function render(root, photos) {
    var size = photoSize();
    var status = document.createElement("p");
    status.className = "polaroids__status";
    status.setAttribute("aria-live", "polite");
    status.dataset.status = "";
    root.innerHTML = "";
    root.appendChild(status);
    photos.forEach(function (photo, i) {
      var fig = document.createElement("figure");
      fig.className = "polaroid";
      fig.dataset.photo = (photo.src || photo.webp || "").split("/").pop().replace(/\.[^.]+$/, "");
      var card = document.createElement("div");
      card.className = "polaroid__card";
      var win = document.createElement("div");
      win.className = "polaroid__window";
      var img = document.createElement("img");
      img.className = "polaroid__photo";
      img.alt = photo.alt || "";
      img.draggable = false;
      img.setAttribute("draggable", "false");
      img.width = size;
      img.height = size;
      img.sizes = "(max-width: 767px) 136px, 185px";
      img.decoding = "async";
      img.dataset.jpg = photo.src || "";
      if (photo.webp) img.dataset.webp = photo.webp;
      if (i === 0) {
        img.loading = "eager";
        img.setAttribute("fetchpriority", "low");
      } else {
        img.loading = "lazy";
      }
      if (photo.webp) {
        var pic = document.createElement("picture");
        var source = document.createElement("source");
        source.type = "image/webp";
        pic.appendChild(source);
        pic.appendChild(img);
        win.appendChild(pic);
      } else {
        win.appendChild(img);
      }
      if (i < PEEK) applySource(img);
      var cap = document.createElement("figcaption");
      cap.className = "polaroid__caption";
      cap.textContent = photo.caption || "";
      card.appendChild(win);
      card.appendChild(cap);
      fig.appendChild(card);
      root.appendChild(fig);
    });
    var figures = Array.prototype.slice.call(root.querySelectorAll(".polaroid"));
    applySlots(figures);
    ensureVisibleSources(figures);
    return figures;
  }

  function topCaption(figures) {
    var pile = stackedOf(figures);
    var fig = pile[0];
    if (!fig) return "";
    var cap = fig.querySelector(".polaroid__caption");
    return cap ? cap.textContent.trim() : "";
  }

  function announce(root, figures) {
    var status = root.querySelector("[data-status]");
    if (!status || !figures.length) return;
    var cap = topCaption(figures);
    var n = figures.length;
    status.textContent = cap ? "On top of the stack: " + cap : "All photos are spread out.";
    root.setAttribute(
      "aria-label",
      "Polaroid gallery, " + n + " photos. " +
        (cap ? "On top of the stack: “" + cap + "”. " : "") +
        "Drag a photo to move it. Press Enter or the arrow keys to flip through the stack."
    );
  }

  function cycle(root, figures, dir) {
    if (root._busy || stackedOf(figures).length < 2) return;
    root._busy = true;
    dir = dir || 1;
    var motionOff = reduced();
    var pile = stackedOf(figures);
    var moving;

    function finish() {
      moving.classList.remove("is-cycling");
      var card = moving.querySelector(".polaroid__card");
      if (card) {
        card.getAnimations().forEach(function (a) { a.cancel(); });
        card.style.transform = "";
        card.style.boxShadow = "";
      }
      root._busy = false;
      announce(root, figures);
    }

    /* Cycle only the remaining pile, so loose prints stay where they were put. */
    if (dir > 0) {
      moving = pile[0];
      var from = figures.indexOf(moving);
      figures.splice(from, 1);
      /* insert after the last stacked print (before trailing loose ones if any) */
      var lastStacked = -1;
      for (var i = 0; i < figures.length; i++) {
        if (!isLoose(figures[i])) lastStacked = i;
      }
      figures.splice(lastStacked + 1, 0, moving);
    } else {
      moving = pile[pile.length - 1];
      var fromB = figures.indexOf(moving);
      figures.splice(fromB, 1);
      var firstStacked = 0;
      for (var j = 0; j < figures.length; j++) {
        if (!isLoose(figures[j])) { firstStacked = j; break; }
      }
      figures.splice(firstStacked, 0, moving);
    }

    if (motionOff || typeof moving.animate !== "function") {
      applySlots(figures);
      ensureVisibleSources(figures);
      announce(root, figures);
      root._busy = false;
      return;
    }
    moving.classList.add("is-cycling");
    var card = moving.querySelector(".polaroid__card");
    var liftX = dir > 0 ? "22px" : "-18px";
    var liftRot = dir > 0 ? "6deg" : "-5deg";

    var lift = card.animate(
      [
        { transform: "translateY(0) scale(1)", boxShadow: REST_SHADOW },
        {
          transform: "translateY(-38px) translateX(" + liftX + ") rotate(" + liftRot + ") scale(1.05)",
          boxShadow: LIFT_SHADOW
        }
      ],
      { duration: 280, easing: "cubic-bezier(0.22, 0.7, 0.2, 1)", fill: "forwards" }
    );

    lift.finished.then(function () {
      applySlots(figures);
      ensureVisibleSources(figures);
      return card.animate(
        [
          {
            transform: "translateY(-38px) translateX(" + liftX + ") rotate(" + liftRot + ") scale(1.05)",
            boxShadow: LIFT_SHADOW
          },
          {
            transform: "translateY(6px) scale(1)",
            boxShadow: REST_SHADOW,
            offset: 0.72
          },
          { transform: "none", boxShadow: REST_SHADOW }
        ],
        { duration: 440, easing: "cubic-bezier(0.22, 0.8, 0.25, 1)", fill: "forwards" }
      ).finished;
    }).then(finish).catch(finish);
  }

  function parentAngle(el) {
    var t = window.getComputedStyle(el).transform;
    if (!t || t === "none") return 0;
    try {
      var m = new DOMMatrix(t);
      return Math.atan2(m.b, m.a);
    } catch (err) {
      return 0;
    }
  }

  function toLocal(dx, dy, theta) {
    var c = Math.cos(-theta), s = Math.sin(-theta);
    return { x: dx * c - dy * s, y: dx * s + dy * c };
  }

  function bindDrag(root, figures, spread) {
    var drag = null;
    var desk = window.DeskDrag;
    var looseFromPile = new Set();
    var intro = root.closest(".home-intro") || document.querySelector(".home-intro");
    if (!spread && intro) spread = ensureSpread(intro);
    var pileSlot = desk && desk.createSlot("Polaroids", function () {
      return root.getBoundingClientRect();
    }, spread);

    function rememberHome(fig) {
      if (!desk || fig._deskHome) return;
      if (fig.classList.contains("is-placed") && spread) {
        var anchor = fig.cloneNode(false);
        anchor.classList.add("polaroid--anchor");
        anchor.setAttribute("aria-hidden", "true");
        spread.appendChild(anchor);
        fig._deskHome = {
          anchor: anchor,
          slot: desk.createSlot(fig.querySelector("figcaption").textContent, function () {
            return spread.classList.contains("has-default-layout")
              ? anchor.getBoundingClientRect() : root.getBoundingClientRect();
          }, spread)
        };
      } else {
        looseFromPile.add(fig);
        fig._deskHome = { slot: pileSlot };
      }
      fig._deskHome.slot.show();
    }

    function snapHome(fig) {
      var home = fig._deskHome;
      if (!home || !home.slot.near(fig.getBoundingClientRect())) return false;
      var anchor = home.anchor;
      fig.classList.remove("is-dragging", "is-settling");
      fig.style.left = "";
      fig.style.top = "";
      fig.style.transform = "";
      if (anchor && spread.classList.contains("has-default-layout")) {
        fig.classList.add("is-placed");
        fig.classList.toggle("is-by-profile", anchor.classList.contains("is-by-profile"));
        fig.style.zIndex = anchor.style.zIndex;
      } else {
        fig.classList.remove("is-loose");
        fig._hoisted = false;
        root.appendChild(fig);
        applySlots(figures);
        ensureVisibleSources(figures);
      }
      if (anchor) {
        anchor.remove();
        home.slot.hide();
      } else {
        looseFromPile.delete(fig);
        if (looseFromPile.size) pileSlot.show();
        else pileSlot.hide();
      }
      fig._deskHome = null;
      return true;
    }

    function owns(fig) {
      return fig && (root.contains(fig) || (spread && spread.contains(fig)) || isLoose(fig));
    }

    function onDown(e) {
      if (drag || (desk && !desk.dragSelected())) return;
      if (e.isPrimary === false) return;
      if (e.button != null && e.button !== 0) return;
      if (root._busy) return;
      var fig = e.target.closest && e.target.closest(".polaroid");
      if (!fig || !owns(fig) || fig.classList.contains("is-buried")) return;
      if (fig._settleFrame) {
        cancelAnimationFrame(fig._settleFrame);
        fig._settleFrame = 0;
        fig.classList.remove("is-settling");
      }
      /* Don't start a page curl or swipe-nav from a photo. Scroll is
         blocked by touch-action: none on the print itself; a touch that
         starts outside the photos still scrolls the page. */
      e.stopPropagation();
      var placed = fig.classList.contains("is-placed");
      drag = {
        id: e.pointerId,
        fig: fig,
        x0: e.clientX,
        y0: e.clientY,
        lastX: e.clientX,
        lastT: performance.now(),
        samples: [{ x: e.clientX, y: e.clientY, t: performance.now() }],
        axis: "",
        moved: false,
        startX: placed ? fig.offsetLeft : isLoose(fig) ? fig._x : parsePx(fig.style.getPropertyValue("--x")),
        startY: placed ? fig.offsetTop : isLoose(fig) ? fig._y : parsePx(fig.style.getPropertyValue("--y")),
        rot: placed ? parentAngle(fig) * 180 / Math.PI
          : isLoose(fig) ? fig._rot : parseDeg(fig.style.getPropertyValue("--rot"))
      };
    }

    function startLoose(g) {
      var fig = g.fig;
      rememberHome(fig);
      fig._x = g.startX;
      fig._y = g.startY;
      fig._rot = g.rot;
      fig.classList.add("is-loose", "is-dragging");
      fig.classList.remove("is-buried", "is-settling", "is-placed", "is-by-profile");
      if (spread) {
        if (!fig._hoisted) {
          fig._rot += parentAngle(root) * 180 / Math.PI;
          hoistLoose(fig, spread);
        }
        g.startX = fig._x;
        g.startY = fig._y;
        clampLoose(fig);
      } else {
        applyLooseTransform(fig);
      }
      if (desk) {
        desk.raise(fig);
        fig.style.zIndex = "var(--desk-z, 20)";
      } else {
        bringToFront(fig);
      }
      applySlots(figures);
      ensureVisibleSources(figures);
      try { fig.setPointerCapture(g.id); } catch (err) {}
    }

    function onMove(e) {
      var g = drag;
      if (!g || e.pointerId !== g.id || (desk && !desk.dragSelected())) return;
      var dx = e.clientX - g.x0;
      var dy = e.clientY - g.y0;
      if (!g.axis) {
        if (Math.abs(dx) < LOCK_PX && Math.abs(dy) < LOCK_PX) return;
        /* Any direction past the 10px slop is a grab, including vertical
           and diagonal on phones. Taps below the slop still cycle. */
        g.axis = "drag";
        g.moved = true;
        root._ignoreClick = true;
        clearTimeout(root._ignoreClickTimer);
        root._ignoreClickTimer = setTimeout(function () {
          root._ignoreClick = false;
        }, 350);
        startLoose(g);
      }
      if (g.axis !== "drag") return;
      e.stopPropagation();
      if (e.cancelable) e.preventDefault();
      var now = performance.now();
      g.samples.push({ x: e.clientX, y: e.clientY, t: now });
      while (g.samples.length && now - g.samples[0].t > 80) g.samples.shift();
      g.lastX = e.clientX;
      g.lastT = now;
      if (g.fig._hoisted) {
        g.fig._x = g.startX + dx;
        g.fig._y = g.startY + dy;
        clampLoose(g.fig);
      } else {
        var theta = parentAngle(root);
        var local = toLocal(dx, dy, theta);
        g.fig._x = g.startX + local.x;
        g.fig._y = g.startY + local.y;
        applyLooseTransform(g.fig);
      }
      if (g.fig._deskHome) {
        var slot = g.fig._deskHome.slot;
        slot.show(slot.near(g.fig.getBoundingClientRect()));
      }
    }

    function velocity(g) {
      var s = g.samples;
      if (!s || s.length < 2) return { x: 0, y: 0 };
      var a = s[0], b = s[s.length - 1];
      var dt = Math.max(16, b.t - a.t);
      if (g.fig && g.fig._hoisted) {
        return { x: (b.x - a.x) / dt, y: (b.y - a.y) / dt };
      }
      var theta = parentAngle(root);
      var local = toLocal(b.x - a.x, b.y - a.y, theta);
      return { x: local.x / dt, y: local.y / dt };
    }

    function settle(fig, vx, vy) {
      /* Stop nearly where it was dropped: a very short ease-out, capped
         at 10px and 140ms. No ice-glide from leftover velocity. */
      var speed = Math.hypot(vx, vy);
      if (reduced() || speed < 0.05) {
        fig.classList.remove("is-dragging", "is-settling");
        if (fig._hoisted) clampLoose(fig);
        return;
      }
      var travel = Math.min(10, speed * 80);
      var dx = (vx / speed) * travel;
      var dy = (vy / speed) * travel;
      var x0 = fig._x;
      var y0 = fig._y;
      var t0 = performance.now();
      var duration = 140;
      fig.classList.add("is-settling");
      fig.classList.remove("is-dragging");
      function step(now) {
        var t = Math.min(1, (now - t0) / duration);
        var k = 1 - Math.pow(1 - t, 3);
        fig._x = x0 + dx * k;
        fig._y = y0 + dy * k;
        if (fig._hoisted) clampLoose(fig);
        else applyLooseTransform(fig);
        if (t < 1) fig._settleFrame = requestAnimationFrame(step);
        else {
          fig._settleFrame = 0;
          fig.classList.remove("is-settling");
          if (fig._hoisted) clampLoose(fig);
        }
      }
      fig._settleFrame = requestAnimationFrame(step);
    }

    function onUp(e) {
      var g = drag;
      if (!g || e.pointerId !== g.id) return;
      if (g.axis === "drag") {
        e.stopPropagation();
        if (!snapHome(g.fig)) {
          if (g.fig._deskHome) g.fig._deskHome.slot.show();
          var v = velocity(g);
          settle(g.fig, v.x, v.y);
        }
        announce(root, figures);
      }
      drag = null;
    }

    function onCancel(e) {
      var g = drag;
      if (!g || e.pointerId !== g.id) return;
      if (g.axis === "drag") {
        g.fig.classList.remove("is-dragging", "is-settling");
        if (g.fig._hoisted) clampLoose(g.fig);
        if (g.fig._deskHome) g.fig._deskHome.slot.show();
      }
      drag = null;
    }

    function onContext(e) {
      if (e.target.closest && e.target.closest(".polaroid")) e.preventDefault();
    }

    function swallowClick(e) {
      if (drag && drag.moved) {
        e.preventDefault();
        e.stopPropagation();
        return true;
      }
      if (root._ignoreClick) {
        root._ignoreClick = false;
        e.preventDefault();
        e.stopPropagation();
        return true;
      }
      return false;
    }

    root.addEventListener("pointerdown", onDown);
    if (spread) spread.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    root.addEventListener("contextmenu", onContext);
    if (spread) spread.addEventListener("contextmenu", onContext);

    root.addEventListener("click", function (e) {
      if (swallowClick(e)) return;
      cycle(root, figures, 1);
    });
    if (spread) {
      spread.addEventListener("click", function (e) {
        swallowClick(e);
      });
    }
  }

  function bind(root, figures) {
    root.tabIndex = 0;
    root.setAttribute("role", "group");
    announce(root, figures);

    var intro = root.closest(".home-intro") || document.querySelector(".home-intro");
    var spread = intro ? ensureSpread(intro) : null;
    if (spread) {
      var wide = window.matchMedia(DESKTOP_SPREAD);
      if (wide.matches) placeDefaultPhotos(root, figures, spread, true);
      wide.addEventListener("change", function (event) {
        placeDefaultPhotos(root, figures, spread, event.matches);
      });
    }
    bindDrag(root, figures, spread);

    root.addEventListener("keydown", function (event) {
      var key = event.key;
      if (key === "Enter" || key === " " || key === "Spacebar") {
        event.preventDefault();
        cycle(root, figures, 1);
      } else if (key === "ArrowRight" || key === "ArrowDown") {
        event.preventDefault();
        cycle(root, figures, 1);
      } else if (key === "ArrowLeft" || key === "ArrowUp") {
        event.preventDefault();
        cycle(root, figures, -1);
      }
    });

    /* Visible immediately; no entrance delay. */
    root.classList.add("is-ready");
  }

  function readEmbedded() {
    var el = document.getElementById("polaroid-data");
    if (!el) return null;
    try {
      var data = JSON.parse(el.textContent);
      return (data && data.photos) || null;
    } catch (err) {
      return null;
    }
  }

  function loadPhotos() {
    var embedded = readEmbedded();
    if (embedded && embedded.length) return Promise.resolve(embedded);
    return fetch(DATA_URL)
      .then(function (res) {
        if (!res.ok) throw new Error("polaroids.json " + res.status);
        return res.json();
      })
      .then(function (data) { return (data && data.photos) || []; })
      .catch(function () { return []; });
  }

  function init() {
    var root = document.querySelector("[data-polaroids]");
    if (!root) return;
    loadPhotos().then(function (photos) {
      var figures;
      if (photos.length) {
        figures = render(root, photos);
      } else {
        figures = Array.prototype.slice.call(root.querySelectorAll(".polaroid"));
        applySlots(figures);
      }
      if (!figures.length) return;
      bind(root, figures);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
