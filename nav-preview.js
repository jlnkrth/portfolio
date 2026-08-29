// Top nav fan-out previews (desktop hover / focus-within)
window.initNavCurrent = function initNavCurrent(root) {
  root = root || document;
  var scope = root.querySelector ? root : document;
  var path = window.location.pathname.replace(/\/+$/, "") || "/";
  scope.querySelectorAll(".top-nav__item[href]").forEach(function (link) {
    var href = link.getAttribute("href");
    if (!href || href.startsWith("http") || href.startsWith("mailto:")) return;
    var target = href.replace(/\/+$/, "") || "/";
    var isCurrent =
      path === target || (target !== "/" && path.startsWith(target + "/"));
    if (isCurrent) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });
};

window.initNavPreview = function initNavPreview() {
  fetch("/data/collections.json?v=7")
    .then(function (r) {
      return r.json();
    })
    .then(function (data) {
      function itemCount(col) {
        if (!col) return 0;
        if (Array.isArray(col.items)) return col.items.length;
        return col.count || 0;
      }

      document.querySelectorAll("[data-nav-count]").forEach(function (el) {
        var key = el.getAttribute("data-nav-count");
        var col = data[key];
        if (col) el.textContent = itemCount(col) + " items";
      });

      document.querySelectorAll("[data-nav-preview]").forEach(function (wrap) {
        var key = wrap.getAttribute("data-nav-preview");
        var col = data[key];
        if (!col) return;

        var fan = wrap.querySelector(".top-nav__fan");
        if (!fan) return;
        fan.innerHTML = "";
        fan.classList.add("top-nav__fan--" + (col.previewKind || key));

        col.items.slice(0, 3).forEach(function (item, i) {
          var card = document.createElement("a");
          card.className = "top-nav__preview-card";
          card.href = item.href;
          card.style.setProperty("--fan-index", i);
          card.setAttribute("aria-label", item.title);

          if (item.href && item.href.startsWith("http")) {
            card.target = "_blank";
            card.rel = "noreferrer";
          }

          if (item.image) {
            var img = document.createElement("img");
            img.src = item.image;
            img.alt = "";
            card.appendChild(img);
          } else {
            var ph = document.createElement("span");
            ph.className = "top-nav__preview-placeholder";
            ph.textContent = (item.client || item.title).charAt(0);
            card.appendChild(ph);
          }

          fan.appendChild(card);
        });
      });
    })
    .catch(function () {});
};

if (document.querySelector(".top-nav")) {
  window.initNavPreview();
}

if (document.querySelector(".top-nav__item")) {
  window.initNavCurrent();
}
