// Books desk canvas — scatter covers on a pannable board (Figma-like).
(function () {
  var desk = document.querySelector("[data-books-desk]");
  var viewport = document.querySelector("[data-books-canvas]");
  var surface = document.querySelector("[data-books-canvas-surface]");
  if (!desk || !viewport || !surface) return;

  var mq =
    typeof window.matchMedia === "function"
      ? window.matchMedia("(min-width: 1024px)")
      : null;
  var reduceMotion =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var x = 0;
  var y = 0;
  var scale = 1;
  var minScale = 0.45;
  var maxScale = 1.4;
  var dragging = false;
  var moved = false;
  var startClientX = 0;
  var startClientY = 0;
  var startX = 0;
  var startY = 0;
  var DRAG_THRESHOLD = 5;
  var hinted = false;

  function enabled() {
    return !mq || mq.matches;
  }

  function clamp(v, min, max) {
    if (min > max) return (min + max) / 2;
    return Math.min(Math.max(v, min), max);
  }

  // Stable 0..1 hash from an integer (no Math.random — layout stays put).
  function hash01(n) {
    var t = (n + 1) * 2654435761;
    t = (t ^ (t >>> 16)) >>> 0;
    return (t % 10000) / 10000;
  }

  function bounds() {
    var vw = viewport.clientWidth;
    var vh = viewport.clientHeight;
    var sw = surface.offsetWidth * scale;
    var sh = surface.offsetHeight * scale;
    var over = 80;

    var minX;
    var maxX;
    var minY;
    var maxY;

    if (sw <= vw) {
      minX = (vw - sw) / 2;
      maxX = (vw - sw) / 2;
    } else {
      minX = vw - sw - over;
      maxX = over;
    }

    if (sh <= vh) {
      minY = (vh - sh) / 2;
      maxY = (vh - sh) / 2;
    } else {
      minY = vh - sh - over;
      maxY = over;
    }

    return { minX: minX, maxX: maxX, minY: minY, maxY: maxY, vw: vw, vh: vh };
  }

  function applyTransform() {
    surface.style.transform =
      "translate3d(" + x + "px, " + y + "px, 0) scale(" + scale + ")";
  }

  function clampToBounds() {
    var b = bounds();
    x = clamp(x, b.minX, b.maxX);
    y = clamp(y, b.minY, b.maxY);
  }

  function setPan(nx, ny, animate) {
    x = nx;
    y = ny;
    clampToBounds();
    if (animate && !reduceMotion) {
      surface.style.transition =
        "transform 0.55s cubic-bezier(0.22, 1, 0.36, 1)";
      applyTransform();
      window.setTimeout(function () {
        surface.style.transition = "";
      }, 560);
      return;
    }
    surface.style.transition = "";
    applyTransform();
  }

  function panBy(dx, dy) {
    setPan(x + dx, y + dy, false);
  }

  function setScaleAt(nextScale, cx, cy) {
    var prev = scale;
    scale = clamp(nextScale, minScale, maxScale);
    if (scale === prev) return;
    var rect = viewport.getBoundingClientRect();
    var px = cx - rect.left;
    var py = cy - rect.top;
    x = px - ((px - x) * scale) / prev;
    y = py - ((py - y) * scale) / prev;
    clampToBounds();
    applyTransform();
  }

  function resetView() {
    scale = 1;
    frameInitial(false);
  }

  function centerPan() {
    var vw = viewport.clientWidth;
    var vh = viewport.clientHeight;
    var sw = surface.offsetWidth;
    var sh = surface.offsetHeight;
    return {
      x: (vw - sw) / 2,
      y: (vh - sh) / 2,
    };
  }

  function scatterBooks() {
    if (!enabled()) return false;
    var grid = surface.querySelector("[data-collection='books']");
    if (!grid) return false;
    var cards = grid.querySelectorAll(".collection-card");
    if (!cards.length) return false;

    desk.classList.add("is-scattered");
    grid.classList.add("collection-grid--scattered");

    var sample = cards[0];
    var cardW = sample.offsetWidth || 161;
    var cardH = sample.offsetHeight || 270;

    // Even desk: moderate gaps + light jitter. Dense enough that holes
    // don't open up, loose enough to still feel scattered.
    var gapX = 72;
    var gapY = 88;
    var cellW = cardW + gapX;
    var cellH = cardH + gapY;
    var cols = Math.max(11, Math.round(Math.sqrt(cards.length * 1.05)));
    var rows = Math.ceil(cards.length / cols);
    var edge = 40;
    var surfaceW = edge * 2 + cols * cellW;
    var surfaceH = edge * 2 + rows * cellH;

    // Keep the board larger than the viewport so the centered start clips
    // every edge, without stretching cells into uneven voids.
    var vw = viewport.clientWidth || window.innerWidth;
    var vh = viewport.clientHeight || window.innerHeight;
    if (surfaceW < vw * 1.85) {
      cols = Math.ceil((vw * 1.85 - edge * 2) / cellW);
      rows = Math.ceil(cards.length / cols);
      surfaceW = edge * 2 + cols * cellW;
      surfaceH = edge * 2 + rows * cellH;
    }
    if (surfaceH < vh * 1.85) {
      rows = Math.ceil((vh * 1.85 - edge * 2) / cellH);
      // Refill width if we grew rows past the item count's natural shape.
      cols = Math.max(cols, Math.ceil(cards.length / rows));
      surfaceW = edge * 2 + cols * cellW;
      surfaceH = edge * 2 + rows * cellH;
    }

    grid.style.width = surfaceW + "px";
    grid.style.height = surfaceH + "px";
    surface.style.width = surfaceW + "px";
    surface.style.height = surfaceH + "px";

    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      var col = i % cols;
      var row = Math.floor(i / cols);

      // Small, bounded wobble — keeps rhythm without giant empty pockets.
      var brick = row % 2 === 1 ? cellW * 0.18 : 0;
      var jx = (hash01(i) - 0.5) * gapX * 0.45;
      var jy = (hash01(i + 91) - 0.5) * gapY * 0.4;
      var rowDrift = (hash01(row * 17 + 3) - 0.5) * gapY * 0.35;

      var left = edge + col * cellW + brick + jx;
      var top = edge + row * cellH + rowDrift + jy;

      left = clamp(left, edge * 0.5, surfaceW - cardW - edge * 0.5);
      top = clamp(top, edge * 0.5, surfaceH - cardH - edge * 0.5);

      var rot = ((hash01(i + 17) - 0.5) * 10).toFixed(2);
      card.style.left = left + "px";
      card.style.top = top + "px";
      card.style.setProperty("--scatter-rot", rot + "deg");
      card.style.setProperty(
        "--scatter-shift-x",
        ((hash01(i + 3) - 0.5) * 6).toFixed(1) + "px"
      );
      card.style.setProperty(
        "--scatter-shift-y",
        ((hash01(i + 11) - 0.5) * 8).toFixed(1) + "px"
      );
    }

    return true;
  }

  function edgeCuts() {
    var vw = viewport.clientWidth;
    var vh = viewport.clientHeight;
    var cards = surface.querySelectorAll(".collection-card");
    var cut = { left: 0, right: 0, top: 0, bottom: 0 };
    for (var i = 0; i < cards.length; i++) {
      var r = cards[i].getBoundingClientRect();
      if (r.bottom <= 0 || r.top >= vh || r.right <= 0 || r.left >= vw) continue;
      if (r.left < -2) cut.left++;
      if (r.right > vw + 2) cut.right++;
      if (r.top < -2) cut.top++;
      if (r.bottom > vh + 2) cut.bottom++;
    }
    return cut;
  }

  function frameSoAllEdgesClip(cx, cy) {
    // Prefer a true center, then nudge until covers spill off every side —
    // that reads as a pannable canvas instead of a page.
    var nx = cx;
    var ny = cy;
    setPan(nx, ny, false);
    for (var step = 0; step < 10; step++) {
      var cut = edgeCuts();
      if (cut.left && cut.right && cut.top && cut.bottom) break;
      if (!cut.left) nx -= 48;
      if (!cut.right) nx += 48;
      if (!cut.top) ny -= 56;
      if (!cut.bottom) ny += 56;
      setPan(nx, ny, false);
    }
    return { x: x, y: y };
  }

  function playPanHint(cx, cy) {
    if (hinted || reduceMotion) return;
    hinted = true;
    // Short diagonal nudge so every edge reveals more covers, then settle.
    window.setTimeout(function () {
      setPan(cx - 90, cy - 60, true);
      window.setTimeout(function () {
        setPan(cx, cy, true);
      }, 720);
    }, 480);
  }

  function frameInitial(withHint) {
    if (!enabled()) {
      surface.style.transform = "";
      surface.style.transition = "";
      viewport.classList.remove("is-panning");
      desk.classList.remove("is-panning");
      return;
    }

    scale = 1;
    var c = centerPan();
    var settled = frameSoAllEdgesClip(c.x, c.y);
    if (withHint !== false) playPanHint(settled.x, settled.y);
  }

  function layoutDesk() {
    if (!enabled()) {
      desk.classList.remove("is-scattered");
      var grid = surface.querySelector("[data-collection='books']");
      if (grid) {
        grid.classList.remove("collection-grid--scattered");
        grid.style.width = "";
        grid.style.height = "";
      }
      surface.style.width = "";
      surface.style.height = "";
      surface.style.transform = "";
      return;
    }
    if (scatterBooks()) {
      frameInitial(true);
    }
  }

  function onPointerDown(e) {
    if (!enabled()) return;
    if (e.pointerType === "mouse" && e.button !== 0 && e.button !== 1) return;
    if (
      e.target.closest &&
      e.target.closest("button, input, textarea, select")
    ) {
      return;
    }
    dragging = true;
    moved = false;
    startClientX = e.clientX;
    startClientY = e.clientY;
    startX = x;
    startY = y;
    // Defer pointer capture until a real pan starts so a click on a book
    // still lands on the card and can open the modal.
  }

  function onPointerMove(e) {
    if (!dragging || !enabled()) return;
    var dx = e.clientX - startClientX;
    var dy = e.clientY - startClientY;
    if (
      !moved &&
      Math.abs(dx) < DRAG_THRESHOLD &&
      Math.abs(dy) < DRAG_THRESHOLD
    ) {
      return;
    }
    if (!moved) {
      moved = true;
      hinted = true;
      viewport.classList.add("is-panning");
      desk.classList.add("is-panning");
      try {
        viewport.setPointerCapture(e.pointerId);
      } catch (_) {
        /* ignore */
      }
    }
    e.preventDefault();
    setPan(startX + dx, startY + dy, false);
  }

  function onPointerUp(e) {
    if (!dragging) return;
    dragging = false;
    viewport.classList.remove("is-panning");
    desk.classList.remove("is-panning");
    try {
      if (viewport.hasPointerCapture && viewport.hasPointerCapture(e.pointerId)) {
        viewport.releasePointerCapture(e.pointerId);
      }
    } catch (_) {
      /* ignore */
    }
  }

  function onClickCapture(e) {
    if (!moved) return;
    e.preventDefault();
    e.stopPropagation();
    if (typeof e.stopImmediatePropagation === "function") {
      e.stopImmediatePropagation();
    }
    window.setTimeout(function () {
      moved = false;
    }, 0);
  }

  function onWheel(e) {
    if (!enabled()) return;
    hinted = true;
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      var factor = Math.exp(-e.deltaY * 0.0025);
      setScaleAt(scale * factor, e.clientX, e.clientY);
      return;
    }
    e.preventDefault();
    var dx = e.deltaX;
    var dy = e.deltaY;
    if (e.shiftKey && !dx) {
      dx = dy;
      dy = 0;
    }
    if (e.deltaMode === 1) {
      dx *= 16;
      dy *= 16;
    } else if (e.deltaMode === 2) {
      dx *= viewport.clientWidth;
      dy *= viewport.clientHeight;
    }
    panBy(-dx, -dy);
  }

  function onKeyDown(e) {
    if (!enabled()) return;
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    var step = e.shiftKey ? 120 : 64;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      hinted = true;
      panBy(step, 0);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      hinted = true;
      panBy(-step, 0);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      hinted = true;
      panBy(0, step);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      hinted = true;
      panBy(0, -step);
    } else if (e.key === "0" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      resetView();
    } else if ((e.key === "=" || e.key === "+") && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      var rect = viewport.getBoundingClientRect();
      setScaleAt(
        scale * 1.1,
        rect.left + rect.width / 2,
        rect.top + rect.height / 2
      );
    } else if (e.key === "-" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      var r = viewport.getBoundingClientRect();
      setScaleAt(scale / 1.1, r.left + r.width / 2, r.top + r.height / 2);
    }
  }

  viewport.addEventListener("pointerdown", onPointerDown);
  viewport.addEventListener("pointermove", onPointerMove);
  viewport.addEventListener("pointerup", onPointerUp);
  viewport.addEventListener("pointercancel", onPointerUp);
  document.addEventListener("click", onClickCapture, true);
  viewport.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("keydown", onKeyDown);

  var resizeTimer = 0;
  window.addEventListener("resize", function () {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(function () {
      hinted = true;
      layoutDesk();
    }, 100);
  });

  if (mq && typeof mq.addEventListener === "function") {
    mq.addEventListener("change", layoutDesk);
  } else if (mq && typeof mq.addListener === "function") {
    mq.addListener(layoutDesk);
  }

  var laidOut = false;
  function tryLayout() {
    if (laidOut) return;
    if (!surface.querySelector(".collection-card")) return;
    laidOut = true;
    observer.disconnect();
    window.clearInterval(poll);
    requestAnimationFrame(function () {
      requestAnimationFrame(layoutDesk);
    });
  }

  var observer = new MutationObserver(tryLayout);
  observer.observe(surface, { childList: true, subtree: true });
  var poll = window.setInterval(tryLayout, 120);
  window.setTimeout(function () {
    window.clearInterval(poll);
  }, 8000);
  tryLayout();

  desk.dataset.canvasReady = "1";
})();
