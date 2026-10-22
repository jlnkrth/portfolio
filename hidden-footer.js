// Hidden footer Easter egg: at the top of the page, extra scroll reveals
// a black bar under the white sheet. Own content; own assets.
(function () {
  if (document.querySelector("[data-hidden-footer]")) return;

  var reduced =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var footer = document.createElement("div");
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
    '<span class="hidden-footer__track" data-hidden-footer-track data-offline="true">Not playing</span>' +
    "</div>" +
    '<div class="hidden-footer__meta">' +
    '<span data-hidden-footer-place>Hamburg</span>' +
    "&nbsp;" +
    "<strong data-hidden-footer-time></strong>" +
    "</div>" +
    "</div>";
  document.body.appendChild(footer);

  var open = false;
  var wheelDistance = 0;
  var idleTimer = 0;
  var touchStartY = 0;
  var touchStartAt = 0;
  var touching = false;
  var touchThreshold =
    window.innerWidth < 640 || "ontouchstart" in window ? 60 : 100;

  function atTop() {
    return (window.scrollY || document.documentElement.scrollTop || 0) <= 1;
  }

  function pageCanScroll() {
    return document.documentElement.scrollHeight - window.innerHeight > 8;
  }

  function syncCopy() {
    var track = footer.querySelector("[data-hidden-footer-track]");
    var song = document.querySelector(".nowplaying__song");
    var artist = document.querySelector(".nowplaying__artist");
    var widget = document.querySelector("[data-now-playing]");
    var playing =
      widget &&
      widget.getAttribute("data-status") === "online" &&
      song &&
      song.textContent.trim();
    if (track) {
      track.textContent = playing
        ? song.textContent.trim() +
          (artist && artist.textContent.trim()
            ? " · " + artist.textContent.trim()
            : "")
        : "Not playing";
      track.setAttribute("data-offline", playing ? "false" : "true");
    }

    var place = footer.querySelector("[data-hidden-footer-place]");
    var time = footer.querySelector("[data-hidden-footer-time]");
    var loc = document.querySelector(".availability__location");
    var clock = document.querySelector(".availability__time");
    if (place && loc && loc.textContent.trim()) {
      place.textContent = loc.textContent.trim().split(",")[0];
    }
    if (time) {
      time.textContent = clock && clock.textContent.trim() ? clock.textContent.trim() : "";
    }
  }

  function setOpen(next) {
    if (next === open) return;
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
      if (wheelDistance < -100) {
        setOpen(false);
        wheelDistance = 0;
      } else if (wheelDistance > 100) {
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
    // Reference: accumulated +deltaY reveals. Also accept -deltaY
    // overscroll at the top on scrollable pages.
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
      else if (delta > 0 && !pageCanScroll()) setOpen(true);
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
    if (Math.abs(delta) > touchThreshold) {
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
    var elapsed = Date.now() - touchStartAt;
    if (Math.abs(delta) > touchThreshold && elapsed < 500) {
      applyTouchDelta(delta);
    }
  }

  window.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("touchstart", onTouchStart, { passive: true });
  window.addEventListener("touchmove", onTouchMove, { passive: true });
  window.addEventListener("touchend", onTouchEnd, { passive: true });
  window.addEventListener("scroll", function () {
    if (open && !atTop() && (window.scrollY || 0) > 40) setOpen(false);
  }, { passive: true });

  syncCopy();
  window.setInterval(syncCopy, 4000);

  if (reduced) {
    footer.style.transition = "none";
  }
})();
