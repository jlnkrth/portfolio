// Page-load entrance for profile card + top nav (matches now-playing motion).
(function () {
  "use strict";

  var reduceMotion =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function finish(el) {
    if (!el) return;
    el.classList.remove("is-pending", "is-entering");
    el.classList.add("is-in");
    el.style.removeProperty("--enter-delay");
  }

  function enter(el, delayMs) {
    if (!el) return;

    if (reduceMotion) {
      finish(el);
      return;
    }

    el.style.setProperty("--enter-delay", (delayMs || 0) + "ms");
    el.classList.remove("is-in", "is-entering");
    el.classList.add("is-pending");

    var finished = false;
    function complete() {
      if (finished) return;
      finished = true;
      finish(el);
      if (window.persistChromeCache) window.persistChromeCache();
    }

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        el.classList.remove("is-pending");
        el.classList.add("is-entering");
        el.addEventListener(
          "transitionend",
          function onEnd(event) {
            if (event.target !== el) return;
            if (event.propertyName !== "opacity") return;
            el.removeEventListener("transitionend", onEnd);
            complete();
          }
        );
        window.setTimeout(complete, 700 + (delayMs || 0));
      });
    });
  }

  function initChromeEntrance() {
    // Replay each load, same as the Spotify widget. layout.js sanitizes
    // entrance classes out of the chrome cache so we never stick at opacity 0.
    enter(document.querySelector(".layout .profile-card"), 0);
    enter(document.querySelector(".top-nav"), 70);
  }

  window.initChromeEntrance = initChromeEntrance;
})();
