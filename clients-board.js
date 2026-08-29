// Clients sticker board — shuffled logos scattered like stickers on a table.
// Each sticker is draggable; a real drag suppresses the link click.
(function () {
  var board = document.querySelector("[data-sticker-board]");
  if (!board) return;

  var DRAG_THRESHOLD = 6; // px before a press counts as a drag
  var zCounter = 10;
  var stickers = [];

  // Fit the board to the remaining viewport height so the page never scrolls.
  function fitBoard() {
    var top = board.getBoundingClientRect().top + window.scrollY;
    var rootEl = board.closest(".root");
    var rootPadBottom = rootEl
      ? parseFloat(getComputedStyle(rootEl).paddingBottom) || 0
      : 48;
    var h = window.innerHeight - top - rootPadBottom;
    board.style.height = Math.max(h, 320) + "px";
  }

  fitBoard();
  window.addEventListener("resize", function () {
    fitBoard();
    if (stickers.length) scatter(stickers);
  });

  fetch("/data/collections.json")
    .then(function (r) {
      return r.json();
    })
    .then(function (data) {
      var col = data.clients;
      if (!col || !col.items) return;
      var items = shuffle(col.items.slice());
      layoutStickers(items);
    })
    .catch(function () {
      board.innerHTML = '<p class="muted">Could not load clients.</p>';
    });

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  function layoutStickers(items) {
    board.innerHTML = "";
    fitBoard();

    stickers = items.map(function (item) {
      var sticker = document.createElement("a");
      sticker.className = "sticker";
      sticker.href = item.href;
      sticker.setAttribute("aria-label", item.title);
      if (item.external || (item.href && item.href.indexOf("http") === 0)) {
        sticker.target = "_blank";
        sticker.rel = "noreferrer";
      }

      if (item.image) {
        var img = document.createElement("img");
        img.src = item.image;
        img.alt = item.title;
        img.draggable = false;
        sticker.appendChild(img);
      } else {
        var ph = document.createElement("span");
        ph.className = "sticker__placeholder";
        ph.textContent = (item.title || "?").charAt(0);
        sticker.appendChild(ph);
      }

      sticker.style.setProperty(
        "--rot",
        ((Math.random() * 2 - 1) * 14).toFixed(1) + "deg"
      );
      makeDraggable(sticker);
      board.appendChild(sticker);
      return sticker;
    });

    // Position after append so the board and stickers have real sizes.
    requestAnimationFrame(function () {
      fitBoard();
      scatter(stickers);
    });
  }

  function scatter(list) {
    var boardRect = board.getBoundingClientRect();
    if (boardRect.width < 40 || boardRect.height < 40) return;

    var count = list.length;
    var cols = Math.max(
      1,
      Math.ceil(Math.sqrt((count * boardRect.width) / boardRect.height))
    );
    var rows = Math.ceil(count / cols);

    list.forEach(function (sticker, i) {
      var w = sticker.offsetWidth;
      var h = sticker.offsetHeight;
      var pad = 12;

      // Jittered grid keeps stickers spread out across the full board.
      var cellW = boardRect.width / cols;
      var cellH = boardRect.height / rows;
      var col = i % cols;
      var row = Math.floor(i / cols);
      var x = col * cellW + Math.random() * Math.max(cellW - w, 0);
      var y = row * cellH + Math.random() * Math.max(cellH - h, 0);

      x = clamp(x, pad, boardRect.width - w - pad);
      y = clamp(y, pad, boardRect.height - h - pad);

      sticker.style.left = (x / boardRect.width) * 100 + "%";
      sticker.style.top = (y / boardRect.height) * 100 + "%";
    });
  }

  function makeDraggable(sticker) {
    var dragging = false;
    var moved = false;
    var startX = 0;
    var startY = 0;
    var startLeft = 0;
    var startTop = 0;

    sticker.addEventListener("pointerdown", function (e) {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      dragging = true;
      moved = false;
      startX = e.clientX;
      startY = e.clientY;
      var rect = sticker.getBoundingClientRect();
      var boardRect = board.getBoundingClientRect();
      startLeft = rect.left - boardRect.left;
      startTop = rect.top - boardRect.top;
      sticker.setPointerCapture(e.pointerId);
      sticker.style.zIndex = ++zCounter;
    });

    sticker.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      var dx = e.clientX - startX;
      var dy = e.clientY - startY;
      if (!moved && Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) {
        return;
      }
      if (!moved) {
        moved = true;
        sticker.classList.add("is-dragging");
      }
      e.preventDefault();

      var boardRect = board.getBoundingClientRect();
      var w = sticker.offsetWidth;
      var h = sticker.offsetHeight;
      var left = clamp(startLeft + dx, -w * 0.3, boardRect.width - w * 0.7);
      var top = clamp(startTop + dy, -h * 0.2, boardRect.height - h * 0.8);

      sticker.style.left = (left / boardRect.width) * 100 + "%";
      sticker.style.top = (top / boardRect.height) * 100 + "%";
    });

    function endDrag(e) {
      if (!dragging) return;
      dragging = false;
      sticker.classList.remove("is-dragging");
      if (sticker.hasPointerCapture && sticker.hasPointerCapture(e.pointerId)) {
        sticker.releasePointerCapture(e.pointerId);
      }
    }

    sticker.addEventListener("pointerup", endDrag);
    sticker.addEventListener("pointercancel", endDrag);

    // A drag should not open the link.
    sticker.addEventListener("click", function (e) {
      if (moved) {
        e.preventDefault();
        e.stopPropagation();
      }
    });
  }

  function clamp(v, min, max) {
    return Math.min(Math.max(v, min), max);
  }
})();
