// Lightweight behavior for the component library. No dependencies.

// --- Copy to clipboard (install code + code blocks) ---
document.querySelectorAll("[data-copy-btn]").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const host = btn.closest("[data-copy]");
    const text = host ? host.getAttribute("data-copy") : "";
    try {
      await navigator.clipboard.writeText(text);
      toast("Copied to clipboard", "success");
    } catch {
      toast("Couldn't copy", "error");
    }
  });
});

document.querySelectorAll(".email-copy[data-copy]").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const text = btn.getAttribute("data-copy") || "";
    try {
      await navigator.clipboard.writeText(text);
      toast("Copied to clipboard", "success");
    } catch {
      toast("Couldn't copy", "error");
    }
  });
});

// --- Pill groups behave as single-select ---
document.querySelectorAll("[data-pill-group]").forEach((group) => {
  group.addEventListener("click", (e) => {
    const pill = e.target.closest(".pill");
    if (!pill) return;
    group
      .querySelectorAll(".pill")
      .forEach((p) => p.setAttribute("data-active", "false"));
    pill.setAttribute("data-active", "true");
  });
});

// --- Standalone pills (Other) toggle themselves ---
document.querySelectorAll(".pill-group:not([data-pill-group]) .pill").forEach((pill) => {
  pill.addEventListener("click", () => {
    const on = pill.getAttribute("data-active") === "true";
    pill.setAttribute("data-active", on ? "false" : "true");
  });
});

// --- Banner close ---
document.querySelectorAll("[data-banner-close]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const banner = btn.closest(".banner");
    if (banner) banner.style.display = "none";
  });
});

// --- Render-toast triggers ---
document.querySelectorAll("[data-render-toast]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const type = btn.getAttribute("data-render-toast") || "default";
    const msg =
      type === "success"
        ? "Event has been created"
        : type === "error"
        ? "Something went wrong"
        : "My first toast";
    toast(msg, type);
  });
});

// --- Waitlist CTA (inline email capture) ---
document.querySelectorAll("[data-waitlist]").forEach((form) => {
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const input = form.querySelector("input");
    if (input && !input.checkValidity()) {
      input.reportValidity();
      return;
    }
    toast("You're on the list", "success");
    form.reset();
  });
});

// --- Availability status is handled by the shared /availability.js ---

// --- Toggle switch (dqnamo-style) ---
document.querySelectorAll("[data-exp-toggle]").forEach((toggle) => {
  toggle.addEventListener("click", () => {
    const on = toggle.getAttribute("aria-checked") === "true";
    toggle.setAttribute("aria-checked", on ? "false" : "true");
  });
});

// --- Dynamic compact button (label swap + width transition) ---
document.querySelectorAll("[data-exp-dyn-btn]").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const label = btn.querySelector(".exp-dyn-btn__label");
    if (!label) return;
    const saved = label.textContent === "Saved";
    label.textContent = saved ? "Save" : "Saved";
    btn.style.width = `${btn.offsetWidth}px`;
    requestAnimationFrame(() => {
      btn.style.width = "";
    });
  });
});

// --- Minimal toast implementation ---
function toast(message, type = "default") {
  const toaster = document.getElementById("toaster");
  if (!toaster) return;

  const el = document.createElement("div");
  el.className = "toast";
  el.setAttribute("role", "status");

  const icons = {
    success:
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#30a46c" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
    error:
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#e5484d" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg>',
  };
  if (icons[type]) {
    const icon = document.createElement("span");
    icon.style.display = "flex";
    icon.style.flexShrink = "0";
    icon.innerHTML = icons[type];
    el.appendChild(icon);
  }

  const text = document.createElement("span");
  text.textContent = message;
  el.appendChild(text);

  toaster.appendChild(el);
  requestAnimationFrame(() => el.setAttribute("data-mounted", "true"));

  const remove = () => {
    el.setAttribute("data-removed", "true");
    el.addEventListener("transitionend", () => el.remove(), { once: true });
  };
  setTimeout(remove, 4000);
  el.addEventListener("click", remove);
}

// --- Mermaid architecture diagrams (Cursor plan style) ---
if (typeof mermaid !== "undefined") {
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    theme: "base",
    themeVariables: {
      darkMode: false,
      background: "#ffffff",
      primaryColor: "#f9f9f9",
      primaryTextColor: "#1a1a1a",
      primaryBorderColor: "#d4d4d4",
      secondaryColor: "#f4f4f4",
      tertiaryColor: "#efefef",
      lineColor: "#666666",
      textColor: "#1a1a1a",
      mainBkg: "#ffffff",
      actorBkg: "#ffffff",
      actorBorder: "#d4d4d4",
      actorTextColor: "#1a1a1a",
      actorLineColor: "#999999",
      signalColor: "#666666",
      signalTextColor: "#1a1a1a",
      labelBoxBkgColor: "#f9f9f9",
      labelBoxBorderColor: "#d4d4d4",
      labelTextColor: "#1a1a1a",
      loopTextColor: "#1a1a1a",
      noteBkgColor: "#f4f4f4",
      noteTextColor: "#1a1a1a",
      noteBorderColor: "#d4d4d4",
      activationBkgColor: "#efefef",
      activationBorderColor: "#d4d4d4",
      sequenceNumberColor: "#888888",
    },
    sequence: {
      diagramMarginX: 12,
      diagramMarginY: 8,
      actorMargin: 48,
      boxMargin: 8,
      boxTextMargin: 6,
      noteMargin: 8,
      messageMargin: 32,
      mirrorActors: false,
      useMaxWidth: false,
    },
  });

  mermaid.run({ querySelector: ".mermaid" }).catch((err) => {
    console.error("Mermaid render failed:", err);
  });
}
