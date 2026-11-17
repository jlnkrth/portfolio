/* Notepad guestbook: flip through the pad, draw on the blank sheet, save for future visitors.
   Page 1 is the static intro article (always in the DOM, readable without JS).
   API: GET/POST /api/notepad/pages (see notepad-guestbook/worker/notepad.js). */
(function () {
  "use strict";

  var API = "/api/notepad/pages";
  var ASPECT = 0.96;          // drawing area height / width (stored with every page)
  var U = 10000;              // normalised units across the area width
  var INKS = {
    navy:   { color: "#23305e", w: 6, label: "Navy ink" },
    pencil: { color: "#6b6f7a", w: 5, label: "Pencil" },
    pink:   { color: "#d6409f", w: 7, label: "Pink" },
  };
  var SVGNS = "http://www.w3.org/2000/svg";
  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------- ink rendering (shared with /notepad-admin) ---------------- */

  // Variable-width outline from [[x, y, pressure 0..100], ...] in normalised units.
  function strokePath(points, w) {
    var base = w * 10; // w is per-mille of the width -> units
    if (!points.length) return "";
    var pts = points.map(function (p) { return { x: p[0], y: p[1], r: (base / 2) * (0.45 + 0.85 * (p[2] / 100)) }; });
    if (pts.length > 1) {
      // a tiny scribble (a dot, an i-dot made with a little loop) reads as a dot
      var x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, sx = 0, sy = 0, mr = 0;
      pts.forEach(function (q) { x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); sx += q.x; sy += q.y; mr = Math.max(mr, q.r); });
      if (Math.max(x1 - x0, y1 - y0) < base * 1.6) pts = [{ x: sx / pts.length, y: sy / pts.length, r: Math.max(mr, (Math.max(x1 - x0, y1 - y0) / 2) + mr * 0.5) }];
    }
    if (pts.length === 1) {
      var q = pts[0], r = Math.max(q.r, base * 0.7);
      return "M" + (q.x - r) + "," + q.y + "a" + r + "," + r + " 0 1,0 " + 2 * r + ",0a" + r + "," + r + " 0 1,0 " + -2 * r + ",0Z";
    }
    // light streamline so jittery input still reads as a pen line
    for (var s = 1; s < pts.length; s++) {
      pts[s].x = pts[s - 1].x + (pts[s].x - pts[s - 1].x) * 0.75;
      pts[s].y = pts[s - 1].y + (pts[s].y - pts[s - 1].y) * 0.75;
    }
    // taper the first and last few points like a nib touching down / lifting
    var n = pts.length, taper = Math.min(4, Math.floor(n / 3));
    for (var t = 0; t < taper; t++) {
      var f = 0.55 + 0.45 * (t / taper);
      pts[t].r *= f; pts[n - 1 - t].r *= f;
    }
    var L = [], R = [];
    for (var i = 0; i < n; i++) {
      var a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      var dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
      var nx = -dy / len, ny = dx / len;
      L.push([pts[i].x + nx * pts[i].r, pts[i].y + ny * pts[i].r]);
      R.push([pts[i].x - nx * pts[i].r, pts[i].y - ny * pts[i].r]);
    }
    function smooth(arr, d) {
      for (var k = 1; k < arr.length - 1; k++) {
        var mx = (arr[k][0] + arr[k + 1][0]) / 2, my = (arr[k][1] + arr[k + 1][1]) / 2;
        d.push("Q" + r1(arr[k][0]) + "," + r1(arr[k][1]) + " " + r1(mx) + "," + r1(my));
      }
      d.push("L" + r1(arr[arr.length - 1][0]) + "," + r1(arr[arr.length - 1][1]));
    }
    var d = ["M" + r1(L[0][0]) + "," + r1(L[0][1])];
    smooth(L, d);
    var end = pts[n - 1], rr = r1(end.r);
    d.push("A" + rr + "," + rr + " 0 0,1 " + r1(R[n - 1][0]) + "," + r1(R[n - 1][1]));
    var Rr = R.slice().reverse();
    smooth(Rr, d);
    var st = pts[0], rs = r1(st.r);
    d.push("A" + rs + "," + rs + " 0 0,1 " + r1(L[0][0]) + "," + r1(L[0][1]) + "Z");
    return d.join("");
  }
  function r1(v) { return Math.round(v * 10) / 10; }

  function makeSvg(aspect) {
    var svg = document.createElementNS(SVGNS, "svg");
    svg.setAttribute("viewBox", "0 0 " + U + " " + Math.round(U * aspect));
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svg.setAttribute("class", "pad-ink");
    return svg;
  }
  function addStroke(svg, s) {
    var path = document.createElementNS(SVGNS, "path");
    path.setAttribute("d", strokePath(s.p, s.w));
    path.setAttribute("fill", (INKS[s.c] || INKS.navy).color);
    if (s.c === "pencil") path.setAttribute("fill-opacity", "0.82");
    svg.appendChild(path);
    return path;
  }
  function renderInk(data) {
    var svg = makeSvg(data.aspect || ASPECT);
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "A visitor's drawing");
    (data.strokes || []).forEach(function (s) { addStroke(svg, s); });
    return svg;
  }
  window.NotepadInk = { renderInk: renderInk, strokePath: strokePath, INKS: INKS, ASPECT: ASPECT };

  /* ---------------- the pad ---------------- */
  var pad = document.querySelector("[data-pad]");
  var toolbar = document.querySelector("[data-desk-toolbar]");
  if (!pad || !toolbar || document.documentElement.hasAttribute("data-notepad-admin")) return;
  var inkTools = toolbar.querySelector("[data-ink-tools]");
  var dragButton = toolbar.querySelector('[data-tool="drag"]');
  var penButton = toolbar.querySelector('[data-tool="pen"]');
  var intro = pad.querySelector(".pad__sheet");
  var crestSrc = (intro.querySelector(".letterhead__crest") || {}).getAttribute
    ? intro.querySelector(".letterhead__crest").getAttribute("src") : "assets/letterhead-fox.svg";

  var state = {
    index: 0,          // 0 = intro, 1..N = saved pages (oldest first), N+1 = blank
    total: 0,          // saved pages on the server
    saved: [],         // sparse, by position (asc)
    headCursor: null, headDone: false, tailCursor: null, tailLoaded: false,
    draft: { strokes: [], undo: [] },
    ink: "navy",
    composing: false,
    busy: false,
  };

  inkTools.innerHTML =
    Object.keys(INKS).map(function (k) {
      return '<button type="button" class="desk-toolbar__ink" data-ink="' + k + '" aria-label="' + INKS[k].label + '" style="--swatch:' + INKS[k].color + '"></button>';
    }).join("") +
    '<button type="button" class="desk-toolbar__button" data-act="undo" aria-label="Undo" title="Undo"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 7 4 12l5 5m-5-5h11a5 5 0 0 1 5 5"/></svg></button>' +
    '<button type="button" class="desk-toolbar__button" data-act="clear" aria-label="Clear drawing" title="Clear drawing"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16m-10 0V4h4v3m4 0-1 13H7L6 7m4 4v5m4-5v5"/></svg></button>' +
    '<button type="button" class="desk-toolbar__button desk-toolbar__button--save" data-act="save">Leave it</button>' +
    '<span class="desk-toolbar__status" role="status"></span>';
  var status = toolbar.querySelector(".desk-toolbar__status");

  dragButton.addEventListener("click", function () {
    if (!state.composing || flipping || gesture) return;
    pageRequest++;
    show(0);
  });
  penButton.addEventListener("click", function () {
    if (flipping || gesture) return;
    pageRequest++;
    if (!state.composing) show(lastIndex());
    var stage = pad.closest(".pad-stage");
    if (stage && window.DeskDrag) window.DeskDrag.raise(stage);
    pad.scrollIntoView({ block: "nearest", inline: "nearest" });
  });

  // leaf = the visible non-intro page; nav = counter + arrows
  var leaf = el("div", "pad__leaf");
  leaf.hidden = true;
  leaf.setAttribute("tabindex", "-1");
  pad.appendChild(leaf);

  var nav = el("nav", "pad__nav");
  nav.setAttribute("aria-label", "Notepad pages");
  nav.innerHTML =
    '<span class="pad__pager">' +
    '<button type="button" class="pad__arrow" data-go="prev" aria-label="Previous page">&lsaquo;</button>' +
    '<span class="pad__count" aria-live="polite"><span data-cur>1</span> / <span data-tot>1</span></span>' +
    '<button type="button" class="pad__arrow" data-go="next" aria-label="Next page">&rsaquo;</button>' +
    "</span>";
  pad.appendChild(nav);
  pad.classList.add("pad--paged");

  nav.addEventListener("click", function (e) {
    var b = e.target.closest("[data-go]");
    if (!b) return;
    var go = b.getAttribute("data-go");
    if (go === "prev") goTo(state.index - 1);
    if (go === "next") goTo(state.index + 1);
  });

  pad.addEventListener("keydown", function (e) {
    if (e.target.closest("input, textarea")) return;
    if (e.key === "ArrowRight") { e.preventDefault(); goTo(state.index + 1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); goTo(state.index - 1); }
  });

  /* Interactive swipe is wired after goTo() so it can build flip layers. */

  function lastIndex() { return state.total + 1; }
  function el(tag, cls, html) { var n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; }

  function updateCounter() {
    if (state.composing) state.index = lastIndex();
    nav.querySelector("[data-cur]").textContent = String(state.index + 1);
    nav.querySelector("[data-tot]").textContent = String(lastIndex() + 1);
    nav.querySelector('[data-go="prev"]').disabled = state.index === 0;
    nav.querySelector('[data-go="next"]').disabled = state.index >= lastIndex();
    pad.setAttribute("data-page", state.composing ? "blank" : state.index === 0 ? "intro" : "saved");
    document.documentElement.dataset.deskTool = state.composing ? "pen" : "drag";
    penButton.setAttribute("aria-pressed", String(state.composing));
    dragButton.setAttribute("aria-pressed", String(!state.composing));
    inkTools.hidden = !state.composing;
    syncTools();
  }

  /* ----- data ----- */
  function fetchJSON(url, opts) {
    return fetch(url, opts).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { j.__status = r.status; j.__retry = r.headers.get("Retry-After"); return j; });
    });
  }
  function loadHead() {
    if (state.headDone) return Promise.resolve();
    var q = "?order=asc&limit=10" + (state.headCursor ? "&cursor=" + state.headCursor : "");
    return fetchJSON(API + q).then(function (j) {
      if (!j.pages) return;
      state.total = j.total;
      var start = state.saved.filter(Boolean).length && state.headCursor ? indexOfId(state.headCursor) + 1 : 0;
      j.pages.forEach(function (p, i) { state.saved[start + i] = p; });
      if (j.pages.length) state.headCursor = j.pages[j.pages.length - 1].id;
      if (!j.next_cursor) state.headDone = true;
    });
  }
  function loadTail() {
    var q = "?order=desc&limit=10" + (state.tailCursor ? "&cursor=" + state.tailCursor : "");
    return fetchJSON(API + q).then(function (j) {
      if (!j.pages) return;
      state.total = j.total;
      var end = state.tailCursor ? indexOfId(state.tailCursor) - 1 : state.total - 1;
      j.pages.forEach(function (p, i) { if (end - i >= 0) state.saved[end - i] = p; });
      if (j.pages.length) state.tailCursor = j.pages[j.pages.length - 1].id;
      state.tailLoaded = true;
    });
  }
  function indexOfId(id) { for (var i = 0; i < state.saved.length; i++) if (state.saved[i] && state.saved[i].id === id) return i; return -1; }
  function ensureSaved(k) {
    if (state.saved[k]) return Promise.resolve();
    // navigation only moves by one step or jumps to an end, so one side is always adjacent
    var nearHead = state.headCursor === null || indexOfId(state.headCursor) === k - 1;
    return (nearHead ? loadHead() : loadTail());
  }

  /* ----- page building ----- */
  function lightLetterhead() {
    return '<div class="leaf__head" aria-hidden="true"><img src="' + crestSrc + '" alt="" class="leaf__crest"><span class="leaf__name">Julian Kreth</span><span class="leaf__rule"></span></div>';
  }
  function fmtDate(ms) {
    try { return new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); } catch (_) { return ""; }
  }
  function buildSaved(k) {
    var p = state.saved[k];
    var page = el("div", "leaf__page leaf__page--saved");
    page.innerHTML = lightLetterhead() + '<div class="leaf__area"></div><div class="leaf__foot"><span class="leaf__meta"></span></div>';
    var area = page.querySelector(".leaf__area");
    if (p) {
      area.appendChild(renderInk(p.data));
      page.querySelector(".leaf__meta").textContent = "No. " + (k + 1) + " \u00b7 " + fmtDate(p.created_at);
    } else {
      area.classList.add("is-loading");
      page.querySelector(".leaf__meta").textContent = "No. " + (k + 1);
    }
    return page;
  }
  function buildBlank() {
    var page = el("div", "leaf__page leaf__page--blank");
    page.innerHTML =
      lightLetterhead() +
      '<div class="leaf__area leaf__area--draw" aria-label="Drawing area. Draw with a mouse, finger or pen." role="img"><span class="leaf__hint" aria-hidden="true">draw something, it stays on the pad</span></div>';
    var area = page.querySelector(".leaf__area");
    var svg = makeSvg(ASPECT);
    area.appendChild(svg);
    state.draft.strokes.forEach(function (s) { addStroke(svg, s); });
    wireDrawing(page, area, svg);
    page.classList.toggle("is-inked", state.draft.strokes.length > 0);
    return page;
  }
  function buildIntroCopy() {
    var c = intro.cloneNode(true);
    c.removeAttribute("id");
    c.querySelectorAll("[id]").forEach(function (n) { n.removeAttribute("id"); });
    c.setAttribute("aria-hidden", "true");
    c.setAttribute("inert", "");
    c.classList.add("leaf__page", "leaf__page--intro");
    return c;
  }
  function build(i) {
    if (i === 0) return buildIntroCopy();
    if (i === lastIndex()) return buildBlank();
    return buildSaved(i - 1);
  }

  /* ----- drawing ----- */
  function wireDrawing(page, area, svg) {
    var cur = null, last = 0;
    function toUnits(e) {
      var point = svg.createSVGPoint();
      point.x = e.clientX;
      point.y = e.clientY;
      var local = point.matrixTransform(svg.getScreenCTM().inverse());
      return [Math.round(Math.max(0, Math.min(U, local.x))), Math.round(Math.max(0, Math.min(U * ASPECT, local.y)))];
    }
    function pressure(e, xy) {
      if (e.pointerType === "pen" && e.pressure > 0) return Math.round(e.pressure * 100);
      // mouse/touch: slow = heavier, fast = lighter
      if (!cur || !cur.p.length) return 55;
      var p = cur.p[cur.p.length - 1], now = performance.now(), dt = Math.max(1, now - last);
      var v = Math.hypot(xy[0] - p[0], xy[1] - p[1]) / dt; // units per ms
      var target = Math.max(25, Math.min(80, 75 - v * 6));
      return Math.round(p[2] + (target - p[2]) * 0.3);
    }
    area.addEventListener("pointerdown", function (e) {
      if (e.button > 0 || e.isPrimary === false || state.busy) return;
      e.preventDefault();
      area.setPointerCapture(e.pointerId);
      var xy = toUnits(e);
      cur = { c: state.ink, w: INKS[state.ink].w, p: [[xy[0], xy[1], pressure(e, xy)]] };
      last = performance.now();
      cur.el = addStroke(svg, cur);
      page.classList.add("is-inked");
    });
    area.addEventListener("pointermove", function (e) {
      if (!cur) return;
      var evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      for (var i = 0; i < evs.length; i++) {
        var xy = toUnits(evs[i]), lp = cur.p[cur.p.length - 1];
        if (Math.hypot(xy[0] - lp[0], xy[1] - lp[1]) < 18) continue; // ~0.2% of the width
        if (cur.p.length >= 1400) break;
        cur.p.push([xy[0], xy[1], pressure(evs[i], xy)]);
        last = performance.now();
      }
      cur.el.setAttribute("d", strokePath(cur.p, cur.w));
    });
    function end() {
      if (!cur) return;
      var s = { c: cur.c, w: cur.w, p: cur.p };
      state.draft.strokes.push(s);
      state.draft.undo.push({ type: "add" });
      cur = null;
      syncTools();
    }
    area.addEventListener("pointerup", end);
    area.addEventListener("pointercancel", end);

  }

  inkTools.addEventListener("click", function (e) {
    if (!state.composing || state.busy) return;
    var ink = e.target.closest("[data-ink]");
    if (ink) { state.ink = ink.getAttribute("data-ink"); syncTools(); return; }
    var button = e.target.closest("[data-act]");
    if (!button) return;
    var action = button.dataset.act;
    var svg = leaf.querySelector(".leaf__area--draw svg");
    if (!svg) return;
    if (action === "undo") {
      var change = state.draft.undo.pop();
      if (!change) return;
      if (change.type === "add") state.draft.strokes.pop();
      else state.draft.strokes = change.strokes;
      redraw(svg);
    }
    if (action === "clear" && state.draft.strokes.length) {
      state.draft.undo.push({ type: "clear", strokes: state.draft.strokes });
      state.draft.strokes = [];
      redraw(svg);
    }
    if (action === "save") save();
    syncTools();
  });
  function redraw(svg) {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    state.draft.strokes.forEach(function (s) { addStroke(svg, s); });
  }
  function inkLength() {
    var L = 0;
    state.draft.strokes.forEach(function (s) { for (var i = 1; i < s.p.length; i++) L += Math.hypot(s.p[i][0] - s.p[i - 1][0], s.p[i][1] - s.p[i - 1][1]); });
    return L / U;
  }
  function syncTools() {
    inkTools.querySelectorAll("[data-ink]").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.ink === state.ink));
      b.disabled = state.busy;
    });
    inkTools.querySelector('[data-act="undo"]').disabled = state.busy || !state.draft.undo.length;
    inkTools.querySelector('[data-act="clear"]').disabled = state.busy || !state.draft.strokes.length;
    inkTools.querySelector('[data-act="save"]').disabled = state.busy || inkLength() < 0.06;
    var page = leaf.querySelector(".leaf__page--blank");
    if (page) page.classList.toggle("is-inked", state.draft.strokes.length > 0);
  }
  function setStatus(msg) { status.textContent = msg || ""; }

  function save() {
    if (state.busy) return;
    state.busy = true; syncTools(); setStatus("Saving\u2026");
    var body = { v: 1, aspect: ASPECT, strokes: state.draft.strokes.map(function (s) { return { c: s.c, w: s.w, p: s.p }; }) };
    fetchJSON(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then(function (j) {
        state.busy = false;
        if (j.__status === 201 && j.page) {
          state.saved[state.total] = j.page;
          state.total += 1;
          state.draft = { strokes: [], undo: [] };
          setStatus("");
          if (state.composing) show(state.total, { toast: "Thanks. It\u2019s on the pad now." });
          else updateCounter();
          return;
        }
        if (j.__status === 429) {
          var mins = j.retry_after ? Math.ceil(j.retry_after / 60) : null;
          setStatus(mins ? "The pad needs a breather. Try again in " + mins + " min." : "The pad needs a breather. Try again later.");
        } else {
          setStatus(j.error === "page is empty" ? "Draw a little more first." : "Couldn\u2019t save that. Try again.");
        }
        syncTools();
      })
      .catch(function () { state.busy = false; setStatus("Offline? Couldn\u2019t save."); syncTools(); });
  }

  /* ----- flipping ----- */
  var flipping = false;
  var pageRequest = 0;
  function show(i, extra) {
    if (i === 0) {
      leaf.hidden = true;
      leaf.innerHTML = "";
      intro.removeAttribute("inert");
      intro.removeAttribute("aria-hidden");
    } else {
      leaf.innerHTML = "";
      var page = build(i);
      if (extra && extra.toast) {
        var t = el("p", "leaf__toast", extra.toast);
        page.appendChild(t);
      }
      leaf.appendChild(page);
      leaf.hidden = false;
      intro.setAttribute("inert", "");
      intro.setAttribute("aria-hidden", "true");
    }
    state.index = i;
    state.composing = i === lastIndex();
    updateCounter();
  }

  function goTo(i, extra, corner) {
    if (flipping || gesture) return;
    i = Math.max(0, Math.min(lastIndex(), i));
    if (i === state.index) return;
    var request = ++pageRequest;
    var need = i > 0 && i < lastIndex() ? ensureSaved(i - 1) : Promise.resolve();
    need.then(function () {
      if (request !== pageRequest || flipping || gesture) return;
      var forward = i > state.index;
      var from = state.index;
      if (reduced) {
        show(i, extra);
        leaf.animate && leaf.animate([{ opacity: 0.2 }, { opacity: 1 }], { duration: 160, easing: "ease-out" });
        return;
      }
      if (startPeelLayers(forward, from, i, false, corner || (forward ? "right" : "left"))) {
        animatePeel(forward ? 0 : 1, forward ? 1 : 0, forward ? 680 : 600, 0, function () {
          hidePeel();
          show(i, extra);
          flipping = false;
        });
        return;
      }
      goToFlipper(i, extra, forward, from);
    });
  }

  function goToFlipper(i, extra, forward, from) {
    flipping = true;
    var flap = el("div", "pad__flipper" + (forward ? "" : " pad__flipper--down"));
    flap.setAttribute("aria-hidden", "true");
    if (forward) {
      flap.appendChild(from === 0 ? buildIntroCopy() : leafSnapshot());
      show(i, extra);
    } else {
      flap.appendChild(build(i));
    }
    pad.appendChild(flap);
    flap.addEventListener("animationend", function () {
      if (!forward) show(i, extra);
      flap.remove();
      flipping = false;
    }, { once: true });
  }

  function leafSnapshot() {
    var src = leaf.firstElementChild;
    var c = src ? src.cloneNode(true) : el("div", "leaf__page");
    c.setAttribute("inert", "");
    if (src) {
      var from = src.querySelectorAll("canvas");
      var to = c.querySelectorAll("canvas");
      for (var i = 0; i < to.length; i++) {
        try {
          if (!from[i]) continue;
          to[i].width = from[i].width;
          to[i].height = from[i].height;
          var ctx = to[i].getContext("2d");
          if (ctx) ctx.drawImage(from[i], 0, 0);
        } catch (err) {}
      }
    }
    return c;
  }

  /* ----- interactive curl: peel-js fold follows the finger ----- */
  var gesture = null;
  var peelInst = null;
  var peelEl = null;
  var LOCK_PX = 10;
  var COMMIT_P = 0.35;
  var FLICK = 0.55; /* px/ms */

  function padIsDragging() {
    var stage = pad.closest(".pad-stage");
    return !!(stage && stage.classList.contains("is-dragging"));
  }

  function swipeIgnore(el) {
    return !!(el && el.closest && el.closest(".leaf__area--draw, .pad__nav, .pad__handle, a, button"));
  }

  function rubber(raw) {
    if (raw <= 0) return 0;
    return 0.28 * (1 - Math.exp(-raw / 0.4));
  }

  function ensurePeel() {
    if (peelInst) return peelInst;
    if (typeof Peel === "undefined" || !Peel.supported) return null;
    peelEl = el("div", "pad__peel peel");
    peelEl.setAttribute("aria-hidden", "true");
    var top = el("div", "peel-top");
    var back = el("div", "peel-back");
    var bottom = el("div", "peel-bottom");
    top.appendChild(el("div", "pad__peel-front"));
    bottom.appendChild(el("div", "pad__peel-under"));
    peelEl.appendChild(top);
    peelEl.appendChild(back);
    peelEl.appendChild(bottom);
    pad.appendChild(peelEl);
    peelInst = new Peel(peelEl, {
      setPeelOnInit: true,
      corner: Peel.Corners.BOTTOM_RIGHT,
      topShadow: true,
      topShadowAlpha: 0.1,
      topShadowBlur: 22,
      topShadowOffsetX: 0,
      topShadowOffsetY: 2,
      backShadow: true,
      backShadowAlpha: 0.08,
      backReflection: true,
      backReflectionAlpha: 0.1,
      bottomShadow: true,
      bottomShadowDarkAlpha: 0.12,
      bottomShadowLightAlpha: 0.05,
      bottomShadowSize: 4
    });
    peelInst.setMode("calendar");
    installSoftShadows(peelInst);
    return peelInst;
  }

  var peelCorner = "right";
  var peelAmount = 0;

  function shadowWeight(p) {
    /* Shadows ease in with the peel and ease off as the sheet leaves, so
       a small corner tug stays almost shadowless and a mid peel stays soft. */
    if (p <= 0) return 0;
    if (p < 0.18) return (p / 0.18) * 0.65;
    if (p < 0.78) return 0.65 + ((p - 0.18) / 0.6) * 0.35;
    return Math.max(0, 1 - ((p - 0.78) / 0.22) * 0.5);
  }

  function warmStop(a, pos) {
    a = Math.max(0, Math.min(0.4, a));
    var pct = Math.round(Math.max(-20, Math.min(120, pos * 100)) * 10) / 10;
    return "rgba(50, 45, 35, " + (Math.round(a * 1000) / 1000) + ") " + pct + "%";
  }

  function paperLite(a, pos) {
    a = Math.max(0, Math.min(0.5, a));
    var pct = Math.round(Math.max(-20, Math.min(120, pos * 100)) * 10) / 10;
    return "rgba(255, 252, 246, " + (Math.round(a * 1000) / 1000) + ") " + pct + "%";
  }

  function installSoftShadows(peel) {
    /* Replace peel-js's hard fold band with wide, low-opacity warm gradients
       in the same family as the Polaroid contact/ambient shadows. */
    peel.setBottomShadow = function () {
      var t = this.getPeelLineDistance();
      var w = shadowWeight(peelAmount);
      var el = this.bottomShadowElement;
      if (!el) return;
      if (!(t > 0) || w <= 0.01) {
        el.style.backgroundImage = "none";
        return;
      }
      var rot = (this.peelLineRotation || 0) + 180;
      var far = t - 0.46;
      var mid = t - 0.2;
      var near = t - 0.06;
      el.style.backgroundImage =
        "linear-gradient(" + rot + "deg," +
        warmStop(0, 0) + "," +
        warmStop(0, far) + "," +
        warmStop(0.035 * w, mid) + "," +
        warmStop(0.07 * w, near) + "," +
        warmStop(0.11 * w, t) + "," +
        warmStop(0.04 * w, t + 0.03) + "," +
        warmStop(0, t + 0.08) + ")";
    };
    peel.setBackShadow = function () {
      var t = this.getPeelLineDistance();
      var w = shadowWeight(peelAmount);
      var el = this.backShadowElement;
      if (!el) return;
      if (!(t > 0) || w <= 0.01) {
        el.style.backgroundImage = "none";
        return;
      }
      var rot = 180 - (this.peelLineRotation || 0);
      el.style.backgroundImage =
        "linear-gradient(" + rot + "deg," +
        warmStop(0, 0) + "," +
        warmStop(0, t - 0.22) + "," +
        warmStop(0.055 * w, t - 0.08) + "," +
        warmStop(0.08 * w, t - 0.02) + "," +
        warmStop(0.03 * w, t + 0.02) + "," +
        warmStop(0, t + 0.1) + ")";
    };
    peel.setBackReflection = function () {
      var t = this.getPeelLineDistance();
      var w = shadowWeight(peelAmount);
      var el = this.backReflectionElement;
      if (!el) return;
      if (!(t > 0) || w <= 0.01) {
        el.style.backgroundImage = "none";
        return;
      }
      var rot = 180 - (this.peelLineRotation || 0);
      el.style.backgroundImage =
        "linear-gradient(" + rot + "deg," +
        paperLite(0, 0) + "," +
        paperLite(0, t - 0.08) + "," +
        paperLite(0.16 * w, t - 0.02) + "," +
        paperLite(0.08 * w, t + 0.01) + "," +
        paperLite(0, t + 0.07) + ")";
    };
    peel.setTopShadow = function () {
      var el = this.topShadowElement;
      if (!el) return;
      var w = shadowWeight(peelAmount);
      var a = 0.09 * w;
      el.style.boxShadow = "0 2px 22px 0 rgba(50, 45, 35, " + (Math.round(a * 1000) / 1000) + ")";
    };
  }

  function resetPeelGeometry(peel, corner) {
    peel.constraints = [];
    peel.setupDimensions();
    peel.setCorner(corner === "left" ? Peel.Corners.BOTTOM_LEFT : Peel.Corners.BOTTOM_RIGHT);
    peel.setMode("calendar");
  }

  function peelFront() { return peelEl && peelEl.querySelector(".pad__peel-front"); }
  function peelUnder() { return peelEl && peelEl.querySelector(".pad__peel-under"); }

  function hidePeel() {
    pad.classList.remove("is-peeling");
    var f = peelFront();
    var u = peelUnder();
    if (f) f.innerHTML = "";
    if (u) u.innerHTML = "";
    peelAmount = 0;
    if (peelInst) {
      peelInst.topLayer.style.opacity = "1";
      peelInst.backLayer.style.opacity = "1";
    }
  }

  /* Map progress 0 (flat) .. 1 (fully curled over the top binding) along a
     bezier so the grabbed bottom corner lifts toward the glue. Left is a
     mirror of the right-corner path. */
  function applyPeelProgress(t, dy) {
    var peel = peelInst;
    if (!peel) return;
    t = Math.max(0, Math.min(1, t));
    peelAmount = t;
    var w = peel.width || 1, h = peel.height || 1;
    var left = peelCorner === "left";
    var p0x = left ? 0 : w, p0y = h;
    var c1x = left ? w * 0.42 : w * 0.58, c1y = h * 1.04;
    var c2x = left ? w * 0.9 : w * 0.1, c2y = h * 0.2;
    var p3x = left ? w * 1.22 : -w * 0.22, p3y = h * 0.14;
    var u = 1 - t;
    var x = u*u*u*p0x + 3*u*u*t*c1x + 3*u*t*t*c2x + t*t*t*p3x;
    var y = u*u*u*p0y + 3*u*u*t*c1y + 3*u*t*t*c2y + t*t*t*p3y;
    if (dy) y += dy * (1 - t * 0.4);
    peel.setPeelPosition(x, y);
    if (t > 0.84) {
      var fade = (1 - t) / (1 - 0.84);
      peel.topLayer.style.opacity = String(fade);
      peel.backLayer.style.opacity = String(fade);
    } else {
      peel.topLayer.style.opacity = "1";
      peel.backLayer.style.opacity = "1";
    }
  }

  function startPeelLayers(forward, from, to, atEnd, corner) {
    var peel = ensurePeel();
    if (!peel) return null;
    peelCorner = corner === "left" ? "left" : "right";
    resetPeelGeometry(peel, peelCorner);
    pad.classList.add("is-peeling");
    var front = peelFront();
    var under = peelUnder();
    if (front) front.innerHTML = "";
    if (under) under.innerHTML = "";
    if (forward || atEnd) {
      if (front) front.appendChild(from === 0 ? buildIntroCopy() : leafSnapshot());
      if (!atEnd && under) under.appendChild(build(to));
    } else {
      if (front) front.appendChild(to === 0 ? buildIntroCopy() : build(to));
    }
    applyPeelProgress(forward || atEnd ? 0 : 1, 0);
    flipping = true;
    return peel;
  }

  function animatePeel(fromT, toT, dur, startDy, done) {
    var start = performance.now();
    function tick(now) {
      var k = Math.min(1, (now - start) / dur);
      var e = 1 - Math.pow(1 - k, 3);
      applyPeelProgress(fromT + (toT - fromT) * e, startDy * (1 - e));
      if (k < 1) {
        requestAnimationFrame(tick);
        return;
      }
      if (done) done();
    }
    requestAnimationFrame(tick);
  }

  function cleanupLayers() {
    hidePeel();
    var flap = pad.querySelector(".pad__flipper");
    var under = pad.querySelector(".pad__under");
    if (flap) flap.remove();
    if (under) under.remove();
  }

  function finishGesture(commit) {
    var g = gesture;
    if (!g) return;
    gesture = null;
    var p = g.progress || 0;
    var lift = g.liftForward != null ? g.liftForward : true;
    var fromT = lift ? p : (1 - p);
    var toT = commit ? (lift ? 1 : 0) : (lift ? 0 : 1);
    if (!peelInst || !pad.classList.contains("is-peeling")) {
      flipping = false;
      if (commit) show(g.to);
      return;
    }
    flipping = true;
    if (reduced) {
      hidePeel();
      if (commit) {
        show(g.to);
        if (leaf.animate) leaf.animate([{ opacity: 0.2 }, { opacity: 1 }], { duration: 160, easing: "ease-out" });
      }
      flipping = false;
      return;
    }
    var remaining = Math.abs(toT - fromT);
    var speed = Math.abs(g.velocity || 0);
    var dur = Math.max(180, Math.min(560, (remaining * 560) / (0.55 + speed * 1.2)));
    animatePeel(fromT, toT, dur, g.dy || 0, function () {
      hidePeel();
      if (commit) show(g.to);
      flipping = false;
    });
  }

  function abortGesture() {
    if (!gesture) return;
    cleanupLayers();
    gesture = null;
    flipping = false;
  }

  function pickCorner(fracX, dx) {
    if (fracX < 0.4) return "left";
    if (fracX > 0.6) return "right";
    return dx < 0 ? "right" : "left";
  }

  pad.addEventListener("pointerdown", function (e) {
    if (flipping || gesture) return;
    if (!state.composing && e.pointerType !== "touch") return;
    if (e.isPrimary === false) return;
    if (e.button != null && e.button !== 0) return;
    if (swipeIgnore(e.target)) return;
    if (padIsDragging()) return;
    var rect = pad.getBoundingClientRect();
    gesture = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      lastX: e.clientX,
      lastT: performance.now(),
      velocity: 0,
      dy: 0,
      axis: "",
      corner: null,
      startFracX: rect.width ? (e.clientX - rect.left) / rect.width : 0.5,
      startFracY: rect.height ? (e.clientY - rect.top) / rect.height : 0.5,
      from: state.index,
      to: state.index,
      progress: 0,
      atEnd: false,
      layers: false,
      loading: false,
      liftForward: null
    };
    e.stopPropagation();
  });

  pad.addEventListener("pointermove", function (e) {
    var g = gesture;
    if (!g || e.pointerId !== g.id) return;
    if (padIsDragging()) { abortGesture(); return; }
    var dx = e.clientX - g.x;
    var dy = e.clientY - g.y;
    if (!g.axis) {
      if (Math.abs(dx) < LOCK_PX && Math.abs(dy) < LOCK_PX) return;
      var inwardGuess = (g.startFracX < 0.5) ? dx > 0 : dx < 0;
      var fromBottom = g.startFracY > 0.5;
      var peelIntent = Math.abs(dx) > Math.abs(dy) ||
        (fromBottom && inwardGuess && dy < 0 && Math.abs(dx) >= 8);
      g.axis = peelIntent ? "x" : "y";
      if (g.axis === "y") return;
      g.corner = pickCorner(g.startFracX, dx);
      var inward = g.corner === "left" ? dx > 0 : dx < 0;
      g.liftForward = inward;
      g.atEnd = (g.liftForward && g.from >= lastIndex()) || (!g.liftForward && g.from <= 0);
      g.to = g.atEnd ? g.from : g.from + (g.liftForward ? 1 : -1);
    }
    if (g.axis !== "x") return;
    e.stopPropagation();

    var now = performance.now();
    g.samples = g.samples || [];
    g.samples.push({ x: e.clientX, t: now });
    while (g.samples.length && now - g.samples[0].t > 80) g.samples.shift();
    if (g.samples.length >= 2) {
      var a = g.samples[0], b = g.samples[g.samples.length - 1];
      g.velocity = (b.x - a.x) / Math.max(16, b.t - a.t);
    } else {
      g.velocity = 0;
    }
    g.lastX = e.clientX;
    g.lastT = now;
    g.dy = dy;

    var width = pad.getBoundingClientRect().width || 280;
    var inwardDx = g.corner === "left" ? dx : -dx;
    var raw = (g.liftForward ? inwardDx : -inwardDx) / width;
    if (g.atEnd) g.progress = rubber(Math.max(0, raw));
    else if (raw < 0) g.progress = 0;
    else g.progress = Math.min(1, raw);

    if (!g.layers && !g.loading) {
      g.loading = true;
      var need = (!g.atEnd && g.to > 0 && g.to < lastIndex()) ? ensureSaved(g.to - 1) : Promise.resolve();
      need.then(function () {
        if (!gesture || gesture.id !== g.id || g.axis !== "x") return;
        var peel = startPeelLayers(g.liftForward, g.from, g.to, g.atEnd, g.corner);
        g.layers = !!peel;
        if (peel) {
          var tt = g.liftForward ? g.progress : (1 - g.progress);
          applyPeelProgress(tt, g.dy);
        }
      });
      return;
    }
    if (g.layers && peelInst) {
      var pt = g.liftForward ? g.progress : (1 - g.progress);
      applyPeelProgress(pt, g.dy);
    }
  });

  function onPointerEnd(e) {
    var g = gesture;
    if (!g || e.pointerId !== g.id) return;
    if (g.axis !== "x") { abortGesture(); return; }
    e.stopPropagation();
    if (padIsDragging()) { abortGesture(); return; }
    var flickIn = g.corner === "left" ? g.velocity >= FLICK : g.velocity <= -FLICK;
    var flickOut = g.corner === "left" ? g.velocity <= -FLICK : g.velocity >= FLICK;
    var flick = g.liftForward ? flickIn : flickOut;
    var commit = !g.atEnd && (g.progress >= COMMIT_P || flick);
    if (!g.layers) {
      var to = g.to;
      var corner = g.corner;
      abortGesture();
      if (commit) goTo(to, null, corner);
      return;
    }
    finishGesture(!!commit);
  }

  window.addEventListener("pointerup", onPointerEnd);
  window.addEventListener("pointercancel", function (e) {
    if (gesture && e.pointerId === gesture.id) abortGesture();
  });

  /* ----- boot ----- */
  updateCounter();
  toolbar.hidden = false;
  Promise.all([loadHead(), loadTail()]).then(updateCounter).catch(function () {});
})();
