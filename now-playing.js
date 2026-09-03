// Polls the Cloudflare now-playing Worker. Fails silently when the API is
// unavailable — static HTML remains as fallback.
(function () {
  var API_URL = "https://kreth-now-playing.juliankreth-a09.workers.dev/api/now-playing";
  var POLL_MS = 30 * 1000;
  var pollTimer = null;

  window.initNowPlaying = function () {

    var root = document.querySelector("[data-now-playing]");
    if (!root || root.dataset.nowPlayingReady) return;
    root.dataset.nowPlayingReady = "1";

    var songEl = root.querySelector(".nowplaying__song");
    var artistEl = root.querySelector(".nowplaying__artist");
    var coverEl = root.querySelector(".nowplaying__cover");
    var widgetEl = root.querySelector(".nowplaying__widget");

    function setVisible(visible) {
      root.hidden = !visible;
    }

    function applyTrack(data) {
      if (!data || !data.title) {
        setVisible(false);
        return;
      }

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

      setVisible(true);
    }

    async function poll() {
      try {
        var res = await fetch(API_URL, { cache: "no-store" });
        if (!res.ok) return;
        var data = await res.json();
        if (data.playing) {
          applyTrack(data);
        } else {
          setVisible(false);
        }
      } catch {
        // API down — keep static fallback visible
      }
    }

    poll();
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(poll, POLL_MS);
  };

  window.initNowPlaying();
})();
