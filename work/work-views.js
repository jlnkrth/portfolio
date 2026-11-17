// Attach Desk/List icon toggle inside the Work nav item on /work/ pages.
(function () {
  "use strict";

  var path = location.pathname.replace(/index\.html$/, "");
  var isDesk = path === "/work" || path === "/work/";
  var isList = path === "/work/list" || path === "/work/list/";
  if (!isDesk && !isList) return;

  var FROM_KEY = "kreth-work-view-from";
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var GRID_ICON =
    '<svg class="work-view-toggle__icon" width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
    '<rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1.2" stroke="currentColor" stroke-width="1.4"/>' +
    '<rect x="9" y="1.5" width="5.5" height="5.5" rx="1.2" stroke="currentColor" stroke-width="1.4"/>' +
    '<rect x="1.5" y="9" width="5.5" height="5.5" rx="1.2" stroke="currentColor" stroke-width="1.4"/>' +
    '<rect x="9" y="9" width="5.5" height="5.5" rx="1.2" stroke="currentColor" stroke-width="1.4"/>' +
    "</svg>";

  var LIST_ICON =
    '<svg class="work-view-toggle__icon" width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
    '<path d="M2.5 4h11M2.5 8h11M2.5 12h11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
    "</svg>";

  function currentView() {
    return isList ? "list" : "desk";
  }

  function positionThumb(toggle, btn, animate) {
    var thumb = toggle.querySelector(".work-view-toggle__thumb");
    if (!thumb || !btn) return;
    if (!animate) {
      thumb.style.transition = "none";
    }
    thumb.style.width = btn.offsetWidth + "px";
    thumb.style.height = btn.offsetHeight + "px";
    thumb.style.transform =
      "translate(" + btn.offsetLeft + "px, " + btn.offsetTop + "px)";
    if (!animate) {
      void thumb.offsetWidth;
      thumb.style.transition = "";
    }
  }

  function primeThumb(toggle) {
    var buttons = toggle.querySelectorAll(".work-view-toggle__btn");
    if (buttons.length < 2) return;

    var from = null;
    try {
      from = sessionStorage.getItem(FROM_KEY);
      sessionStorage.removeItem(FROM_KEY);
    } catch (_) {}

    var toView = currentView();
    var toBtn = toView === "list" ? buttons[1] : buttons[0];
    var fromBtn =
      from === "list" ? buttons[1] : from === "desk" ? buttons[0] : null;

    requestAnimationFrame(function () {
      if (!reduceMotion && fromBtn && from && from !== toView) {
        positionThumb(toggle, fromBtn, false);
        requestAnimationFrame(function () {
          positionThumb(toggle, toBtn, true);
        });
      } else {
        positionThumb(toggle, toBtn, false);
      }
    });
  }

  function rememberFromView() {
    try {
      sessionStorage.setItem(FROM_KEY, currentView());
    } catch (_) {}
  }

  function buildToggle(extraClass) {
    var toggle = document.createElement("div");
    toggle.className =
      "work-view-toggle" + (extraClass ? " " + extraClass : "");
    toggle.setAttribute("role", "group");
    toggle.setAttribute("aria-label", "Work view");

    var thumb = document.createElement("span");
    thumb.className = "work-view-toggle__thumb";
    thumb.setAttribute("aria-hidden", "true");
    toggle.appendChild(thumb);

    var desk = document.createElement("a");
    desk.className = "work-view-toggle__btn";
    desk.href = "/work/";
    desk.setAttribute("aria-label", "Desk view");
    desk.title = "Desk";
    desk.innerHTML = GRID_ICON;
    if (isDesk) desk.setAttribute("aria-current", "page");

    var list = document.createElement("a");
    list.className = "work-view-toggle__btn";
    list.href = "/work/list/";
    list.setAttribute("aria-label", "List view");
    list.title = "List";
    list.innerHTML = LIST_ICON;
    if (isList) list.setAttribute("aria-current", "page");

    bindMorphNav(desk, "/work/", "list-to-desk");
    bindMorphNav(list, "/work/list/", "desk-to-list");

    toggle.appendChild(desk);
    toggle.appendChild(list);
    return toggle;
  }

  function bindMorphNav(anchor, href, dir) {
    anchor.addEventListener("click", function (event) {
      if (anchor.getAttribute("aria-current") === "page") {
        event.preventDefault();
        return;
      }
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      rememberFromView();
      var morph = window.krethWorkViewMorph;
      if (!morph || typeof morph.go !== "function") return;
      if (morph.go(href, dir)) event.preventDefault();
    });
  }

  function clearOrphans() {
    document.querySelectorAll(".work-view-toggle").forEach(function (el) {
      el.remove();
    });
    document.querySelectorAll(".top-nav__item-wrap--work-views").forEach(function (el) {
      el.classList.remove("top-nav__item-wrap--work-views");
    });
  }

  function revealToggle(toggle) {
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        toggle.classList.add("is-in");
        primeThumb(toggle);
      });
    });
  }

  function mount() {
    var wrap = document.querySelector('[data-nav-preview="work"]');
    if (!wrap) return false;

    clearOrphans();

    wrap.classList.add("top-nav__item-wrap--work-views");

    var navToggle = buildToggle("work-view-toggle--nav");
    var item = wrap.querySelector(":scope > .top-nav__item");
    // Inside the Work wrap so one pill expands — no sibling chrome jump.
    if (item && item.nextSibling) {
      wrap.insertBefore(navToggle, item.nextSibling);
    } else if (item) {
      wrap.appendChild(navToggle);
    } else {
      wrap.insertBefore(navToggle, wrap.firstChild);
    }
    revealToggle(navToggle);

    var mobile = buildToggle("work-view-toggle--mobile");
    document.body.appendChild(mobile);
    primeThumb(mobile);
    return true;
  }

  function tryMount() {
    if (mount()) return true;
    var tries = 0;
    var timer = window.setInterval(function () {
      tries += 1;
      if (mount() || tries > 80) window.clearInterval(timer);
    }, 50);
    return false;
  }

  function watchChrome() {
    if (tryMount()) return;
    var root = document.getElementById("chrome-top") || document.body;
    if (!root || typeof MutationObserver !== "function") return;
    var observer = new MutationObserver(function () {
      if (mount()) observer.disconnect();
    });
    observer.observe(root, { childList: true, subtree: true });
    window.setTimeout(function () {
      observer.disconnect();
    }, 8000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", watchChrome);
  } else {
    watchChrome();
  }
})();
