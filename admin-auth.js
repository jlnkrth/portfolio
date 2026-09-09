// Admin entry helpers for Cloudflare Access.
// Public /admin/ sends you to admin.kreth.work (Access + Google).
// Local edit-server still uses sessionStorage for UI-only admin mode.
(function () {
  "use strict";

  var ADMIN_KEY = "kreth-admin-access";
  var LOGIN_PATH = "/admin/";
  var ADMIN_HOST = "https://admin.kreth.work";
  var ADMIN_LIBRARY = ADMIN_HOST + "/";

  function isLoginPage() {
    return /\/admin\/?$/.test(location.pathname.replace(/index\.html$/, ""));
  }

  function isProtectedAdminHost() {
    return location.hostname === "admin.kreth.work";
  }

  function isAdmin() {
    if (isProtectedAdminHost()) return true;
    try {
      return sessionStorage.getItem(ADMIN_KEY) === "1";
    } catch (_) {
      return false;
    }
  }

  function setAdmin(on) {
    try {
      if (on) sessionStorage.setItem(ADMIN_KEY, "1");
      else sessionStorage.removeItem(ADMIN_KEY);
    } catch (_) {}
    document.body.classList.toggle("ed-book-admin", on);
    var nav = document.querySelector(".sidebar__meta-links");
    if (nav) nav.classList.toggle("sidebar__meta-links--admin", on);
    syncLoginButtons();
    try {
      window.dispatchEvent(
        new CustomEvent("kreth-admin-change", { detail: { admin: on } })
      );
    } catch (_) {}
  }

  function syncLoginButtons() {
    var on = isAdmin();
    document.querySelectorAll("[data-admin-login]").forEach(function (btn) {
      btn.hidden = false;
      btn.textContent = on ? "Exit Admin" : "Admin Area";
      btn.setAttribute("aria-label", on ? "Log out of admin" : "Open admin area");
      if (btn.tagName === "A") {
        if (on) btn.removeAttribute("href");
        else btn.setAttribute("href", LOGIN_PATH);
      }
    });
  }

  function openProtectedAdmin() {
    location.href = ADMIN_LIBRARY;
  }

  function bindLoginPage() {
    var googleBtn = document.querySelector("[data-admin-auth-google-btn]");
    if (!googleBtn) return;

    if (isProtectedAdminHost()) {
      location.replace("/");
      return;
    }

    googleBtn.addEventListener("click", function () {
      openProtectedAdmin();
    });
  }

  function onAdminLinkClick(e) {
    if (isAdmin()) {
      e.preventDefault();
      // On Access host, "logout" just leaves the protected hostname.
      if (isProtectedAdminHost()) {
        location.href = "https://kreth.work/";
        return;
      }
      setAdmin(false);
      return;
    }
    if (e.currentTarget.tagName !== "A") {
      e.preventDefault();
      location.href = LOGIN_PATH;
    }
  }

  function bindLoginButtons(root) {
    var scope = root || document;
    scope.querySelectorAll("[data-admin-login]").forEach(function (btn) {
      if (btn.dataset.adminLoginBound) return;
      btn.dataset.adminLoginBound = "1";
      btn.addEventListener("click", onAdminLinkClick);
    });
  }

  function rewriteAdminLinks() {
    document.querySelectorAll(".nowplaying__admin-link").forEach(function (a) {
      a.setAttribute("href", ADMIN_LIBRARY);
    });
    document.querySelectorAll('[href="/notes/_templates/"]').forEach(function (a) {
      if (a.hasAttribute("data-admin-only")) {
        a.setAttribute("href", ADMIN_HOST + "/notes/_templates/");
      }
    });
  }

  window.initAdminAuth = function () {
    if (isProtectedAdminHost()) {
      setAdmin(true);
    } else if (isAdmin()) {
      document.body.classList.add("ed-book-admin");
      var nav = document.querySelector(".sidebar__meta-links");
      if (nav) nav.classList.add("sidebar__meta-links--admin");
    }
    rewriteAdminLinks();
    bindLoginButtons(document);
    syncLoginButtons();
    if (isLoginPage()) bindLoginPage();
  };

  window.krethAdminAuth = {
    isAdmin: isAdmin,
    setAdmin: setAdmin,
    adminHost: ADMIN_HOST,
    googleConfigured: true,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      window.initAdminAuth();
    });
  } else {
    window.initAdminAuth();
  }
})();
