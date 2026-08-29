document.querySelectorAll("[data-tabs]").forEach(function (root) {
  var tabs = root.querySelectorAll(".exp-code__tab");
  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      tabs.forEach(function (t) {
        t.removeAttribute("data-active");
      });
      tab.setAttribute("data-active", "true");
      root.querySelectorAll("[data-panel]").forEach(function (panel) {
        panel.hidden = panel.dataset.panel !== tab.dataset.tab;
      });
    });
  });

  var copy = root.querySelector("[data-copy-active]");
  if (copy) {
    copy.addEventListener("click", async function () {
      var active = root.querySelector("[data-panel]:not([hidden])");
      if (!active) return;
      try {
        await navigator.clipboard.writeText(active.textContent);
        copy.textContent = "Copied";
        setTimeout(function () {
          copy.textContent = "Copy";
        }, 1200);
      } catch (_) {}
    });
  }
});
