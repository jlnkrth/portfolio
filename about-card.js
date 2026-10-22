// Fade overlay for the scrollable About card: hide when content fits
// or the reader has reached the end.
(function () {
  var card = document.querySelector(".about-page__card");
  if (!card) return;

  function syncFade() {
    var overflow = card.scrollHeight - card.clientHeight > 1;
    var atEnd =
      !overflow ||
      card.scrollTop + card.clientHeight >= card.scrollHeight - 2;
    card.classList.toggle("is-scrollable", overflow);
    card.classList.toggle("is-scrolled-end", atEnd);
  }

  card.addEventListener("scroll", syncFade, { passive: true });
  window.addEventListener("resize", syncFade);
  if (typeof ResizeObserver !== "undefined") {
    new ResizeObserver(syncFade).observe(card);
  }
  syncFade();
})();
