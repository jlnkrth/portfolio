// Renders collection grids from data/collections.json
(function () {
  var grid = document.querySelector("[data-collection]");
  if (!grid) return;

  var key = grid.getAttribute("data-collection");
  var kind = grid.getAttribute("data-collection-kind") || key;
  var reduceMotion =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function markLoaded(img) {
    img.classList.add("is-loaded");
  }

  function bindImageLoad(img) {
    if (!img) return;
    if (img.complete && img.naturalWidth > 0) {
      markLoaded(img);
      return;
    }
    img.addEventListener("load", function onLoad() {
      img.removeEventListener("load", onLoad);
      markLoaded(img);
    });
    img.addEventListener("error", function onError() {
      img.removeEventListener("error", onError);
      markLoaded(img);
    });
  }

  function revealCards(cards) {
    if (reduceMotion) {
      cards.forEach(function (card) {
        card.classList.remove("is-pending");
        card.classList.add("is-in");
      });
      return;
    }

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        cards.forEach(function (card) {
          card.classList.remove("is-pending");
          card.classList.add("is-entering");
          card.addEventListener(
            "transitionend",
            function onEnd(event) {
              if (event.target !== card) return;
              if (event.propertyName !== "opacity") return;
              card.classList.remove("is-entering");
              card.classList.add("is-in");
              card.style.removeProperty("--enter-delay");
              card.removeEventListener("transitionend", onEnd);
            }
          );
        });
      });
    });
  }

  function featuredForReveal() {
    if (key !== "books") return null;
    var featured = document.querySelector(".book-featured");
    if (!featured) return null;
    bindImageLoad(featured.querySelector(".book-featured__cover"));
    if (reduceMotion) {
      featured.classList.remove("is-pending");
      featured.classList.add("is-in");
      return null;
    }
    featured.classList.add("is-pending");
    featured.style.setProperty("--enter-delay", "0ms");
    return featured;
  }

  fetch("/data/collections.json")
    .then(function (r) {
      return r.json();
    })
    .then(function (data) {
      var col = data[key];
      if (!col || !col.items) {
        var orphan = featuredForReveal();
        if (orphan) revealCards([orphan]);
        return;
      }

      var previewKind = col.previewKind || kind;
      grid.className = "collection-grid collection-grid--" + previewKind;
      grid.innerHTML = "";

      var eagerCount = previewKind === "book" ? 15 : 8;
      var staggerCap = previewKind === "book" ? 18 : 12;
      var staggerOffset = key === "books" ? 1 : 0;
      var fragment = document.createDocumentFragment();
      var cards = [];
      var featured = featuredForReveal();
      if (featured) cards.push(featured);

      col.items.forEach(function (item, index) {
        var card = document.createElement("a");
        card.className =
          "collection-card collection-card--" +
          previewKind +
          (reduceMotion ? "" : " is-pending");
        card.href = item.href;
        card.id = item.slug;
        if (!reduceMotion) {
          card.style.setProperty(
            "--enter-delay",
            Math.min(index + staggerOffset, staggerCap) * 28 + "ms"
          );
        }
        if (item.external || (item.href && item.href.startsWith("http"))) {
          card.target = "_blank";
          card.rel = "noreferrer";
        }

        var media = document.createElement("div");
        media.className = "collection-card__media";

        if (item.image) {
          var img = document.createElement("img");
          img.src = item.image;
          img.alt = item.title;
          img.decoding = "async";
          if (index < eagerCount) {
            img.loading = "eager";
            if (index < 5) img.fetchPriority = "high";
          } else {
            img.loading = "lazy";
          }
          bindImageLoad(img);
          media.appendChild(img);
        } else if (item.confidential) {
          media.innerHTML =
            '<span class="collection-card__placeholder">Confidential</span>';
        } else {
          media.innerHTML =
            '<span class="collection-card__placeholder">' +
            (item.client || item.title).charAt(0) +
            "</span>";
        }

        var body = document.createElement("div");
        body.className = "collection-card__body";
        var title = document.createElement("span");
        title.className = "collection-card__title";
        title.textContent = item.client || item.title;
        body.appendChild(title);

        if (item.client && item.title && item.client !== item.title) {
          var sub = document.createElement("span");
          sub.className = "collection-card__subtitle muted";
          sub.textContent = item.title;
          body.appendChild(sub);
        }

        card.appendChild(media);
        card.appendChild(body);
        fragment.appendChild(card);
        cards.push(card);
      });

      grid.appendChild(fragment);
      revealCards(cards);
    })
    .catch(function () {
      grid.innerHTML = '<p class="muted">Could not load collection.</p>';
      var featured = featuredForReveal();
      if (featured) revealCards([featured]);
    });
})();
