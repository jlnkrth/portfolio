// Renders collection grids from data/collections.json
(function () {
  var grid = document.querySelector("[data-collection]");
  if (!grid) return;

  var key = grid.getAttribute("data-collection");
  var kind = grid.getAttribute("data-collection-kind") || key;

  fetch("/data/collections.json")
    .then(function (r) {
      return r.json();
    })
    .then(function (data) {
      var col = data[key];
      if (!col || !col.items) return;

      var previewKind = col.previewKind || kind;
      grid.className = "collection-grid collection-grid--" + previewKind;
      grid.innerHTML = "";

      col.items.forEach(function (item) {
        var card = document.createElement("a");
        card.className = "collection-card collection-card--" + previewKind;
        card.href = item.href;
        card.id = item.slug;
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
          img.loading = "lazy";
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
        grid.appendChild(card);
      });
    })
    .catch(function () {
      grid.innerHTML = '<p class="muted">Could not load collection.</p>';
    });
})();
