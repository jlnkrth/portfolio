// Mobile-only journal chrome for note pages. Desktop is left alone.
(function () {
  var MQ = window.matchMedia("(max-width: 767px)");
  var MONTHS = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

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
    return month + " " + Number(parts[3]);
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

  function scrollRoot() {
    return (
      document.querySelector(".note-page .article-shell__scroll") ||
      document.querySelector(".note-page .layout > .root > .article") ||
      document.querySelector(".note-page .article")
    );
  }

  function bindFade(scroller) {
    if (!scroller || scroller.dataset.journalFadeBound) return;
    scroller.dataset.journalFadeBound = "1";

    function syncFade() {
      var overflow = scroller.scrollHeight - scroller.clientHeight > 1;
      var atEnd =
        !overflow ||
        scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2;
      scroller.classList.toggle("is-scrollable", overflow);
      scroller.classList.toggle("is-scrolled-end", atEnd);
    }

    scroller.addEventListener("scroll", syncFade, { passive: true });
    window.addEventListener("resize", syncFade);
    if (typeof ResizeObserver !== "undefined") {
      new ResizeObserver(syncFade).observe(scroller);
    }
    syncFade();
  }

  function enhance() {
    if (!MQ.matches || !isNoteArticle()) return;
    document.body.classList.add("note-page--journal");

    var root = document.querySelector(".layout > .root");
    var article = root && root.querySelector(".article");
    if (!root || !article) return;

    var srcTitle = article.querySelector("h1");
    if (srcTitle && !document.querySelector(".note-journal__head")) {
      var head = document.createElement("header");
      head.className = "note-journal__head";

      var dateEl = document.createElement("p");
      dateEl.className = "note-journal__date";
      dateEl.hidden = true;
      head.appendChild(dateEl);

      srcTitle.classList.add("note-journal__title");
      head.appendChild(srcTitle);
      root.insertBefore(head, root.firstChild);

      resolveDate(article, function (label) {
        if (!label || !dateEl.isConnected) return;
        dateEl.textContent = "";
        dateEl.appendChild(document.createTextNode(label));
        var dot = document.createElement("span");
        dot.className = "note-journal__dot";
        dot.setAttribute("aria-hidden", "true");
        dateEl.appendChild(dot);
        dateEl.hidden = false;
      });
    }

    var scroller = scrollRoot();
    if (scroller && !scroller.querySelector(".note-journal__fade")) {
      var fade = document.createElement("div");
      fade.className = "note-journal__fade";
      fade.setAttribute("aria-hidden", "true");
      scroller.appendChild(fade);
    }
    bindFade(scroller);
  }

  function teardown() {
    document.body.classList.remove("note-page--journal");
    var head = document.querySelector(".note-journal__head");
    var article = document.querySelector(".layout > .root .article");
    var title = head && head.querySelector("h1");
    if (head && title && article) {
      title.classList.remove("note-journal__title");
      article.insertBefore(title, article.firstChild);
    }
    if (head) head.remove();

    document.querySelectorAll(".note-journal__fade").forEach(function (fade) {
      fade.remove();
    });
  }

  function sync() {
    if (MQ.matches) enhance();
    else teardown();
  }

  if (!isNoteArticle()) return;

  sync();

  var root = document.querySelector(".layout > .root");
  if (root && typeof MutationObserver !== "undefined") {
    new MutationObserver(function () {
      if (MQ.matches) enhance();
    }).observe(root, { childList: true, subtree: true });
  }

  if (MQ.addEventListener) MQ.addEventListener("change", sync);
  else MQ.addListener(sync);
})();
