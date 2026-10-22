// Mobile + desktop essay chrome for note pages (Tree-style).
(function () {
  var MONTHS = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  var BIT_COLORS = ["#c45b2d", "#d38a3a", "#8a6a4a", "#4f6b4a", "#6b5344"];

  function isNoteArticle() {
    return (
      document.body.classList.contains("note-page") &&
      !!document.querySelector(".layout > .root .article") &&
      !document.querySelector(".about-page, .project-page")
    );
  }

  function formatDate(iso) {
    if (!iso) return "";
    var parts = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!parts) return "";
    var month = MONTHS[Number(parts[2]) - 1];
    if (!month) return "";
    return month + " " + parts[1];
  }

  function resolveDate(article, done) {
    var time = article.querySelector("time[datetime]");
    if (time && time.getAttribute("datetime")) {
      done(formatDate(time.getAttribute("datetime")));
      return;
    }

    var path = location.pathname.replace(/index\.html$/, "");
    if (path.length > 1 && path.charAt(path.length - 1) !== "/") path += "/";

    fetch("/data/notes.json?v=2")
      .then(function (response) {
        if (!response.ok) throw new Error("notes");
        return response.json();
      })
      .then(function (data) {
        var items = (data && data.items) || [];
        var match = null;
        for (var i = 0; i < items.length; i++) {
          if (items[i].href === path) {
            match = items[i];
            break;
          }
        }
        done(match ? formatDate(match.date) : "");
      })
      .catch(function () {
        done("");
      });
  }

  function markSvg() {
    return (
      '<svg class="essay-mark__body" viewBox="0 0 72 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<rect x="22" y="38" width="28" height="30" rx="6" fill="#21201c"/>' +
      '<circle cx="36" cy="26" r="14" fill="#21201c"/>' +
      '<circle cx="31" cy="24" r="2.4" fill="#fcfcfc"/>' +
      '<circle cx="41" cy="24" r="2.4" fill="#fcfcfc"/>' +
      '<rect x="31" y="30" width="10" height="2" rx="1" fill="#fcfcfc"/>' +
      '<rect x="16" y="44" width="10" height="4" rx="2" fill="#21201c"/>' +
      '<rect x="46" y="44" width="10" height="4" rx="2" fill="#21201c"/>' +
      "</svg>"
    );
  }

  function spawnBits(layer, count, hover) {
    if (!layer) return;
    var bits = [];
    for (var i = 0; i < count; i++) {
      var el = document.createElement("span");
      el.className = "essay-bit" + (hover ? " essay-bit--hover" : "");
      el.style.setProperty("--x", 22 + Math.random() * 40 + "%");
      el.style.setProperty("--y", 12 + Math.random() * 28 + "px");
      el.style.setProperty("--drift-x", (Math.random() - 0.5) * (hover ? 46 : 36) + "px");
      el.style.setProperty("--pop-y", -6 - Math.random() * 10 + "px");
      el.style.setProperty("--fall-y", 36 + Math.random() * 28 + "px");
      el.style.setProperty("--spin", (Math.random() < 0.5 ? -1 : 1) * (180 + Math.random() * 360) + "deg");
      el.style.setProperty("--dur", hover ? "1.3s" : "1.1s");
      el.style.setProperty("--bit-color", BIT_COLORS[Math.floor(Math.random() * BIT_COLORS.length)]);
      layer.appendChild(el);
      bits.push(el);
    }
    window.setTimeout(function () {
      bits.forEach(function (bit) {
        if (bit.parentNode) bit.parentNode.removeChild(bit);
      });
    }, hover ? 1300 : 1100);
  }

  function bindMark(button) {
    if (!button || button.dataset.bound) return;
    button.dataset.bound = "1";
    var layer = button.querySelector(".essay-mark__bits");
    var pressedAt = 0;
    var bounceTimer = 0;
    var reduced =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function press() {
      pressedAt = Date.now();
      button.classList.add("is-pressed");
      button.classList.remove("is-bounce", "is-shake");
    }

    function release() {
      if (!pressedAt) return;
      var held = Date.now() - pressedAt;
      pressedAt = 0;
      button.classList.remove("is-pressed");
      if (reduced) return;
      var intensity = 0.3 + ((Math.max(50, Math.min(800, held)) - 50) / 750) * 1.2;
      button.style.setProperty("--bounce-intensity", String(intensity));
      button.classList.add("is-bounce");
      window.clearTimeout(bounceTimer);
      bounceTimer = window.setTimeout(function () {
        button.classList.remove("is-bounce");
      }, 600);
      spawnBits(layer, 3 + Math.floor(8 * intensity), false);
    }

    button.addEventListener("pointerdown", function (event) {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      press();
    });
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("mouseenter", function () {
      if (reduced || pressedAt) return;
      button.classList.add("is-shake");
      window.setTimeout(function () {
        button.classList.remove("is-shake");
      }, 600);
      spawnBits(layer, 6 + Math.floor(Math.random() * 3), true);
    });
    button.addEventListener("keydown", function (event) {
      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        press();
      }
    });
    button.addEventListener("keyup", function (event) {
      if (event.key === " " || event.key === "Enter") release();
    });
  }

  function ensureChrome(article) {
    var title = article.querySelector("h1");
    if (!title) return;

    title.classList.add("essay-title");

    if (!document.querySelector(".essay-crumb")) {
      var crumb = document.createElement("nav");
      crumb.className = "essay-crumb";
      crumb.setAttribute("aria-label", "Breadcrumb");
      crumb.innerHTML =
        '<a href="/">Home</a>' +
        '<svg class="essay-crumb__chevron" width="14" height="14" viewBox="0 0 12 12" fill="none" aria-hidden="true">' +
        '<path d="M4.5 3L7.5 6L4.5 9" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"></path>' +
        "</svg>" +
        '<a href="/notes/">Archive</a>' +
        '<svg class="essay-crumb__chevron" width="14" height="14" viewBox="0 0 12 12" fill="none" aria-hidden="true">' +
        '<path d="M4.5 3L7.5 6L4.5 9" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"></path>' +
        "</svg>" +
        '<span class="essay-crumb__here"></span>';
      var crumbTitle = title.textContent.replace(/\s+/g, " ").trim();
      crumb.querySelector(".essay-crumb__here").textContent =
        crumbTitle.length > 28 ? crumbTitle.slice(0, 25).trim() + "…" : crumbTitle;
      document.body.appendChild(crumb);
      window.requestAnimationFrame(function () {
        crumb.classList.add("is-ready");
      });
    }

    var dateLine = article.querySelector(".essay-date");
    if (!dateLine) {
      dateLine = document.createElement("p");
      dateLine.className = "essay-date";
      dateLine.hidden = true;
      title.insertAdjacentElement("afterend", dateLine);
    }
    if (dateLine.hidden) {
      resolveDate(article, function (label) {
        if (!label || !dateLine.isConnected) return;
        dateLine.textContent = label;
        dateLine.hidden = false;
      });
    }

    if (!article.querySelector(".essay-stage")) {
      var stage = document.createElement("div");
      stage.className = "essay-stage";
      var button = document.createElement("button");
      button.type = "button";
      button.className = "essay-mark";
      button.setAttribute("aria-label", "Press the stamp");
      button.innerHTML = markSvg() + '<span class="essay-mark__bits" aria-hidden="true"></span>';
      stage.appendChild(button);
      (dateLine || title).insertAdjacentElement("afterend", stage);
      bindMark(button);
    } else {
      bindMark(article.querySelector(".essay-mark"));
    }
  }

  function enhance() {
    if (!isNoteArticle()) return;
    document.body.classList.add("note-page--essay");
    document.body.classList.remove("note-page--journal");

    var article = document.querySelector(".layout > .root .article");
    if (!article) return;
    ensureChrome(article);
  }

  if (!isNoteArticle()) return;
  enhance();

  var root = document.querySelector(".layout > .root");
  if (root && typeof MutationObserver !== "undefined") {
    new MutationObserver(function () {
      enhance();
    }).observe(root, { childList: true, subtree: true });
  }
})();
