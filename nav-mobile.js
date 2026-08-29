// Mobile nav sheet: open/close, body scroll lock, Escape, link close.
(function () {
  function initNavMobile(root) {
    root = root || document;
    var toggle = root.querySelector("[data-nav-menu-toggle]");
    var sheet = root.querySelector("[data-nav-sheet]");
    if (!toggle || !sheet) return;
    if (toggle.dataset.navMobileBound === "1") return;
    toggle.dataset.navMobileBound = "1";

    function isOpen() {
      return !sheet.hasAttribute("hidden");
    }

    function syncSheetTop() {
      var nav = toggle.closest(".top-nav");
      if (!nav) return;
      sheet.style.setProperty(
        "--nav-sheet-top",
        Math.ceil(nav.getBoundingClientRect().bottom) + "px",
      );
    }

    function openSheet() {
      syncSheetTop();
      sheet.removeAttribute("hidden");
      toggle.setAttribute("aria-expanded", "true");
      document.body.classList.add("nav-sheet-open");
      var closeBtn = sheet.querySelector(".nav-sheet__close");
      if (closeBtn) closeBtn.focus();
    }

    function closeSheet() {
      if (!isOpen()) return;
      sheet.setAttribute("hidden", "");
      toggle.setAttribute("aria-expanded", "false");
      document.body.classList.remove("nav-sheet-open");
      toggle.focus();
    }

    toggle.addEventListener("click", function () {
      if (isOpen()) closeSheet();
      else openSheet();
    });

    sheet.querySelectorAll("[data-nav-sheet-close]").forEach(function (el) {
      el.addEventListener("click", function (e) {
        e.preventDefault();
        closeSheet();
      });
    });

    sheet.querySelectorAll("a[href]").forEach(function (link) {
      link.addEventListener("click", function () {
        closeSheet();
      });
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && isOpen()) {
        e.preventDefault();
        closeSheet();
      }
    });

    // If the viewport grows into tablet/desktop chrome, force-close the sheet.
    window.addEventListener("resize", function () {
      if (window.matchMedia("(min-width: 768px)").matches && isOpen()) {
        closeSheet();
      } else if (isOpen()) {
        syncSheetTop();
      }
    });
  }

  window.initNavMobile = initNavMobile;

  if (document.querySelector("[data-nav-menu-toggle]")) {
    initNavMobile();
  }
})();
