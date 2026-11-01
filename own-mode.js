// Own-mode boot: enable body.own-mode and load the hover inspector.
// Only run when called from admin-auth (or directly) on admin / local own contexts.
// Never referenced from the public layout.js script list as own-inspector.js.
(function () {
  "use strict";

  var ADMIN_HOST = "admin.kreth.work";
  var ADMIN_KEY = "kreth-admin-access";
  var booted = false;

  function isAdminHost() {
    return location.hostname.toLowerCase() === ADMIN_HOST;
  }

  function isLocalHost() {
    var host = location.hostname.toLowerCase();
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host.endsWith(".workers.dev") ||
      host.endsWith(".workers-preview.dev")
    );
  }

  function hasOwnQuery() {
    try {
      var params = new URLSearchParams(location.search);
      return params.get("own") === "1" || params.get("admin") === "1";
    } catch (_) {
      return false;
    }
  }

  function hasAdminSession() {
    try {
      return sessionStorage.getItem(ADMIN_KEY) === "1";
    } catch (_) {
      return false;
    }
  }

  function shouldOwnMode() {
    if (isAdminHost()) return true;
    if (!isLocalHost()) return false;
    return hasOwnQuery() || hasAdminSession();
  }

  function loadStylesheet(href) {
    if (document.querySelector('link[href="' + href + '"]')) return;
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }

  function loadScript(src) {
    if (document.querySelector('script[src="' + src + '"]')) {
      return Promise.resolve();
    }
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function enableOwnMode() {
    if (booted) return;
    if (!shouldOwnMode()) return;
    booted = true;

    function apply() {
      if (!document.body) return;
      document.body.classList.add("own-mode");
      loadStylesheet("/own-inspector.css");
      loadScript("/own-inspector.js").catch(function () {});
    }

    if (document.body) apply();
    else document.addEventListener("DOMContentLoaded", apply);
  }

  window.krethOwnMode = {
    shouldOwnMode: shouldOwnMode,
    enable: enableOwnMode,
  };

  enableOwnMode();
})();
