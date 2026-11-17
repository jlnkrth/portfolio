/* Move desk objects without taking them out of their original layout. */
(function (global) {
  "use strict";

  var SNAP_PX = 32;
  var visibleSlots = new Set();
  var paintOrder = [];
  var slotFrame = 0;

  function px(n) {
    return Math.round(n) + "px";
  }

  function dragSelected() {
    return document.documentElement.dataset.deskTool !== "pen";
  }

  function raise(el) {
    var layer = el;
    while (layer) {
      var oldIndex = paintOrder.indexOf(layer);
      if (oldIndex !== -1) paintOrder.splice(oldIndex, 1);
      paintOrder.push(layer);
      layer = layer.parentElement && layer.parentElement.closest("[data-desk-layer]");
    }
    paintOrder.forEach(function (item, i) {
      item.style.setProperty("--desk-z", String(i + 12));
    });
  }

  function refreshSlots() {
    if (!visibleSlots.size || slotFrame) return;
    slotFrame = requestAnimationFrame(function () {
      slotFrame = 0;
      visibleSlots.forEach(function (slot) { slot.update(); });
    });
  }

  global.addEventListener("resize", refreshSlots);
  global.addEventListener("scroll", refreshSlots, true);

  function createSlot(label, measure, host) {
    var outline;
    var slot = {
      near: function (rect) {
        var home = measure();
        return Math.hypot(rect.left - home.left, rect.top - home.top) <= SNAP_PX;
      },
      update: function () {
        var rect = measure();
        var parent = host ? host.getBoundingClientRect() : { left: 0, top: 0 };
        outline.style.left = px(rect.left - parent.left);
        outline.style.top = px(rect.top - parent.top);
        outline.style.width = px(rect.width);
        outline.style.height = px(rect.height);
      },
      show: function (near) {
        if (!outline) {
          outline = document.createElement("div");
          outline.className = "desk-slot-outline " + (host ? "desk-slot-outline--local" : "swipe-nav__stay");
          outline.setAttribute("aria-hidden", "true");
          outline.textContent = label;
          (host || document.body).appendChild(outline);
          visibleSlots.add(slot);
        }
        outline.classList.toggle("is-near", !!near);
        slot.update();
      },
      hide: function () {
        if (!outline) return;
        visibleSlots.delete(slot);
        outline.remove();
        outline = null;
      }
    };
    return slot;
  }

  function bind(el) {
    if (!el || el.__deskDrag) return el && el.__deskDrag;
    var touchHandle = el.getAttribute("data-drag-touch-handle");
    var exclude = el.getAttribute("data-drag-exclude") ||
      "a, button, input, textarea, select, label, [data-no-drag], .pad__nav, canvas";
    var label = el.getAttribute("data-desk-label");
    var x = 0;
    var y = 0;
    var drag = null;
    var suppressClickUntil = 0;
    var slot = label ? createSlot(label, homeRect) : null;

    function homeRect() {
      var rect = (el.querySelector("[data-pad]") || el).getBoundingClientRect();
      return { left: rect.left - x, top: rect.top - y, width: rect.width, height: rect.height };
    }

    function apply(nextX, nextY, dragging) {
      x = Math.round(nextX);
      y = Math.round(nextY);
      el.style.setProperty("--drag-x", px(x));
      el.style.setProperty("--drag-y", px(y));
      el.classList.toggle("is-off-slot", !!(x || y));
      if (!slot) return;
      if (x || y) slot.show(dragging && Math.hypot(x, y) <= SNAP_PX);
      else slot.hide();
    }

    function bound(n, min, max) {
      return min > max ? (min + max) / 2 : Math.max(min, Math.min(max, n));
    }

    function move(nextX, nextY, dragging) {
      var rect = homeRect();
      var margin = 8;
      apply(
        bound(nextX, margin - rect.left, global.innerWidth - margin - rect.width - rect.left),
        bound(nextY, margin - rect.top, global.innerHeight - margin - rect.height - rect.top),
        dragging
      );
    }

    function onDown(event) {
      if (drag || event.isPrimary === false || (event.button != null && event.button !== 0)) return;
      suppressClickUntil = 0;
      if (!dragSelected() || event.target.closest(exclude)) return;
      if (event.pointerType === "touch" && touchHandle && !event.target.closest(touchHandle)) return;
      drag = { id: event.pointerId, sx: event.clientX, sy: event.clientY, x: x, y: y, moved: false };
      event.stopPropagation();
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onEnd);
      document.addEventListener("pointercancel", onEnd);
    }

    function onMove(event) {
      if (!drag || event.pointerId !== drag.id || !dragSelected()) return;
      var dx = event.clientX - drag.sx;
      var dy = event.clientY - drag.sy;
      if (!drag.moved) {
        if (Math.hypot(dx, dy) < 5) return;
        drag.moved = true;
        raise(el);
        el.classList.add("is-dragging");
        try { el.setPointerCapture(event.pointerId); } catch (_) {}
      }
      if (event.cancelable) event.preventDefault();
      event.stopPropagation();
      move(drag.x + dx, drag.y + dy, true);
    }

    function onEnd(event) {
      if (!drag || event.pointerId !== drag.id) return;
      var finished = drag;
      drag = null;
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onEnd);
      document.removeEventListener("pointercancel", onEnd);
      el.classList.remove("is-dragging");
      if (!finished.moved) return;
      suppressClickUntil = performance.now() + 350;
      if (event.type === "pointercancel") apply(finished.x, finished.y);
      else if (slot && Math.hypot(x, y) <= SNAP_PX) apply(0, 0);
      else apply(x, y);
    }

    el.addEventListener("click", function (event) {
      if (event.detail === 0 || performance.now() >= suppressClickUntil) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      suppressClickUntil = 0;
    }, true);
    el.addEventListener("dragstart", function (event) {
      if (dragSelected()) event.preventDefault();
    });
    el.addEventListener("pointerdown", onDown);
    global.addEventListener("resize", function () {
      if (!x && !y) return;
      if (!el.getClientRects().length) apply(0, 0);
      else move(x, y);
    });

    var api = { reset: function () { apply(0, 0); } };
    el.__deskDrag = api;
    return api;
  }

  function init(root) {
    (root || document).querySelectorAll("[data-draggable]").forEach(bind);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { init(); });
  else init();

  global.DeskDrag = { bind: bind, init: init, createSlot: createSlot, dragSelected: dragSelected, raise: raise, refreshSlots: refreshSlots };
})(window);
