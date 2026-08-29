// Admin editing for book detail pages.
// Injected by scripts/edit-server.mjs — never referenced from files on disk.
//
// Adds an "Admin Access" link to the sidebar meta links. Toggling it on a
// book page makes status / verdict / read-type badge clickable, metadata and
// lead text editable, and Notes.md / Highlights.md panels editable. Save
// writes to data/books.json and regenerates the page HTML via POST /api/save-book.
(() => {
  "use strict";

  const ADMIN_KEY = "kreth-admin-access";
  const main = document.querySelector("main.book-detail");

  const READ_TYPE = {
    entertaining: { label: "Entertaining", tone: "orange" },
    educational: { label: "Educational", tone: "purple" },
    "must-read": { label: "Must Read", tone: "gold" },
  };

  const READ_TYPE_EMOJI = {
    entertaining: "🍿",
    educational: "🎓",
    "must-read": "⭐",
  };

  const READ_TYPE_ORDER = ["entertaining", "educational", "must-read"];

  function readTypeBadgeInner(key) {
    return READ_TYPE_EMOJI[key] + " " + READ_TYPE[key].label;
  }

  const META_KEYS = ["author", "published", "pages"];

  function isAdmin() {
    try {
      return sessionStorage.getItem(ADMIN_KEY) === "1";
    } catch (_) {
      return false;
    }
  }

  function setAdmin(on) {
    try {
      if (on) sessionStorage.setItem(ADMIN_KEY, "1");
      else sessionStorage.removeItem(ADMIN_KEY);
    } catch (_) {}
  }

  // ---------------------------------------------------------------------
  // Sidebar link (sidebar is injected async by layout.js — poll for it)
  // ---------------------------------------------------------------------
  let adminLink = null;

  function ensureAdminLink() {
    const nav = document.querySelector(".sidebar__meta-links");
    if (!nav || nav.querySelector("[data-ed-admin]")) return !!nav;
    adminLink = document.createElement("a");
    adminLink.href = "#";
    adminLink.setAttribute("data-ed-admin", "");
    adminLink.textContent = isAdmin() ? "Exit Admin" : "Admin Access";
    adminLink.addEventListener("click", (e) => {
      e.preventDefault();
      const on = !isAdmin();
      setAdmin(on);
      adminLink.textContent = on ? "Exit Admin" : "Admin Access";
      if (main) setEditing(on);
    });
    nav.appendChild(adminLink);
    return true;
  }

  const linkPoll = setInterval(() => {
    if (ensureAdminLink()) clearInterval(linkPoll);
  }, 200);
  setTimeout(() => clearInterval(linkPoll), 10000);

  if (!main) return;

  // ---------------------------------------------------------------------
  // Book edit mode
  // ---------------------------------------------------------------------
  const slug =
    main.getAttribute("data-book-slug") ||
    (location.pathname.match(/\/books\/([\w-]+)\/?/) || [])[1];

  const segGroups = Array.from(
    main.querySelectorAll(".exp-stage__controls .exp-seg--static")
  );
  const badge = main.querySelector(".book-read-badge");
  const panels = Array.from(main.querySelectorAll("[data-panel]"));
  const leadEl = main.querySelector(".exp-title__lead");
  const metaEls = META_KEYS.map((key) => {
    const row = main.querySelector('.idx-list [data-idx="' + key + '"]');
    return row ? row.querySelector("span:last-child") : null;
  }).filter(Boolean);

  if (badge && !badge.dataset.key) {
    const label = badge.textContent.trim().toLowerCase();
    badge.dataset.key =
      label === "entertaining"
        ? "entertaining"
        : label === "must read"
          ? "must-read"
          : "educational";
  }

  let editing = false;
  let dirty = false;

  const pill = document.createElement("div");
  pill.className = "ed-ui";
  pill.innerHTML = `
    <div class="ed-pill" hidden>
      <span class="ed-pill__hint">Admin</span>
      <button type="button" class="ed-pill__btn ed-pill__btn--save" data-ed-book-save>Save</button>
    </div>`;
  document.body.appendChild(pill);
  const pillEl = pill.querySelector(".ed-pill");
  const saveBtn = pill.querySelector("[data-ed-book-save]");

  function markDirty() {
    dirty = true;
    saveBtn.classList.add("ed-pill__btn--dirty");
  }

  function toast(msg, kind) {
    let toaster = document.querySelector(".ed-toaster");
    if (!toaster) {
      toaster = document.createElement("div");
      toaster.className = "ed-toaster ed-ui";
      document.body.appendChild(toaster);
    }
    const t = document.createElement("div");
    t.className = "ed-toast";
    if (kind && kind !== "default") t.dataset.kind = kind;
    t.textContent = msg;
    toaster.appendChild(t);
    requestAnimationFrame(() => t.setAttribute("data-on", "true"));
    setTimeout(() => {
      t.removeAttribute("data-on");
      setTimeout(() => t.remove(), 300);
    }, 2600);
  }

  function countBlocks(text) {
    let count = 0;
    let inBlock = false;
    String(text || "")
      .split("\n")
      .forEach((line) => {
        const t = line.trim();
        if (!t || t.startsWith("##") || t === "No notes yet." || t === "No highlights yet.") {
          inBlock = false;
          return;
        }
        if (/^\d+\.\s/.test(t)) {
          count += 1;
          inBlock = false;
          return;
        }
        if (!inBlock) {
          count += 1;
          inBlock = true;
        }
      });
    return count;
  }

  function updateIdxRow(name, value, bracket) {
    const row = main.querySelector('.idx-list [data-idx="' + name + '"]');
    if (!row) return;
    const val = row.querySelector("span:last-child");
    if (val) val.textContent = bracket ? "[ " + value + " ]" : String(value);
  }

  function refreshCounts() {
    const notes = panels.find((p) => p.dataset.panel === "notes");
    const highlights = panels.find((p) => p.dataset.panel === "highlights");
    const n = countBlocks(notes && notes.textContent);
    const h = countBlocks(highlights && highlights.textContent);
    updateIdxRow("notes", n);
    updateIdxRow("highlights", h);
    updateIdxRow("total", n + h);
  }

  function onSegClick(e) {
    if (!editing) return;
    const btn = e.target.closest(".exp-seg__btn");
    if (!btn) return;
    const group = btn.closest(".exp-seg--static");
    if (!group) return;
    group.querySelectorAll(".exp-seg__btn").forEach((b) => b.removeAttribute("data-active"));
    btn.setAttribute("data-active", "true");
    const groupLabel = group.getAttribute("aria-label");
    if (groupLabel === "Reading status") {
      updateIdxRow("status", btn.textContent.trim().toLowerCase(), true);
    } else if (groupLabel === "Verdict") {
      updateIdxRow("verdict", btn.textContent.trim().toLowerCase(), true);
    }
    markDirty();
  }

  function onBadgeClick() {
    if (!editing || !badge) return;
    const current = badge.dataset.key || "educational";
    const i = READ_TYPE_ORDER.indexOf(current);
    const next = READ_TYPE_ORDER[(i + 1) % READ_TYPE_ORDER.length];
    badge.dataset.key = next;
    badge.setAttribute("data-tone", READ_TYPE[next].tone);
    badge.innerHTML = readTypeBadgeInner(next);
    markDirty();
  }

  function setEditable(els, on) {
    els.forEach((el) => {
      if (!el) return;
      if (on) el.setAttribute("contenteditable", "plaintext-only");
      else el.removeAttribute("contenteditable");
    });
  }

  function setEditing(on) {
    editing = on;
    document.body.classList.toggle("ed-book-admin", on);
    pillEl.hidden = !on;
    setEditable(panels, on);
    setEditable([leadEl, ...metaEls], on);
    if (badge) badge.style.pointerEvents = on ? "auto" : "";
  }

  segGroups.forEach((g) => g.addEventListener("click", onSegClick));
  if (badge) badge.addEventListener("click", onBadgeClick);

  panels.forEach((p) =>
    p.addEventListener("input", () => {
      if (!editing) return;
      markDirty();
      refreshCounts();
    })
  );

  [leadEl, ...metaEls].forEach((el) => {
    if (!el) return;
    el.addEventListener("input", () => {
      if (!editing) return;
      markDirty();
    });
  });

  function activeKey(groupLabel) {
    const group = segGroups.find((g) => g.getAttribute("aria-label") === groupLabel);
    const btn = group && group.querySelector("[data-active=\"true\"]");
    return btn && btn.dataset.key ? btn.dataset.key : null;
  }

  function metaValue(key) {
    const row = main.querySelector('.idx-list [data-idx="' + key + '"]');
    const val = row && row.querySelector("span:last-child");
    return val ? val.textContent.trim() : null;
  }

  saveBtn.addEventListener("click", async () => {
    const notes = panels.find((p) => p.dataset.panel === "notes");
    const highlights = panels.find((p) => p.dataset.panel === "highlights");
    const payload = {
      slug,
      status: activeKey("Reading status"),
      verdict: activeKey("Verdict"),
      readType: badge ? badge.dataset.key : null,
      lead: leadEl ? leadEl.textContent.trim() : null,
      author: metaValue("author"),
      published: metaValue("published"),
      pages: metaValue("pages"),
      notes: notes ? notes.textContent : null,
      highlights: highlights ? highlights.textContent : null,
    };
    try {
      const res = await fetch("/api/save-book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || res.statusText);
      dirty = false;
      saveBtn.classList.remove("ed-pill__btn--dirty");
      refreshCounts();
      toast("Saved " + data.slug, "success");
    } catch (err) {
      toast("Save failed: " + err.message, "error");
    }
  });

  window.addEventListener("beforeunload", (e) => {
    if (!dirty) return;
    e.preventDefault();
    e.returnValue = "";
  });

  if (isAdmin()) setEditing(true);
})();
