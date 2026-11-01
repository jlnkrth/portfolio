// Page-load entrance: chrome first, then content — once per browser session.
(function () {
  "use strict";

  var ENTERED_KEY = "kreth-chrome-entered";
  var reduceMotion =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function hasEntered() {
    try {
      return sessionStorage.getItem(ENTERED_KEY) === "1";
    } catch (_) {
      return false;
    }
  }

  function markEntered() {
    try {
      sessionStorage.setItem(ENTERED_KEY, "1");
    } catch (_) {}
  }

  function finish(el) {
    if (!el) return;
    el.classList.remove("is-pending", "is-entering");
    el.classList.add("is-in");
    el.style.removeProperty("--enter-delay");

    // Spotify spin cue — same handoff now-playing.js uses after its own entrance.
    if (el.classList.contains("nowplaying__widget")) {
      var np = el.closest("[data-now-playing]");
      if (np) np.classList.add("is-spin-ready");
    }

    if (window.persistChromeCache) window.persistChromeCache();
  }

  function showNow(el) {
    finish(el);
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
        window.setTimeout(complete, 520 + (delayMs || 0));
      });
    });
  }

  function claimSpotify(spotifyRoot) {
    if (!spotifyRoot) return;
    spotifyRoot.setAttribute("data-entrance", "chrome");
    if (!spotifyRoot.dataset.hydrated) spotifyRoot.dataset.hydrated = "1";
  }

  function initChromeEntrance() {
    var profile = document.querySelector(".layout .profile-card");
    var topNav = document.querySelector(".top-nav");
    var spotifyRoot = document.querySelector("[data-now-playing]");
    var spotify = spotifyRoot && spotifyRoot.querySelector(".nowplaying__widget");
    var pageRoot = document.querySelector(".layout > .root");

    // Later navigations in this session: keep chrome + content visible, no replay.
    if (hasEntered() || reduceMotion) {
      claimSpotify(spotifyRoot);
      showNow(profile);
      showNow(topNav);
      showNow(spotify);
      showNow(pageRoot);
      markEntered();
      return;
    }

    // First visit — chrome wave, then page content.
    claimSpotify(spotifyRoot);
    enter(profile, 0);
    enter(topNav, 35);
    enter(spotify, 70);
    enter(pageRoot, 200);

    // Persist after chrome has landed so the next page skips the wave.
    window.setTimeout(markEntered, 70 + 400);
  }

  window.initChromeEntrance = initChromeEntrance;
  window.hasChromeEntered = hasEntered;
})();
