// Pick one profile photo per visit and apply it to every avatar.
(function () {
  var CACHE_KEY = "kreth-avatar";
  var AVATARS = ["/assets/avatar.avif", "/assets/avatar-twitter.jpg"];

  function pick() {
    try {
      var stored = sessionStorage.getItem(CACHE_KEY);
      if (stored && AVATARS.indexOf(stored) !== -1) return stored;
    } catch (_) {}
    var src = AVATARS[Math.floor(Math.random() * AVATARS.length)];
    try {
      sessionStorage.setItem(CACHE_KEY, src);
    } catch (_) {}
    return src;
  }

  function apply(root) {
    var src = pick();
    var scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll("[data-avatar]").forEach(function (img) {
      if (img.getAttribute("src") !== src) img.setAttribute("src", src);
    });
  }

  window.initAvatars = apply;
  apply(document);
})();
