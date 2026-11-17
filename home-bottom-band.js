// Align the homepage bottom band with the player and share its height with
// the project previews when they're in the same row.
(function () {
  "use strict";

  var root = document.querySelector(".root--full");
  if (!root) return;

  var split = root.querySelector(".home-split");
  var player = document.querySelector(".nowplaying");
  var widget = player && player.querySelector(".nowplaying__widget");
  if (!split || !widget) return;

  function sync() {
    split.style.removeProperty("transform");
    var widgetBounds = widget.getBoundingClientRect();
    if (window.matchMedia("(max-width: 767px)").matches || !widgetBounds.height) {
      split.style.removeProperty("--home-player-height");
      return;
    }

    split.style.setProperty("--home-player-height", widgetBounds.height + "px");
    var playerSlotBottom = player.getBoundingClientRect().top + widgetBounds.height;
    var delta = Math.round(
      split.getBoundingClientRect().bottom - playerSlotBottom
    );
    if (Math.abs(delta) <= 1) return;

    split.style.transform = "translateY(" + -delta + "px)";

    // Transform can leave a residual if sibling layout settles mid-frame.
    var residual = Math.round(
      split.getBoundingClientRect().bottom - playerSlotBottom
    );
    if (Math.abs(residual) > 1) {
      split.style.transform = "translateY(" + -(delta + residual) + "px)";
    }
  }

  var scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(function () {
      scheduled = false;
      sync();
      if (window.DeskDrag) window.DeskDrag.refreshSlots();
    });
  }

  window.krethSyncHomeBottomBand = schedule;

  sync();
  if ("ResizeObserver" in window) {
    new ResizeObserver(schedule).observe(widget, { box: "border-box" });
  }
  window.addEventListener("resize", schedule);
  window.addEventListener("load", schedule);
  setTimeout(schedule, 80);
  setTimeout(schedule, 250);
  setTimeout(schedule, 600);
  setTimeout(schedule, 1200);
})();
