(function () {
  var SLIDE_MS = 5000;

  function initPhotoGalleries(root) {
    var scope = root || document;
    var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    scope.querySelectorAll("[data-photo-gallery]").forEach(function (gallery) {
      if (gallery.dataset.galleryReady) return;
      gallery.dataset.galleryReady = "1";
      gallery.style.setProperty("--gallery-interval", SLIDE_MS + "ms");

      var slides = gallery.querySelectorAll(".photo-gallery__slide");
      var dots = gallery.querySelectorAll(".photo-gallery__dot");
      if (!slides.length) return;

      var current = 0;
      var fillListener = null;
      var intervalId = null;

      dots.forEach(function (dot) {
        if (!dot.querySelector(".photo-gallery__dot-fill")) {
          var fill = document.createElement("span");
          fill.className = "photo-gallery__dot-fill";
          fill.setAttribute("aria-hidden", "true");
          dot.appendChild(fill);
        }
      });

      for (var i = 0; i < slides.length; i++) {
        if (slides[i].getAttribute("data-active") === "true") {
          current = i;
          break;
        }
      }

      function clearFillListener() {
        if (!fillListener) return;
        var dot = dots[current];
        var fill = dot && dot.querySelector(".photo-gallery__dot-fill");
        if (fill) fill.removeEventListener("animationend", fillListener);
        fillListener = null;
      }

      function clearIntervalAutoplay() {
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
      }

      function applySlideState() {
        slides.forEach(function (slide, i) {
          var active = i === current;
          if (active) {
            slide.removeAttribute("hidden");
            slide.removeAttribute("aria-hidden");
          } else {
            slide.setAttribute("hidden", "");
            slide.setAttribute("aria-hidden", "true");
          }
          slide.setAttribute("data-active", active ? "true" : "false");
        });

        dots.forEach(function (dot, i) {
          var active = i === current;
          dot.setAttribute("data-active", active ? "true" : "false");
          dot.setAttribute("aria-selected", active ? "true" : "false");
          dot.tabIndex = active ? 0 : -1;
        });
      }

      function restartFillAnimation() {
        clearFillListener();
        if (reducedMotion || slides.length < 2) return;

        var fill = dots[current] && dots[current].querySelector(".photo-gallery__dot-fill");
        if (!fill) return;

        fill.style.animation = "none";
        void fill.offsetWidth;
        fill.style.animation = "";

        fillListener = function (event) {
          if (event.target !== fill || event.animationName !== "photo-gallery-dot-fill") return;
          goTo(current + 1);
        };
        fill.addEventListener("animationend", fillListener);
      }

      function pauseAutoplay() {
        if (slides.length < 2 || reducedMotion) return;
        gallery.dataset.paused = "true";
        clearIntervalAutoplay();
      }

      function resumeAutoplay() {
        if (slides.length < 2 || reducedMotion) return;
        delete gallery.dataset.paused;
        if (!fillListener) restartFillAnimation();
      }

      function startAutoplay() {
        clearIntervalAutoplay();
        clearFillListener();
        delete gallery.dataset.paused;

        if (slides.length < 2 || reducedMotion) return;
        restartFillAnimation();
      }

      function goTo(index) {
        current = (index + slides.length) % slides.length;
        applySlideState();
        startAutoplay();
      }

      dots.forEach(function (dot, i) {
        dot.addEventListener("click", function () {
          goTo(i);
        });

        dot.addEventListener("keydown", function (event) {
          var next = current;
          if (event.key === "ArrowRight" || event.key === "ArrowDown") {
            next = current + 1;
          } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
            next = current - 1;
          } else if (event.key === "Home") {
            next = 0;
          } else if (event.key === "End") {
            next = slides.length - 1;
          } else {
            return;
          }
          event.preventDefault();
          goTo(next);
          if (dots[current]) dots[current].focus();
        });
      });

      gallery.addEventListener("mouseenter", pauseAutoplay);
      gallery.addEventListener("mouseleave", resumeAutoplay);
      gallery.addEventListener("focusin", pauseAutoplay);
      gallery.addEventListener("focusout", function (event) {
        if (!gallery.contains(event.relatedTarget)) resumeAutoplay();
      });

      applySlideState();
      startAutoplay();
    });
  }

  window.initPhotoGalleries = initPhotoGalleries;
  initPhotoGalleries();
})();
