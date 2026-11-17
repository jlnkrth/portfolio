// Work desk — stickers on a pannable board (same treatment as books).
(function () {
  var desk = document.querySelector("[data-work-desk]");
  var viewport = document.querySelector("[data-work-canvas]");
  var surface = document.querySelector("[data-work-canvas-surface]");
  var board = document.querySelector("[data-sticker-board]");
  if (!desk || !viewport || !surface || !board) return;

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
  var minScale = 0.55;
  var maxScale = 1.5;
  var dragging = false;
  var moved = false;
  var startClientX = 0;
  var startClientY = 0;
  var startX = 0;
  var startY = 0;
  var DRAG_THRESHOLD = 5;
  var hinted = false;
  var stickers = [];
  var itemsCache = null;
  // Odd tile lattice so pan can wrap forever while logos repeat.
  var TILE_RANGE = 1;
  var periodX = 0;
  var periodY = 0;
  var tileOriginX = 0;
  var tileOriginY = 0;

  function enabled() {
    return !mq || mq.matches;
  }

  function clamp(v, min, max) {
    if (min > max) return (min + max) / 2;
    return Math.min(Math.max(v, min), max);
  }

  function hash01(n) {
    var t = (n + 1) * 2654435761;
    t = (t ^ (t >>> 16)) >>> 0;
    return (t % 10000) / 10000;
  }

  function applyTransform() {
    surface.style.transform =
      "translate3d(" + x + "px, " + y + "px, 0) scale(" + scale + ")";
  }

  // Keep the camera over the center tile; clones make the jump invisible.
  function wrapPan() {
    if (!enabled() || periodX <= 0 || periodY <= 0) return;
    var home = centerOnTile();
    var px = periodX * scale;
    var py = periodY * scale;
    var dx = x - home.x;
    var dy = y - home.y;
    if (px > 1) dx -= Math.round(dx / px) * px;
    if (py > 1) dy -= Math.round(dy / py) * py;
    x = home.x + dx;
    y = home.y + dy;
  }

  function setPan(nx, ny, animate) {
    x = nx;
    y = ny;
    if (!(animate && !reduceMotion)) wrapPan();
    if (animate && !reduceMotion) {
      surface.style.transition =
        "transform 0.55s cubic-bezier(0.22, 1, 0.36, 1)";
      applyTransform();
      window.setTimeout(function () {
        surface.style.transition = "";
        wrapPan();
        applyTransform();
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
    wrapPan();
    applyTransform();
  }

  function centerOnTile() {
    var vw = viewport.clientWidth;
    var vh = viewport.clientHeight;
    var midX = tileOriginX + periodX / 2;
    var midY = tileOriginY + periodY / 2;
    return {
      x: vw / 2 - midX * scale,
      y: vh / 2 - midY * scale,
    };
  }

  function markLoaded(img) {
    img.classList.add("is-loaded");
  }

  function bindImageLoad(img) {
    if (img.complete && img.naturalWidth > 0) {
      markLoaded(img);
      return;
    }
    img.addEventListener("load", function onLoad() {
      img.removeEventListener("load", onLoad);
      markLoaded(img);
    });
    img.addEventListener("error", function onError() {
      img.removeEventListener("error", onError);
      markLoaded(img);
    });
  }

  function revealStickers(list) {
    if (reduceMotion) {
      list.forEach(function (sticker) {
        sticker.classList.remove("is-pending");
        sticker.classList.add("is-in");
      });
      return;
    }
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        list.forEach(function (sticker) {
          sticker.classList.remove("is-pending");
          sticker.classList.add("is-entering");
          sticker.addEventListener(
            "transitionend",
            function onEnd(event) {
              if (event.target !== sticker) return;
              if (event.propertyName !== "opacity") return;
              sticker.classList.remove("is-entering");
              sticker.classList.add("is-in");
              sticker.style.removeProperty("--enter-delay");
              sticker.removeEventListener("transitionend", onEnd);
            }
          );
        });
      });
    });
  }

  function createSticker(item, index, animateIn) {
    var sticker = document.createElement("a");
    var fitClass =
      item.fit === "bleed"
        ? " sticker--bleed"
        : item.fit === "large"
          ? " sticker--large"
          : "";
    // Entrance stagger only on the pannable desktop canvas — mobile rebuilds
    // stickers on resize and must not stay stuck at opacity 0.
    var enter = animateIn && enabled() && !reduceMotion;
    sticker.className =
      "sticker" + fitClass + (enter ? " is-pending" : " is-in");
    sticker.href = item.href || "#";
    sticker.setAttribute("aria-label", item.title);
    if (item.slug) sticker.setAttribute("data-work-slug", item.slug);
    if (enter) {
      sticker.style.setProperty("--enter-delay", index * 32 + "ms");
    }
    // Primary click opens the project card; keep URL for open-in-new-tab.
    if (item.external || (item.href && item.href.indexOf("http") === 0)) {
      sticker.rel = "noreferrer";
    }

    if (item.image) {
      var img = document.createElement("img");
      img.src = item.image;
      img.alt = item.title;
      img.draggable = false;
      img.decoding = "async";
      img.loading = animateIn ? "eager" : "lazy";
      if (animateIn && index < 8) img.fetchPriority = "high";
      bindImageLoad(img);
      sticker.appendChild(img);
    } else {
      var ph = document.createElement("span");
      ph.className = "sticker__placeholder";
      ph.textContent = (item.title || "?").charAt(0);
      sticker.appendChild(ph);
    }
    return sticker;
  }

  function buildStickers(items) {
    board.innerHTML = "";
    stickers = [];
    var range = enabled() ? TILE_RANGE : 0;
    for (var dy = -range; dy <= range; dy++) {
      for (var dx = -range; dx <= range; dx++) {
        var isCenter = dx === 0 && dy === 0;
        for (var i = 0; i < items.length; i++) {
          var sticker = createSticker(items[i], i, isCenter);
          sticker.dataset.tileDx = String(dx);
          sticker.dataset.tileDy = String(dy);
          sticker.dataset.unitIndex = String(i);
          board.appendChild(sticker);
          stickers.push(sticker);
        }
      }
    }
  }

  function unitLayout(n, cardW, cardH, vw, vh) {
    var gapX = 96;
    var gapY = 108;
    var cellW = cardW + gapX;
    var cellH = cardH + gapY;
    var cols = Math.max(4, Math.round(Math.sqrt(n * (vw / Math.max(vh, 1)))));
    var rows = Math.ceil(n / cols);
    while (cols * rows < n) rows++;

    var positions = [];
    for (var i = 0; i < n; i++) {
      var col = i % cols;
      var row = Math.floor(i / cols);
      var brick = row % 2 === 1 ? gapX * 0.45 : 0;
      var jx = (hash01(i) - 0.5) * gapX * 0.7;
      var jy = (hash01(i + 91) - 0.5) * gapY * 0.7;
      positions.push({
        left: col * cellW + brick + jx,
        top: row * cellH + jy,
        rot: ((hash01(i + 17) - 0.5) * 12).toFixed(1) + "deg",
      });
    }

    return {
      positions: positions,
      clusterW: cols * cellW,
      clusterH: rows * cellH,
      gapX: gapX,
      gapY: gapY,
    };
  }

  function scatterStickers() {
    if (!stickers.length || !itemsCache || !itemsCache.length) return false;

    if (!enabled()) {
      desk.classList.remove("is-scattered");
      board.classList.remove("sticker-board--scattered");
      board.style.width = "";
      board.style.height = "";
      surface.style.width = "";
      surface.style.height = "";
      surface.style.transform = "";
      periodX = 0;
      periodY = 0;
      // Mobile: only keep the center (or sole) set visible in flow.
      stickers.forEach(function (sticker, i) {
        var dx = Number(sticker.dataset.tileDx || 0);
        var dy = Number(sticker.dataset.tileDy || 0);
        if (dx !== 0 || dy !== 0) {
          sticker.hidden = true;
          return;
        }
        sticker.hidden = false;
        sticker.style.left = "";
        sticker.style.top = "";
        sticker.style.setProperty(
          "--rot",
          ((hash01(i + 17) - 0.5) * 12).toFixed(1) + "deg"
        );
      });
      return false;
    }

    desk.classList.add("is-scattered");
    board.classList.add("sticker-board--scattered");

    var sample = stickers[0];
    var cardW = sample.offsetWidth || 108;
    var cardH = sample.offsetHeight || 108;
    var n = itemsCache.length;
    var vw = viewport.clientWidth || window.innerWidth;
    var vh = viewport.clientHeight || window.innerHeight;
    var layout = unitLayout(n, cardW, cardH, vw, vh);

    // Period includes a little air so repeats don't collide at the seam.
    periodX = layout.clusterW + layout.gapX;
    periodY = layout.clusterH + layout.gapY;
    var tiles = TILE_RANGE * 2 + 1;
    var surfaceW = tiles * periodX;
    var surfaceH = tiles * periodY;
    tileOriginX = TILE_RANGE * periodX;
    tileOriginY = TILE_RANGE * periodY;

    // Center the unit cluster inside each period cell.
    var insetX = (periodX - layout.clusterW) / 2;
    var insetY = (periodY - layout.clusterH) / 2;

    board.style.width = surfaceW + "px";
    board.style.height = surfaceH + "px";
    surface.style.width = surfaceW + "px";
    surface.style.height = surfaceH + "px";

    stickers.forEach(function (sticker) {
      sticker.hidden = false;
      var dx = Number(sticker.dataset.tileDx || 0);
      var dy = Number(sticker.dataset.tileDy || 0);
      var ui = Number(sticker.dataset.unitIndex || 0);
      var pos = layout.positions[ui];
      if (!pos) return;
      var left = tileOriginX + dx * periodX + insetX + pos.left;
      var top = tileOriginY + dy * periodY + insetY + pos.top;
      sticker.style.left = left + "px";
      sticker.style.top = top + "px";
      sticker.style.setProperty("--rot", pos.rot);
    });

    return true;
  }

  function playPanHint(cx, cy) {
    if (hinted || reduceMotion) return;
    hinted = true;
    window.setTimeout(function () {
      setPan(cx - 80, cy - 50, true);
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
    var c = centerOnTile();
    setPan(c.x, c.y, false);
    if (withHint !== false) playPanHint(c.x, c.y);
  }

  function expectedTileCount() {
    var range = enabled() ? TILE_RANGE : 0;
    var tiles = range * 2 + 1;
    return (itemsCache ? itemsCache.length : 0) * tiles * tiles;
  }

  function layoutDesk() {
    if (!itemsCache) return;
    var rebuilt = false;
    if (stickers.length !== expectedTileCount()) {
      buildStickers(itemsCache);
      rebuilt = true;
    }
    if (scatterStickers()) {
      frameInitial(!rebuilt);
    }
    if (rebuilt) {
      revealStickers(
        stickers.filter(function (sticker) {
          return !sticker.hidden;
        })
      );
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
      scale = 1;
      frameInitial(false);
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

  fetch("/data/collections.json")
    .then(function (r) {
      return r.json();
    })
    .then(function (data) {
      var col = data.work;
      if (!col || !col.items) return;
      itemsCache = col.items.slice();
      var morphIncoming =
        window.krethWorkViewMorph &&
        window.krethWorkViewMorph.hasPending("list-to-desk");
      buildStickers(itemsCache);
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          layoutDesk();
          if (morphIncoming) {
            stickers.forEach(function (sticker) {
              var dx = Number(sticker.dataset.tileDx || 0);
              var dy = Number(sticker.dataset.tileDy || 0);
              if (dx !== 0 || dy !== 0) return;
              sticker.classList.remove("is-pending", "is-entering");
              sticker.classList.add("is-in", "work-view-morph-hidden");
              sticker.style.removeProperty("--enter-delay");
            });
            window.krethWorkViewMorph.playPending({
              dir: "list-to-desk",
              getTarget: function (slug) {
                return board.querySelector(
                  '.sticker[data-work-slug="' +
                    slug +
                    '"][data-tile-dx="0"][data-tile-dy="0"]'
                );
              },
              onDone: function () {
                stickers.forEach(function (sticker) {
                  sticker.classList.remove("work-view-morph-hidden");
                });
              },
            });
          } else {
            revealStickers(stickers);
          }
        });
      });
    })
    .catch(function () {
      board.innerHTML = '<p class="muted">Could not load work.</p>';
    });

  desk.dataset.canvasReady = "1";
})();
