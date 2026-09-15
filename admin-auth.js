// Google admin login. Sitewide: Admin Area link + session.
// On /admin/: Google OAuth token client (popup) → session → components.
(function () {
  "use strict";

  var GOOGLE_CLIENT_ID =
    "949249017997-fsvb8661uadi3fq11acrmofnuud79gsg.apps.googleusercontent.com";
  var ALLOWED_EMAIL = "julian@karmastudio.co";
  var ALLOWED_HD = "karmastudio.co";
  var ADMIN_KEY = "kreth-admin-access";
  var GSI_SRC = "https://accounts.google.com/gsi/client";
  var LOGIN_PATH = "/admin/";
  var AFTER_LOGIN_PATH = "/components.html";

  var gsiReady = null;
  var tokenClient = null;
  var pageEls = null;

  function isLoginPage() {
    return /\/admin\/?$/.test(location.pathname.replace(/index\.html$/, ""));
  }

  function isAdmin() {
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
    rewriteAdminLinks();
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

  function rewriteAdminLinks() {
    var libraryHref = isAdmin() ? AFTER_LOGIN_PATH : LOGIN_PATH;
    document.querySelectorAll(".nowplaying__admin-link").forEach(function (a) {
      a.setAttribute("href", libraryHref);
    });
    document
      .querySelectorAll('[data-admin-only][href*="admin.kreth.work"]')
      .forEach(function (a) {
        a.setAttribute("href", "/notes/_templates/");
      });
  }

  function setError(msg) {
    if (!pageEls || !pageEls.error) return;
    pageEls.error.textContent = msg || "";
  }

  function loadGsi() {
    if (gsiReady) return gsiReady;
    gsiReady = new Promise(function (resolve, reject) {
      if (
        window.google &&
        window.google.accounts &&
        window.google.accounts.oauth2
      ) {
        resolve();
        return;
      }
      var existing = document.querySelector('script[src="' + GSI_SRC + '"]');
      if (existing) {
        existing.addEventListener("load", function () {
          resolve();
        });
        existing.addEventListener("error", function () {
          reject(new Error("Failed to load Google Identity Services"));
        });
        return;
      }
      var s = document.createElement("script");
      s.src = GSI_SRC;
      s.async = true;
      s.onload = function () {
        resolve();
      };
      s.onerror = function () {
        reject(new Error("Failed to load Google Identity Services"));
      };
      document.head.appendChild(s);
    });
    return gsiReady;
  }

  function acceptProfile(profile) {
    var email = String((profile && profile.email) || "").toLowerCase();
    var hd = String((profile && profile.hd) || "").toLowerCase();
    var verified =
      profile &&
      (profile.email_verified === true || profile.email_verified === "true");

    if (!verified) {
      setError("That Google account email is not verified.");
      return;
    }
    if (email !== ALLOWED_EMAIL || (hd && hd !== ALLOWED_HD)) {
      setError("This Google account isn't authorized.");
      return;
    }

    setAdmin(true);
    if (isLoginPage()) {
      location.href = AFTER_LOGIN_PATH;
    }
  }

  function onTokenResponse(tokenResponse) {
    if (!tokenResponse || tokenResponse.error) {
      if (tokenResponse && tokenResponse.error === "popup_closed_by_user") return;
      setError(
        (tokenResponse &&
          (tokenResponse.error_description || tokenResponse.error)) ||
          "Google sign-in failed."
      );
      return;
    }

    fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: "Bearer " + tokenResponse.access_token },
    })
      .then(function (res) {
        if (!res.ok) throw new Error("Could not verify Google account.");
        return res.json();
      })
      .then(acceptProfile)
      .catch(function (err) {
        setError(err.message || "Google sign-in failed.");
      });
  }

  function getTokenClient() {
    if (!GOOGLE_CLIENT_ID) {
      return Promise.reject(new Error("Google login is not configured yet."));
    }
    return loadGsi().then(function () {
      if (tokenClient) return tokenClient;
      tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: "openid email profile",
        hd: ALLOWED_HD,
        callback: onTokenResponse,
        error_callback: function (err) {
          if (
            err &&
            (err.type === "popup_closed" || err.type === "popup_failed_to_open")
          ) {
            if (err.type === "popup_failed_to_open") {
              setError("Allow popups for this site, then try again.");
            }
            return;
          }
          setError((err && err.message) || "Google sign-in was cancelled.");
        },
      });
      return tokenClient;
    });
  }

  function startGoogleSignIn() {
    setError("");
    if (!GOOGLE_CLIENT_ID) {
      setError("Google login is not configured yet.");
      return;
    }

    getTokenClient()
      .then(function (client) {
        client.requestAccessToken({ prompt: "select_account" });
      })
      .catch(function (err) {
        setError(err.message || "Google sign-in failed to load.");
      });
  }

  function bindLoginPage() {
    pageEls = {
      googleBtn: document.querySelector("[data-admin-auth-google-btn]"),
      error: document.querySelector("[data-admin-auth-error]"),
    };

    if (!pageEls.googleBtn) return;

    if (isAdmin()) {
      location.replace(AFTER_LOGIN_PATH);
      return;
    }

    pageEls.googleBtn.addEventListener("click", function () {
      startGoogleSignIn();
    });

    getTokenClient().catch(function () {});
  }

  function onAdminLinkClick(e) {
    if (isAdmin()) {
      e.preventDefault();
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

  window.initAdminAuth = function () {
    if (isAdmin()) {
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
    googleConfigured: Boolean(GOOGLE_CLIENT_ID),
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      window.initAdminAuth();
    });
  } else {
    window.initAdminAuth();
  }
})();
