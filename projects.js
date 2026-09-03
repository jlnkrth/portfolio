// Renders the Jakub-style open-source project grid from data/projects.json
(function () {
  var grids = document.querySelectorAll("[data-projects-grid]");
  if (!grids.length) return;

  fetch("/data/projects.json")
    .then(function (r) {
      return r.json();
    })
    .then(function (data) {
      var projects = (data && data.projects) || [];
      grids.forEach(function (grid) {
        grid.classList.add("project-grid");
        grid.innerHTML = "";
        var limit = parseInt(grid.getAttribute("data-projects-limit"), 10);
        var list =
          limit > 0 ? projects.slice(0, limit) : projects;
        list.forEach(function (project) {
          grid.appendChild(buildCard(project));
        });
      });
    })
    .catch(function () {
      grids.forEach(function (grid) {
        grid.innerHTML = '<p class="muted">Could not load projects.</p>';
      });
    });

  function buildCard(project) {
    var card = document.createElement("a");
    card.className = "project-card";
    card.href = project.href;
    card.setAttribute(
      "aria-label",
      "Visit " + project.title
    );

    var preview = document.createElement("div");
    preview.className = "project-card__preview";

    var mark = document.createElement("span");
    mark.className = "project-card__mark";
    mark.textContent = project.mark || "/" + project.slug;
    mark.setAttribute("aria-hidden", "true");
    preview.appendChild(mark);

    var body = document.createElement("div");
    body.className = "project-card__body";

    var desc = document.createElement("span");
    desc.className = "project-card__desc muted";
    desc.textContent = project.description;

    body.appendChild(desc);

    card.appendChild(preview);
    card.appendChild(body);
    return card;
  }
})();
