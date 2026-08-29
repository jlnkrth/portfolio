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
          slide.removeAttribute("hidden");
          slide.setAttribute("data-active", active ? "true" : "false");
        });

        dots.forEach(function (dot, i) {
          var active = i === current;
          dot.setAttribute("data-active", active ? "true" : "false");
          dot.setAttribute("aria-selected", active ? "true" : "false");
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
        if (slides.length < 2) return;
        gallery.dataset.paused = "true";
        clearIntervalAutoplay();
      }

      function resumeAutoplay() {
        if (slides.length < 2) return;
        delete gallery.dataset.paused;

        if (reducedMotion) {
          if (!intervalId) {
            intervalId = setInterval(function () {
              goTo(current + 1);
            }, SLIDE_MS);
          }
          return;
        }

        if (!fillListener) restartFillAnimation();
      }

      function startAutoplay() {
        clearIntervalAutoplay();
        clearFillListener();
        delete gallery.dataset.paused;

        if (slides.length < 2) return;

        if (reducedMotion) {
          intervalId = setInterval(function () {
            goTo(current + 1);
          }, SLIDE_MS);
          return;
        }

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
