// Polls a local Spotify proxy for the current track. Fails silently in production
// or when the API is unavailable — static HTML remains as fallback.
(function () {
  var API_URL = "http://localhost:8888/api/now-playing";
  var POLL_MS = 30 * 1000;
  var LOCAL_HOSTS = ["localhost", "127.0.0.1"];
  var pollTimer = null;

  window.initNowPlaying = function () {
    if (!LOCAL_HOSTS.includes(window.location.hostname)) return;

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
