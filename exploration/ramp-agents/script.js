const PROMPT =
  "Set up Ramp for my agents: install the Ramp CLI, authenticate, and configure spend controls with per-agent budgets and virtual cards.";

const THEME_KEY = "ramp-agents-exploration-theme";

function initThemeToggle() {
  const root = document.documentElement;
  const toggle = document.querySelector("[data-theme-toggle]");
  const saved = localStorage.getItem(THEME_KEY);

  if (saved === "dark" || saved === "light") {
    root.dataset.theme = saved;
  }

  toggle?.addEventListener("click", () => {
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    localStorage.setItem(THEME_KEY, next);
  });
}

function initCopyButtons() {
  const defaultLabel = "Setup with one prompt";

  document.querySelectorAll("[data-copy-prompt]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(PROMPT);
        const textNode = [...button.childNodes].find((node) => node.nodeType === Node.TEXT_NODE);
        if (textNode) textNode.textContent = "Copied!";
        window.setTimeout(() => {
          if (textNode) textNode.textContent = defaultLabel;
        }, 1600);
      } catch {
        window.prompt("Copy this prompt:", PROMPT);
      }
    });
  });
}

function initSectionNav() {
  const nav = document.querySelector("[data-section-nav]");
  const links = [...document.querySelectorAll(".section-nav__link")];
  const sections = [...document.querySelectorAll("[data-section]")];

  if (!nav || !sections.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const id = entry.target.id;
        links.forEach((link) => {
          link.classList.toggle("is-active", link.getAttribute("href") === `#${id}`);
        });
      });
    },
    { rootMargin: "-40% 0px -45% 0px", threshold: 0 }
  );

  sections.forEach((section) => observer.observe(section));

  const stickyObserver = new IntersectionObserver(
    ([entry]) => {
      nav.classList.toggle("is-stuck", !entry.isIntersecting);
    },
    { threshold: 1 }
  );

  const sentinel = document.querySelector(".hero");
  if (sentinel) stickyObserver.observe(sentinel);
}

initThemeToggle();
initCopyButtons();
initSectionNav();
