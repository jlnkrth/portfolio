// Hidden footer Easter egg — mobile only (small or coarse-pointer viewports).
// Reads the existing now-playing widget: current track, or last played.
(function () {
  var MQ_SMALL = window.matchMedia("(max-width: 767px)");
  var MQ_COARSE = window.matchMedia("(pointer: coarse)");
  var API_URL =
    "https://kreth-now-playing.juliankreth-a09.workers.dev/api/now-playing";

  var footer = null;
  var bound = false;
  var open = false;
  var wheelDistance = 0;
  var idleTimer = 0;
  var touchStartY = 0;
  var touchStartAt = 0;
  var touching = false;
  var pollTimer = 0;
  var lastTrack = { title: "", artist: "", playing: false };

  function isMobile() {
    return MQ_SMALL.matches || MQ_COARSE.matches;
  }

  function atTop() {
    return (window.scrollY || document.documentElement.scrollTop || 0) <= 1;
  }

  function pageCanScroll() {
    return document.documentElement.scrollHeight - window.innerHeight > 8;
  }

  function touchThreshold() {
    return window.innerWidth < 640 || "ontouchstart" in window ? 60 : 100;
  }

  function readDomTrack() {
    var widget = document.querySelector("[data-now-playing]");
    var song = document.querySelector(".nowplaying__song");
    var artist = document.querySelector(".nowplaying__artist");
    var title = song && song.textContent.trim();
    var who = artist && artist.textContent.trim();
    var status = widget && widget.getAttribute("data-status");
    if (!title) return null;
    return {
      title: title,
      artist: who || "",
      playing: status === "listening",
    };
  }

  function formatLine(track) {
    if (!track || !track.title) return "";
    return track.artist ? track.title + " · " + track.artist : track.title;
  }

  function syncCopy() {
    if (!footer) return;
    var fromDom = readDomTrack();
    if (fromDom) lastTrack = fromDom;
    var label = footer.querySelector("[data-hidden-footer-label]");
    var trackEl = footer.querySelector("[data-hidden-footer-track]");
    if (!trackEl) return;
    var line = formatLine(lastTrack);
    trackEl.textContent = line;
    if (lastTrack.playing) {
      if (label) label.hidden = true;
      trackEl.setAttribute("data-state", "now");
    } else if (line) {
      if (label) {
        label.hidden = false;
        label.textContent = "Last played";
      }
      trackEl.setAttribute("data-state", "last");
    } else {
      if (label) label.hidden = true;
      trackEl.textContent = "";
      trackEl.setAttribute("data-state", "empty");
    }
  }

  function refreshFromApi() {
    fetch(API_URL, { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("now-playing");
        return res.json();
      })
      .then(function (data) {
        if (!data || !data.title) {
          syncCopy();
          return;
        }
        lastTrack = {
          title: data.title,
          artist: data.artist || "",
          playing: !!data.playing,
        };
        syncCopy();
      })
      .catch(function () {
        syncCopy();
      });
  }

  function setOpen(next) {
    if (!footer || next === open) return;
    open = next;
    footer.classList.toggle("is-open", open);
    document.body.classList.toggle("footer-revealed", open);
    footer.setAttribute("aria-hidden", open ? "false" : "true");
    if (open) syncCopy();
  }

  function onWheel(event) {
    clearTimeout(idleTimer);
    idleTimer = window.setTimeout(function () {
      wheelDistance = 0;
    }, 200);

    if (open) {
      event.preventDefault();
      wheelDistance += event.deltaY;
      if (Math.abs(wheelDistance) > 100) {
        setOpen(false);
        wheelDistance = 0;
      }
      return;
    }

    if (!atTop()) return;
    if (pageCanScroll() && event.deltaY > 0) {
      wheelDistance = 0;
      return;
    }

    event.preventDefault();
    wheelDistance += event.deltaY;
    if (wheelDistance > 100 || wheelDistance < -100) {
      setOpen(true);
      wheelDistance = 0;
    }
  }

  function onTouchStart(event) {
    if (event.touches.length !== 1) return;
    if (!open && !atTop()) return;
    touching = true;
    touchStartY = event.touches[0].clientY;
    touchStartAt = Date.now();
  }

  function applyTouchDelta(delta) {
    if (open) {
      if (delta < 0) setOpen(false);
      return;
    }
    if (!atTop()) return;
    if (pageCanScroll()) {
      if (delta < 0) setOpen(true);
      return;
    }
    if (delta > 0) setOpen(true);
    else setOpen(false);
  }

  function onTouchMove(event) {
    if (!touching || event.touches.length !== 1) return;
    var delta = touchStartY - event.touches[0].clientY;
    if (Math.abs(delta) > touchThreshold()) {
      applyTouchDelta(delta);
      touchStartY = event.touches[0].clientY;
    }
  }

  function onTouchEnd(event) {
    if (!touching) return;
    touching = false;
    var point = event.changedTouches[0];
    if (!point) return;
    var delta = touchStartY - point.clientY;
    if (Math.abs(delta) > touchThreshold() && Date.now() - touchStartAt < 500) {
      applyTouchDelta(delta);
    }
  }

  function onScroll() {
    if (open && !atTop() && (window.scrollY || 0) > 40) setOpen(false);
  }

  function bind() {
    if (bound) return;
    bound = true;
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  function unbind() {
    if (!bound) return;
    bound = false;
    window.removeEventListener("wheel", onWheel);
    window.removeEventListener("touchstart", onTouchStart);
    window.removeEventListener("touchmove", onTouchMove);
    window.removeEventListener("touchend", onTouchEnd);
    window.removeEventListener("scroll", onScroll);
  }

  function mount() {
    if (footer || !isMobile()) return;
    footer = document.createElement("div");
    footer.className = "hidden-footer";
    footer.setAttribute("data-hidden-footer", "");
    footer.setAttribute("aria-hidden", "true");
    footer.innerHTML =
      '<div class="hidden-footer__sheet" aria-hidden="true"></div>' +
      '<div class="hidden-footer__bar">' +
      '<div class="hidden-footer__now">' +
      '<svg class="hidden-footer__eq" viewBox="0 0 18 18" fill="none" aria-hidden="true">' +
      '<rect x="3" y="8" width="2.4" height="7" rx="1.2" fill="currentColor"/>' +
      '<rect x="7.8" y="4" width="2.4" height="11" rx="1.2" fill="currentColor"/>' +
      '<rect x="12.6" y="6.5" width="2.4" height="8.5" rx="1.2" fill="currentColor"/>' +
      "</svg>" +
      '<span class="hidden-footer__label" data-hidden-footer-label hidden>Last played</span>' +
      '<span class="hidden-footer__track" data-hidden-footer-track data-state="empty"></span>' +
      "</div>" +
      "</div>";
    document.body.appendChild(footer);
    if (
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      footer.style.transition = "none";
    }
    bind();
    syncCopy();
    refreshFromApi();
    var widget = document.querySelector("[data-now-playing]");
    if (widget && typeof MutationObserver !== "undefined") {
      new MutationObserver(syncCopy).observe(widget, {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: true,
      });
    }
    pollTimer = window.setInterval(function () {
      syncCopy();
    }, 4000);
  }

  function unmount() {
    unbind();
    setOpen(false);
    document.body.classList.remove("footer-revealed");
    if (footer && footer.parentNode) footer.parentNode.removeChild(footer);
    footer = null;
    open = false;
    wheelDistance = 0;
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = 0;
    }
  }

  function syncMode() {
    if (isMobile()) mount();
    else unmount();
  }

  syncMode();
  if (MQ_SMALL.addEventListener) {
    MQ_SMALL.addEventListener("change", syncMode);
    MQ_COARSE.addEventListener("change", syncMode);
  } else {
    MQ_SMALL.addListener(syncMode);
    MQ_COARSE.addListener(syncMode);
  }
})();
