// Polls the Cloudflare now-playing Worker. Status stays visible: listening,
// offline, or disconnected. Last-known track remains as fallback.
(function () {
  var API_URL = "https://kreth-now-playing.juliankreth-a09.workers.dev/api/now-playing";
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

    function setStatus(status) {
      root.hidden = false;
      root.dataset.status = status;
      if (labelEl) labelEl.textContent = STATUS_LABELS[status] || STATUS_LABELS.offline;
    }

    function markHydrated() {
      if (root.dataset.hydrated) return;
      root.dataset.hydrated = "1";
      if (window.persistChromeCache) window.persistChromeCache();
    }

    function applyTrack(data) {
      if (!data || !data.title) return;

      if (songEl) songEl.textContent = data.title;
      if (artistEl) artistEl.textContent = data.artist || "";

      if (coverEl && data.albumArt) {
        coverEl.src = data.albumArt;
        coverEl.alt = (data.title || "Album") + " cover art";
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
        applyTrack(data);
        setStatus(data.playing ? "listening" : "offline");
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
