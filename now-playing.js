// Polls the Cloudflare now-playing Worker. Status stays visible: listening,
// offline, or disconnected. Last-known track remains as fallback.
(function () {
  // Absolute Worker URL until kreth.work is served by the portfolio Worker
  // (which can proxy same-origin /api/now-playing). GitHub Pages has no /api.
  var API_URL =
    "https://kreth-now-playing.juliankreth-a09.workers.dev/api/now-playing";
  var POLL_MS = 30 * 1000;
  var STATUS_LABELS = {
    listening: "Listening now",
    offline: "Offline",
    disconnected: "Disconnected",
  };
  var pollTimer = null;

  window.initNowPlaying = function () {
    var root = document.querySelector("[data-now-playing]");
    if (!root || root.dataset.nowPlayingReady) return;
    root.dataset.nowPlayingReady = "1";

    var songEl = root.querySelector(".nowplaying__song");
    var artistEl = root.querySelector(".nowplaying__artist");
    var coverEl = root.querySelector(".nowplaying__cover");
    var widgetEl = root.querySelector(".nowplaying__widget");
    var labelEl = root.querySelector(".nowplaying__status-label");
    var reduceMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var coastEndHandler = null;

    function setStatus(status) {
      var prev = root.dataset.status;
      root.hidden = false;
      root.dataset.status = status;
      if (labelEl) labelEl.textContent = STATUS_LABELS[status] || STATUS_LABELS.offline;

      if (!widgetEl || !widgetEl.classList.contains("is-in")) return;
      if (status === "listening") startSpin();
      else if (prev === "listening") stopSpin();
    }

    function markCoverLoaded() {
      if (coverEl) coverEl.classList.add("is-loaded");
    }

    function bindCoverLoad() {
      if (!coverEl) return;
      if (coverEl.getAttribute("src") && coverEl.complete && coverEl.naturalWidth > 0) {
        markCoverLoaded();
        return;
      }
      coverEl.addEventListener("load", function onLoad() {
        coverEl.removeEventListener("load", onLoad);
        markCoverLoaded();
      });
      coverEl.addEventListener("error", function onError() {
        coverEl.removeEventListener("error", onError);
        markCoverLoaded();
      });
    }

    function rotationDeg(el) {
      var t = getComputedStyle(el).transform;
      if (!t || t === "none") return 0;
      var m = t.match(/matrix\(([^)]+)\)/);
      if (!m) return 0;
      var parts = m[1].split(",");
      var a = parseFloat(parts[0]);
      var b = parseFloat(parts[1]);
      return (Math.atan2(b, a) * 180) / Math.PI;
    }

    function clearCoastHandler() {
      if (!coverEl || !coastEndHandler) return;
      coverEl.removeEventListener("transitionend", coastEndHandler);
      coastEndHandler = null;
    }

    function startSpin() {
      if (reduceMotion || !coverEl) return;
      clearCoastHandler();
      coverEl.classList.remove("is-coasting");
      coverEl.style.transition = "";
      coverEl.style.transform = "";
      coverEl.classList.add("is-spinning");
    }

    function stopSpin(options) {
      if (reduceMotion || !coverEl) return;
      if (
        !coverEl.classList.contains("is-spinning") &&
        !coverEl.classList.contains("is-coasting")
      ) {
        return;
      }

      var opts = options || {};
      var extraDeg = typeof opts.extraDeg === "number" ? opts.extraDeg : 110;
      var durationMs = typeof opts.durationMs === "number" ? opts.durationMs : 1500;
      var easing = opts.easing || "cubic-bezier(0.05, 0.7, 0.1, 1)";

      var deg = rotationDeg(coverEl);
      clearCoastHandler();
      coverEl.classList.remove("is-spinning");
      coverEl.style.transition = "none";
      coverEl.style.transform = "rotate(" + deg + "deg)";
      // Force the freeze frame before coasting.
      void coverEl.offsetWidth;

      coverEl.classList.add("is-coasting");
      coverEl.style.transition =
        "transform " + durationMs / 1000 + "s " + easing;
      coverEl.style.transform = "rotate(" + (deg + extraDeg) + "deg)";

      coastEndHandler = function onCoastEnd(event) {
        if (event.target !== coverEl) return;
        if (event.propertyName !== "transform") return;
        clearCoastHandler();
        coverEl.classList.remove("is-coasting");
        // Keep the final angle so it doesn't snap back.
      };
      coverEl.addEventListener("transitionend", coastEndHandler);
    }

    // Offline first paint: brief spin, then a long coast so it feels like
    // the record just wound down. Listening keeps the infinite spin.
    function playEntranceMotion() {
      if (reduceMotion || !coverEl) return;
      if (root.dataset.status === "listening") {
        startSpin();
        return;
      }
      startSpin();
      window.setTimeout(function () {
        if (root.dataset.status === "listening") return;
        stopSpin({
          extraDeg: 200,
          durationMs: 2200,
          easing: "cubic-bezier(0.02, 0.85, 0.15, 1)",
        });
      }, 520);
    }

    function finishEntrance() {
      if (!widgetEl) return;
      widgetEl.classList.remove("is-pending", "is-entering");
      widgetEl.classList.add("is-in");
      root.classList.add("is-spin-ready");
      playEntranceMotion();
      // Persist only after the widget is visible. Saving mid-entrance left
      // chrome cache with data-hydrated + is-pending, so later loads stayed
      // at opacity 0 forever.
      if (window.persistChromeCache) window.persistChromeCache();
    }

    function runEntrance() {
      if (!widgetEl) return;

      bindCoverLoad();

      if (reduceMotion) {
        finishEntrance();
        return;
      }

      var vinyl = widgetEl.querySelector(".nowplaying__vinyl-wrapper");
      var info = widgetEl.querySelector(".nowplaying__info");
      var status = widgetEl.querySelector(".nowplaying__status");
      if (vinyl) vinyl.style.setProperty("--enter-delay", "40ms");
      if (info) info.style.setProperty("--enter-delay", "90ms");
      if (status) status.style.setProperty("--enter-delay", "140ms");

      widgetEl.classList.remove("is-in", "is-entering");
      widgetEl.classList.add("is-pending");

      var finished = false;
      function complete() {
        if (finished) return;
        finished = true;
        finishEntrance();
      }

      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          widgetEl.classList.remove("is-pending");
          widgetEl.classList.add("is-entering");
          widgetEl.addEventListener(
            "transitionend",
            function onEnd(event) {
              if (event.target !== widgetEl) return;
              if (event.propertyName !== "opacity") return;
              widgetEl.removeEventListener("transitionend", onEnd);
              complete();
            }
          );
          // Fallback if transitionend never fires (cached mid-state, reduced paint).
          window.setTimeout(complete, 700);
        });
      });
    }

    function markHydrated() {
      // chrome-entrance.js owns the first paint when present — don't re-run
      // and wait on the API; just finish spin once the widget is visible.
      if (root.getAttribute("data-entrance") === "chrome") {
        root.dataset.hydrated = "1";
        if (widgetEl && widgetEl.classList.contains("is-in")) {
          root.classList.add("is-spin-ready");
          playEntranceMotion();
        } else if (widgetEl) {
          widgetEl.addEventListener(
            "transitionend",
            function onChromeIn(event) {
              if (event.target !== widgetEl) return;
              if (event.propertyName !== "opacity") return;
              widgetEl.removeEventListener("transitionend", onChromeIn);
              root.classList.add("is-spin-ready");
              playEntranceMotion();
            }
          );
          window.setTimeout(function () {
            root.classList.add("is-spin-ready");
            playEntranceMotion();
          }, 700);
        }
        return;
      }

      if (root.dataset.hydrated) {
        // Recover from chrome cache that saved while still pending/hidden.
        if (widgetEl && !widgetEl.classList.contains("is-in")) {
          runEntrance();
        }
        return;
      }
      // Pending before hydrated so the first painted frame is opacity 0.
      if (widgetEl && !reduceMotion) widgetEl.classList.add("is-pending");
      root.dataset.hydrated = "1";
      runEntrance();
    }

    function applyTrack(data) {
      if (!data || !data.title) return;

      if (songEl) {
        songEl.textContent = data.title;
        songEl.title = data.title;
      }
      if (artistEl) {
        artistEl.textContent = data.artist || "";
        artistEl.title = data.artist || "";
      }

      if (coverEl && data.albumArt) {
        coverEl.alt = (data.title || "Album") + " cover art";
        if (coverEl.getAttribute("src") !== data.albumArt) {
          coverEl.classList.remove("is-loaded");
          coverEl.src = data.albumArt;
          bindCoverLoad();
        } else {
          markCoverLoaded();
        }
      }

      if (widgetEl && data.url) {
        widgetEl.onclick = function () {
          window.open(data.url, "_blank", "noopener,noreferrer");
        };
        widgetEl.style.cursor = "pointer";
        widgetEl.setAttribute("title", "Open in Spotify");
      }
    }

    async function poll() {
      try {
        var res = await fetch(API_URL, { cache: "no-store" });
        if (!res.ok) {
          setStatus("disconnected");
          markHydrated();
          return;
        }
        var data = await res.json();
        if (data && data.error) {
          setStatus("disconnected");
          markHydrated();
          return;
        }
        applyTrack(data);
        setStatus(data && data.playing ? "listening" : "offline");
        markHydrated();
      } catch {
        setStatus("disconnected");
        markHydrated();
      }
    }

    poll();
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(poll, POLL_MS);
  };

  window.initNowPlaying();
})();
