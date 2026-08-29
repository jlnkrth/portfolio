// Notion-style local editor for kreth.work notes.
// Injected by scripts/edit-server.mjs — never referenced from files on disk.
(() => {
  "use strict";

  const article = document.querySelector("article.article");
  if (!article) return;

  // ---------------------------------------------------------------------
  // Dynamic components mutate their own DOM after load (Mermaid renders
  // SVG, sparklines fill in paths). Snapshot their original markup NOW,
  // synchronously, before those libraries run — we serialize from these
  // snapshots on save so rendered output never gets baked into the file.
  // ---------------------------------------------------------------------
  const ATOMIC_SEL = ".arch-diagram, .dq-sparkline, .dq-signature, .dq-trace, .md-block";
  const snapshots = new WeakMap();
  article.querySelectorAll(ATOMIC_SEL).forEach((el) => {
    snapshots.set(el, el.outerHTML);
  });

  const EDITABLE_SEL = [
    "p",
    "li",
    "h1",
    "h2",
    "h3",
    "h4",
    "figcaption",
    "blockquote",
    ".article-tldr__label",
    ".article-callout__label",
    ".article-protocol__label",
    ".article-takeaway__label",
    ".article-type",
    ".nav-label",
    ".nav-title",
    "pre > code",
    ".install-code > code",
    ".idx-command__code",
    ".idx-command__caption span",
    ".idx-list__row span",
    ".plan-table td",
    ".plan-table th",
  ].join(", ");

  const TEXT_BLOCK_TAGS = new Set(["P", "H1", "H2", "H3", "H4", "BLOCKQUOTE"]);

  const COPY_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';

  // ---------------------------------------------------------------------
  // Slash-menu component templates (markup mirrors components.html)
  // ---------------------------------------------------------------------
  const TEMPLATES = [
    { id: "paragraph", label: "Paragraph", hint: "Plain prose", html: "<p>Write something.</p>" },
    { id: "h2", label: "Heading", hint: "Section title (h2)", html: "<h2>Section title</h2>" },
    { id: "bullets", label: "Bullet list", hint: "Unordered list", html: "<ul>\n  <li>First item</li>\n  <li>Second item</li>\n</ul>" },
    { id: "numbers", label: "Numbered list", hint: "Ordered steps", html: "<ol>\n  <li>First step</li>\n  <li>Second step</li>\n</ol>" },
    {
      id: "code-block",
      label: "Code block",
      hint: "Multi-line, copyable",
      html: `<div class="code-block" data-copy="// code"><button class="copy-button" aria-label="Copy code" data-copy-btn>${COPY_SVG}</button><pre class="code-block__pre"><code>// code</code></pre></div>`,
    },
    {
      id: "protocol",
      label: "Protocol block",
      hint: "Labeled spec (article-protocol)",
      html: '<div class="article-protocol"><span class="article-protocol__label">Protocol name</span><pre><code>1. First step.\n2. Second step.</code></pre></div>',
    },
    {
      id: "tldr",
      label: "TL;DR",
      hint: "Summary box, max 3 bullets",
      html: '<aside class="article-tldr" aria-label="Summary"><span class="article-tldr__label">TL;DR</span><ul>\n  <li>First point.</li>\n  <li>Second point.</li>\n</ul></aside>',
    },
    {
      id: "callout-problem",
      label: "Callout — problem",
      hint: "Anti-pattern",
      html: '<aside class="article-callout article-callout--problem"><span class="article-callout__label">The problem</span><p>Describe the anti-pattern.</p></aside>',
    },
    {
      id: "callout-rule",
      label: "Callout — rule",
      hint: "Hard constraint",
      html: '<aside class="article-callout article-callout--rule"><span class="article-callout__label">Hard rule</span><p>State the non-negotiable.</p></aside>',
    },
    {
      id: "callout-approach",
      label: "Callout — approach",
      hint: "The bet",
      html: '<aside class="article-callout article-callout--approach"><span class="article-callout__label">The bet</span><p>State the approach in one sentence.</p></aside>',
    },
    {
      id: "takeaway",
      label: "Takeaway",
      hint: "Principle closing line",
      html: '<aside class="article-takeaway"><span class="article-takeaway__label">Takeaway</span><p>One sentence the reader can quote.</p></aside>',
    },
    {
      id: "banner",
      label: "Announcement banner",
      hint: "Linked CTA with close",
      html: '<div class="banner"><div class="banner__inner"><p style="margin: 0"><a href="#">Linked call-to-action</a> <span class="banner__muted">Optional subline.</span></p><button class="banner__close" aria-label="Close" data-banner-close><svg viewBox="0 0 24 24" fill="none" width="16" height="16"><path fill-rule="evenodd" clip-rule="evenodd" d="M4.11612 4.11612C4.60427 3.62796 5.39573 3.62796 5.88388 4.11612L12 10.2322L18.1161 4.11612C18.6043 3.62796 19.3957 3.62796 19.8839 4.11612C20.372 4.60427 20.372 5.39573 19.8839 5.88388L13.7678 12L19.8839 18.1161C20.372 18.6043 20.372 19.3957 19.8839 19.8839C19.3957 20.372 18.6043 20.372 18.1161 19.8839L12 13.7678L5.88388 19.8839C5.39573 20.372 4.60427 20.372 4.11612 19.8839C3.62796 19.3957 3.62796 18.6043 4.11612 18.1161L10.2322 12L4.11612 5.88388C3.62796 5.39573 3.62796 4.60427 4.11612 4.11612Z" fill="currentColor" /></svg></button></div></div>',
      needsLibrary: true,
    },
    {
      id: "install-code",
      label: "Install code",
      hint: "Single line, copyable",
      html: `<div class="install-code" data-copy="npm install package"><code>npm install package</code><button class="copy-button" aria-label="Copy code" data-copy-btn>${COPY_SVG}</button></div>`,
      needsLibrary: true,
    },
    {
      id: "command",
      label: "Command snippet",
      hint: "CLI with caption",
      html: `<div class="idx-command" data-copy="npx create-index@latest"><div class="idx-command__bar"><code class="idx-command__code"><span class="idx-command__prompt">npx</span> create-index@latest</code><button class="copy-button" aria-label="Copy code" data-copy-btn>${COPY_SVG}</button></div><div class="idx-command__caption"><span>Caption — when to run this.</span></div></div>`,
      needsLibrary: true,
    },
    {
      id: "idx-list",
      label: "Index list",
      hint: "Monospace rows",
      html: '<div class="idx-list"><a class="idx-list__row" href="#"><span>first-item</span><span class="idx-list__count">1</span></a><a class="idx-list__row" href="#"><span>second-item</span><span class="idx-list__count">2</span></a><span class="idx-list__divider" aria-hidden="true"></span><div class="idx-list__row idx-list__row--total"><span>total</span><span class="idx-list__count">3</span></div></div>',
      needsLibrary: true,
    },
    {
      id: "plan-table",
      label: "Symptom table",
      hint: "Symptom → cause",
      html: '<div class="plan-table-wrap"><table class="plan-table"><thead><tr><th scope="col">Symptom</th><th scope="col">Cause</th></tr></thead><tbody><tr><td>What people see</td><td>Root cause</td></tr><tr><td>Second symptom</td><td>Second cause</td></tr></tbody></table></div>',
      needsLibrary: true,
    },
    {
      id: "mermaid",
      label: "Architecture diagram",
      hint: "Mermaid sequence",
      html: '<figure class="arch-diagram"><p class="arch-diagram__eyebrow">Eyebrow — frame the diagram</p><div class="arch-diagram__frame"><pre class="mermaid">sequenceDiagram\n    participant User\n    participant Agent\n    User->>Agent: request\n    Agent->>User: reply</pre></div><figcaption class="arch-diagram__caption">Caption — what to notice.</figcaption></figure>',
      needsLibrary: true,
      atomic: true,
    },
    {
      id: "sparkline",
      label: "Animated sparkline",
      hint: "Metric with trend",
      html: '<div class="dq-sparkline" data-dq-sparkline data-trend="up"><div class="dq-sparkline__head"><div><p class="dq-sparkline__label">Metric</p><p class="dq-sparkline__value">Value</p></div><span class="dq-sparkline__trend" data-direction="up">42%</span></div><div class="dq-sparkline__chart"><svg class="dq-sparkline__svg" viewBox="0 0 220 72" width="220" height="72" aria-hidden="true"><path class="dq-sparkline__fill" d=""></path><path class="dq-sparkline__path" d=""></path></svg></div><div class="dq-sparkline__controls"><button type="button" class="dq-sparkline__pill" data-dq-sparkline-curve="smooth" data-active="true">Smooth</button><button type="button" class="dq-sparkline__pill" data-dq-sparkline-curve="sharp">Sharp</button><button type="button" class="dq-sparkline__replay" data-dq-sparkline-replay>Replay</button></div></div>',
      needsLibrary: true,
      atomic: true,
    },
  ];

  // ---------------------------------------------------------------------
  // State + UI scaffolding (everything lives OUTSIDE <article>, so
  // serialization never sees editor chrome)
  // ---------------------------------------------------------------------
  let editing = false;
  let dirty = false;
  let currentBlock = null; // block the gutter is attached to
  let draggingBlock = null;

  const ui = document.createElement("div");
  ui.className = "ed-ui";
  ui.innerHTML = `
    <div class="ed-pill">
      <button type="button" class="ed-pill__btn" data-ed-toggle>Edit</button>
      <button type="button" class="ed-pill__btn ed-pill__btn--save" data-ed-save hidden>Save</button>
    </div>
    <div class="ed-gutter" hidden>
      <button type="button" class="ed-gutter__btn" data-ed-drag draggable="true" title="Drag to move · click for menu">⋮⋮</button>
      <button type="button" class="ed-gutter__btn" data-ed-plus title="Insert block below">+</button>
    </div>
    <div class="ed-blockmenu" hidden></div>
    <div class="ed-toolbar" hidden>
      <button type="button" data-ed-ai title="AI actions (coming soon)"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg></button>
      <span class="ed-toolbar__divider" aria-hidden="true"></span>
      <button type="button" data-ed-inline="strong"><b>B</b></button>
      <button type="button" data-ed-inline="em"><i>I</i></button>
      <button type="button" data-ed-inline="code">&lt;/&gt;</button>
      <div class="ed-toolbar__hl">
        <button type="button" data-ed-hl-main data-ed-hl="yellow"><span class="ed-toolbar__hl-dot" style="background:#fdeeb5"></span>Highlight</button>
        <div class="ed-toolbar__swatches">
          <button type="button" class="ed-toolbar__swatch" data-ed-hl="yellow" style="background:#fdeeb5" title="Yellow"></button>
          <button type="button" class="ed-toolbar__swatch" data-ed-hl="orange" style="background:#fbdcb5" title="Orange"></button>
          <button type="button" class="ed-toolbar__swatch" data-ed-hl="rose" style="background:#f6d3d3" title="Rose"></button>
          <button type="button" class="ed-toolbar__swatch" data-ed-hl="green" style="background:#d6e9cf" title="Green"></button>
          <button type="button" class="ed-toolbar__swatch" data-ed-hl="blue" style="background:#d2e2f2" title="Blue"></button>
        </div>
      </div>
      <button type="button" data-ed-inline="a">link</button>
    </div>
    <div class="ed-menu" hidden>
      <input class="ed-menu__q" type="text" placeholder="Filter components…" />
      <div class="ed-menu__list"></div>
    </div>
    <div class="ed-drop" hidden></div>
    <div class="ed-source" hidden>
      <div class="ed-source__panel">
        <p class="ed-source__title">Edit block source</p>
        <textarea class="ed-source__text" spellcheck="false"></textarea>
        <div class="ed-source__actions">
          <button type="button" class="ed-source__btn" data-ed-source-cancel>Cancel</button>
          <button type="button" class="ed-source__btn ed-source__btn--apply" data-ed-source-apply>Apply</button>
        </div>
      </div>
    </div>
    <div class="ed-toaster"></div>
  `;
  document.body.appendChild(ui);

  const pillToggle = ui.querySelector("[data-ed-toggle]");
  const pillSave = ui.querySelector("[data-ed-save]");
  const gutter = ui.querySelector(".ed-gutter");
  const dragBtn = ui.querySelector("[data-ed-drag]");
  const plusBtn = ui.querySelector("[data-ed-plus]");
  const blockMenu = ui.querySelector(".ed-blockmenu");
  const toolbar = ui.querySelector(".ed-toolbar");
  const slashMenu = ui.querySelector(".ed-menu");
  const slashInput = ui.querySelector(".ed-menu__q");
  const slashList = ui.querySelector(".ed-menu__list");
  const dropLine = ui.querySelector(".ed-drop");
  const sourceOverlay = ui.querySelector(".ed-source");
  const sourceText = ui.querySelector(".ed-source__text");
  const toaster = ui.querySelector(".ed-toaster");

  function edToast(message, kind = "default") {
    const el = document.createElement("div");
    el.className = "ed-toast";
    el.dataset.kind = kind;
    el.textContent = message;
    toaster.appendChild(el);
    requestAnimationFrame(() => el.setAttribute("data-on", "true"));
    setTimeout(() => {
      el.removeAttribute("data-on");
      setTimeout(() => el.remove(), 300);
    }, 2600);
  }

  // ---------------------------------------------------------------------
  // Block helpers
  // ---------------------------------------------------------------------
  // layout.js wraps sections in div.article-content-section at runtime;
  // blocks live either directly under <article> or inside those wrappers.
  function isBlockContainer(el) {
    return el === article || (el && el.nodeType === 1 && el.classList.contains("article-content-section"));
  }

  const topBlocks = () =>
    Array.from(article.children).flatMap((child) =>
      isBlockContainer(child) ? Array.from(child.children) : [child]
    );

  function blockOf(node) {
    let el = node.nodeType === 1 ? node : node.parentElement;
    while (el && !isBlockContainer(el.parentElement)) el = el.parentElement;
    if (!el || !article.contains(el) || el === article) return null;
    if (el.classList.contains("article-content-section")) return null; // never treat a whole section as a block
    return el;
  }

  function isAtomic(el) {
    return el.matches(ATOMIC_SEL) || !!el.querySelector(ATOMIC_SEL);
  }

  function markEditable(scope) {
    if (scope.nodeType !== 1) return;
    if (scope !== article && isAtomic(scope) === true && scope.matches(ATOMIC_SEL)) return;
    const roots =
      scope === article ? topBlocks() : [scope];
    roots.forEach((block) => {
      if (block.matches(ATOMIC_SEL)) return;
      if (TEXT_BLOCK_TAGS.has(block.tagName)) {
        block.contentEditable = "true";
        return;
      }
      block.querySelectorAll(EDITABLE_SEL).forEach((el) => {
        if (el.closest(ATOMIC_SEL)) return;
        const editableAncestor = el.parentElement && el.parentElement.closest('[contenteditable="true"]');
        if (editableAncestor && article.contains(editableAncestor)) return;
        el.contentEditable = "true";
      });
    });
  }

  function clearEditable() {
    article.querySelectorAll("[contenteditable]").forEach((el) => {
      el.removeAttribute("contenteditable");
    });
    article.querySelectorAll("[data-ed-ph]").forEach((el) => {
      el.removeAttribute("data-ed-ph");
    });
  }

  function newParagraph() {
    const p = document.createElement("p");
    p.setAttribute("data-ed-ph", "Type / for components");
    return p;
  }

  function focusStart(el) {
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(true);
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function focusEnd(el) {
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function firstEditableIn(block) {
    if (block.getAttribute("contenteditable") === "true") return block;
    return block.querySelector('[contenteditable="true"]');
  }

  function isArticleTextBlock(el) {
    return !!el && TEXT_BLOCK_TAGS.has(el.tagName) && isBlockContainer(el.parentElement);
  }

  function isBlockEmpty(el) {
    return el.textContent.trim() === "" && !el.querySelector("img");
  }

  function markDirty() {
    dirty = true;
    pillSave.classList.add("ed-pill__btn--dirty");
  }

  // ---------------------------------------------------------------------
  // Caret helpers. The caret is handled as (block, character offset),
  // computed at event time — never as a held DOM Range, which can go stale
  // when focus moves (this exact staleness caused a mid-word truncation
  // bug). See docs/research/wysiwyg-editor-architectures.md, rec 2.
  // ---------------------------------------------------------------------
  function caretToOffset(root) {
    const sel = getSelection();
    if (!sel.rangeCount || !sel.isCollapsed) return null;
    const range = sel.getRangeAt(0);
    if (!root.contains(range.startContainer)) return null;
    const probe = document.createRange();
    probe.selectNodeContents(root);
    probe.setEnd(range.startContainer, range.startOffset);
    return probe.toString().length;
  }

  function rangeAtOffset(root, offset) {
    const range = document.createRange();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let remaining = offset;
    let node;
    while ((node = walker.nextNode())) {
      const len = node.textContent.length;
      if (remaining <= len) {
        range.setStart(node, remaining);
        range.collapse(true);
        return range;
      }
      remaining -= len;
    }
    range.selectNodeContents(root);
    range.collapse(false);
    return range;
  }

  function setCaret(root, offset) {
    root.focus();
    const range = rangeAtOffset(root, offset);
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  // ---------------------------------------------------------------------
  // Undo journal. Every structural operation records what it touched
  // before mutating, so Cmd+Z restores it — structural mistakes become an
  // undo instead of data loss. Entries hold real element references, which
  // keeps the atomic-snapshot WeakMap valid across undos. (Rec 1.)
  //
  // Entry shape: { at, mutated: [{el, html, ph}], added: [el],
  //                restored: [{el, parent, next}], caret: {block, offset} }
  // ---------------------------------------------------------------------
  const undoStack = [];

  function pushUndo(entry) {
    entry.at = Date.now();
    undoStack.push(entry);
    if (undoStack.length > 100) undoStack.shift();
    return entry;
  }

  // Typing is journaled too (coalesced into bursts), so a single Cmd+Z
  // path covers text and structure alike — the browser's native undo stack
  // gets invalidated by our programmatic mutations anyway.
  const TYPING_INPUTS = new Set([
    "insertText",
    "insertCompositionText",
    "insertReplacementText",
    "insertFromPaste",
    "insertFromDrop",
    "insertLineBreak",
    "deleteContentBackward",
    "deleteContentForward",
    "deleteWordBackward",
    "deleteWordForward",
    "deleteByCut",
  ]);
  const TYPE_BURST_MS = 1200;
  let typeBurst = null; // { root, at, entry }

  function journalTyping(root) {
    const now = Date.now();
    if (
      typeBurst &&
      typeBurst.root === root &&
      now - typeBurst.at < TYPE_BURST_MS &&
      undoStack[undoStack.length - 1] === typeBurst.entry
    ) {
      typeBurst.at = now;
      return;
    }
    const offset = caretToOffset(root);
    const entry = pushUndo({
      mutated: [snapshotOf(root)],
      caret: offset === null ? null : { block: root, offset },
    });
    typeBurst = { root, at: now, entry };
  }

  function snapshotOf(el) {
    return { el, html: el.innerHTML, ph: el.hasAttribute("data-ed-ph") };
  }

  function placeOf(el) {
    return { el, parent: el.parentNode, next: el.nextSibling };
  }

  function undoStructural() {
    const entry = undoStack.pop();
    if (!entry) return false;
    (entry.added || []).forEach((el) => el.remove());
    (entry.restored || []).forEach(({ el, parent, next }) => {
      if (!parent) return;
      if (next && next.parentNode === parent) parent.insertBefore(el, next);
      else parent.appendChild(el);
    });
    (entry.mutated || []).forEach(({ el, html, ph }) => {
      el.innerHTML = html;
      if (ph) el.setAttribute("data-ed-ph", "Type / for components");
      else el.removeAttribute("data-ed-ph");
    });
    if (entry.caret && article.contains(entry.caret.block)) {
      const target = firstEditableIn(entry.caret.block) || entry.caret.block;
      setCaret(target, entry.caret.offset);
    }
    markDirty();
    return true;
  }

  // ---------------------------------------------------------------------
  // Normalize pass — run on every block an operation touched, in one place
  // instead of scattered special cases. (Rec 5.)
  // ---------------------------------------------------------------------
  function normalizeBlock(block) {
    if (!block || !article.contains(block) || block.nodeType !== 1) return;
    const holdsStructure = block.querySelector("img, svg, pre, table");
    if (block.textContent.trim() === "" && !holdsStructure) {
      block.innerHTML = "";
      if (block.tagName === "P" && !block.className) {
        block.setAttribute("data-ed-ph", "Type / for components");
      }
    } else {
      block.removeAttribute("data-ed-ph");
      const last = block.lastChild;
      if (last && last.nodeName === "BR") last.remove();
    }
    block
      .querySelectorAll('[contenteditable="true"] [contenteditable]')
      .forEach((el) => el.removeAttribute("contenteditable"));
  }

  // ---------------------------------------------------------------------
  // Structural operations. Explicit inputs, snapshot first, normalize and
  // restore the caret after; none of them read getSelection() internally.
  // Keyboard handlers are thin dispatchers over these. (Rec 3.)
  // ---------------------------------------------------------------------
  function splitBlockAt(block, offset) {
    const entry = pushUndo({
      mutated: [snapshotOf(block)],
      added: [],
      caret: { block, offset },
    });
    const tail = rangeAtOffset(block, offset);
    tail.setEnd(block, block.childNodes.length);
    const fragment = tail.extractContents();
    const next = newParagraph();
    next.appendChild(fragment);
    block.after(next);
    entry.added.push(next);
    next.contentEditable = "true";
    normalizeBlock(block);
    normalizeBlock(next);
    markDirty();
    setCaret(next, 0);
    return next;
  }

  function insertEmptyParagraph(refBlock, where, caretReturn) {
    const p = newParagraph();
    p.contentEditable = "true";
    where === "before" ? refBlock.before(p) : refBlock.after(p);
    pushUndo({ added: [p], caret: caretReturn || null });
    markDirty();
    return p;
  }

  function removeEmptyBlock(block) {
    const prev = block.previousElementSibling;
    pushUndo({ restored: [placeOf(block)], caret: { block, offset: 0 } });
    block.remove();
    markDirty();
    hideGutter();
    if (prev) {
      const target = firstEditableIn(prev);
      if (target) focusEnd(target);
    }
  }

  /** Merge a text block into the previous text block (Backspace at start). */
  function mergeWithPrevious(block) {
    const prev = block.previousElementSibling;
    if (!prev || !TEXT_BLOCK_TAGS.has(prev.tagName)) return;
    const junction = prev.textContent.length;
    pushUndo({
      mutated: [snapshotOf(prev)],
      restored: [placeOf(block)],
      caret: { block, offset: 0 },
    });
    while (block.firstChild) prev.appendChild(block.firstChild);
    block.remove();
    normalizeBlock(prev);
    markDirty();
    hideGutter();
    setCaret(prev, junction);
  }

  /** Non-paragraph empty blocks become <p> so the slash menu can replace them. */
  function slashParagraphFrom(block) {
    if (block.tagName === "P") return block;
    const place = placeOf(block);
    const p = newParagraph();
    p.contentEditable = "true";
    block.replaceWith(p);
    pushUndo({ restored: [place], added: [p], caret: null });
    markDirty();
    return p;
  }

  // ---------------------------------------------------------------------
  // Enter / exit edit mode
  // ---------------------------------------------------------------------
  function collapseWhitespaceBlocks() {
    topBlocks().forEach((block) => {
      if (!TEXT_BLOCK_TAGS.has(block.tagName)) return;
      if (block.className) return;
      if (block.hasAttribute("data-ed-ph")) return;
      if (block.textContent.trim() === "" && !block.querySelector("img")) block.remove();
    });
  }

  function enterEditMode() {
    editing = true;
    document.body.classList.add("ed-active");
    pillToggle.textContent = "Done";
    pillSave.hidden = false;
    collapseWhitespaceBlocks();
    markEditable(article);
  }

  function exitEditMode() {
    editing = false;
    document.body.classList.remove("ed-active");
    pillToggle.textContent = "Edit";
    pillSave.hidden = true;
    article.querySelectorAll(".ed-block--active").forEach((el) => el.classList.remove("ed-block--active"));
    clearEditable();
    hideGutter();
    hideToolbar();
    closeSlashMenu();
    closeBlockMenu();
    undoStack.length = 0;
    typeBurst = null;
  }

  pillToggle.addEventListener("click", () => {
    editing ? exitEditMode() : enterEditMode();
  });

  // ---------------------------------------------------------------------
  // Save — serialize from a cleaned clone, swap atomic blocks for their
  // pristine snapshots, sync data-copy attributes, POST to the server.
  // ---------------------------------------------------------------------
  function syncCopyAttributes(scope) {
    scope.querySelectorAll(".code-block[data-copy]").forEach((host) => {
      const pre = host.querySelector("pre");
      if (pre) host.setAttribute("data-copy", pre.textContent);
    });
    scope.querySelectorAll(".install-code[data-copy]").forEach((host) => {
      const code = host.querySelector("code");
      if (code) host.setAttribute("data-copy", code.textContent);
    });
    scope.querySelectorAll(".idx-command[data-copy]").forEach((host) => {
      const code = host.querySelector(".idx-command__code");
      if (code) host.setAttribute("data-copy", code.textContent.trim());
    });
    scope.querySelectorAll(".article-protocol pre").forEach(() => {});
  }

  function serializeArticle() {
    const clone = article.cloneNode(true);

    // Swap every dynamic block in the clone for its snapshot markup.
    const liveDynamic = Array.from(article.querySelectorAll(ATOMIC_SEL));
    const cloneDynamic = Array.from(clone.querySelectorAll(ATOMIC_SEL));
    cloneDynamic.forEach((cloneEl, i) => {
      const snap = snapshots.get(liveDynamic[i]);
      if (snap) cloneEl.outerHTML = snap;
    });

    // layout.js wraps sections in div.article-content-section at runtime
    // (for the TOC). Unwrap them all so they never get baked into the file —
    // otherwise every load+save cycle nests them one level deeper.
    let wrapper;
    while ((wrapper = clone.querySelector(".article-content-section"))) {
      wrapper.replaceWith(...wrapper.childNodes);
    }

    clone.querySelectorAll("[contenteditable]").forEach((el) => el.removeAttribute("contenteditable"));
    clone.querySelectorAll("[data-ed-ph]").forEach((el) => el.removeAttribute("data-ed-ph"));
    clone.querySelectorAll("[draggable]").forEach((el) => el.removeAttribute("draggable"));
    clone.querySelectorAll(".ed-drag-src").forEach((el) => el.classList.remove("ed-drag-src"));
    // Strip attributes injected by inspection/automation tooling
    clone.querySelectorAll("*").forEach((el) => {
      for (const attr of Array.from(el.attributes)) {
        if (attr.name.startsWith("data-cursor-")) el.removeAttribute(attr.name);
      }
    });
    // Drop empty class attributes left behind
    clone.querySelectorAll('[class=""]').forEach((el) => el.removeAttribute("class"));

    // Drop whitespace-only plain paragraphs left over from editing.
    clone.querySelectorAll("p:not([class])").forEach((p) => {
      if (p.textContent.trim() === "" && !p.querySelector("img")) p.remove();
    });

    syncCopyAttributes(clone);
    return clone.innerHTML;
  }

  async function save() {
    hideToolbar();
    const articleHtml = serializeArticle();
    try {
      const res = await fetch("/api/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: location.pathname, articleHtml }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || res.statusText);
      dirty = false;
      pillSave.classList.remove("ed-pill__btn--dirty");
      edToast("Saved " + data.file, "success");
    } catch (err) {
      edToast("Save failed: " + err.message, "error");
    }
  }

  pillSave.addEventListener("click", save);

  window.addEventListener("keydown", (e) => {
    if (!editing || !(e.metaKey || e.ctrlKey)) return;
    if (e.key.toLowerCase() === "s") {
      e.preventDefault();
      save();
      return;
    }
    // Cmd+Z: one undo path for everything — typing bursts and structural
    // operations share the same journal.
    if (e.key.toLowerCase() === "z" && !e.shiftKey) {
      e.preventDefault();
      typeBurst = null;
      closeSlashMenu();
      if (!undoStructural()) edToast("Nothing to undo", "default");
    }
  });

  article.addEventListener("input", () => {
    if (!editing) return;
    markDirty();
  });

  window.addEventListener("beforeunload", (e) => {
    if (dirty) {
      e.preventDefault();
      e.returnValue = "";
    }
  });

  // ---------------------------------------------------------------------
  // Gutter: hover controls per block (drag handle + insert button)
  // ---------------------------------------------------------------------
  function showGutterFor(block) {
    if (currentBlock && currentBlock !== block) {
      currentBlock.classList.remove("ed-block--active");
    }
    currentBlock = block;
    block.classList.add("ed-block--active");
    const rect = block.getBoundingClientRect();
    gutter.hidden = false;
    const gutterW = gutter.offsetWidth || 46;
    const clearance = 10;
    gutter.style.top = `${rect.top + 2}px`;
    gutter.style.left = `${Math.max(8, rect.left - gutterW - clearance)}px`;
  }

  function hideGutter() {
    if (currentBlock) currentBlock.classList.remove("ed-block--active");
    gutter.hidden = true;
    currentBlock = null;
  }

  article.addEventListener("mouseover", (e) => {
    if (!editing) return;
    const block = blockOf(e.target);
    if (block) showGutterFor(block);
  });

  // Safe zone: the union rectangle spanning the gutter and the current
  // block (plus padding). The pointer crosses non-article space on its way
  // from the block to the gutter controls — as long as it stays inside this
  // corridor, the gutter must not disappear.
  function inSafeZone(e) {
    if (!currentBlock) return false;
    const b = currentBlock.getBoundingClientRect();
    const g = gutter.getBoundingClientRect();
    const pad = 12;
    const left = Math.min(g.left, b.left) - pad;
    const right = Math.max(g.right, b.right) + pad;
    const top = Math.min(g.top, b.top) - pad;
    const bottom = Math.max(g.bottom, b.bottom) + pad;
    return e.clientX >= left && e.clientX <= right && e.clientY >= top && e.clientY <= bottom;
  }

  document.addEventListener("mousemove", (e) => {
    if (!editing || gutter.hidden) return;
    if (!blockMenu.hidden || !slashMenu.hidden) return; // menu open — keep everything
    const overGutter = gutter.contains(e.target);
    const overArticle = article.contains(e.target);
    if (!overGutter && !overArticle && !inSafeZone(e)) hideGutter();
  });

  window.addEventListener("scroll", () => {
    if (currentBlock && !gutter.hidden) showGutterFor(currentBlock);
  });

  const articleScroller = article.closest(".article-shell__scroll");
  if (articleScroller) {
    articleScroller.addEventListener("scroll", () => {
      if (currentBlock && !gutter.hidden) showGutterFor(currentBlock);
    }, { passive: true });
  }

  plusBtn.addEventListener("click", () => {
    if (!currentBlock) return;
    const p = insertEmptyParagraph(currentBlock, "after", null);
    focusStart(p);
  });

  // ---------------------------------------------------------------------
  // Block menu (click on drag handle): move / duplicate / delete / source
  // ---------------------------------------------------------------------
  let menuBlock = null;

  function openBlockMenu(block) {
    menuBlock = block;
    const atomic = isAtomic(block);
    blockMenu.innerHTML = `
      <button type="button" data-ed-act="up">Move up</button>
      <button type="button" data-ed-act="down">Move down</button>
      <button type="button" data-ed-act="dup">Duplicate</button>
      <button type="button" data-ed-act="src">Edit source${atomic ? " (diagram)" : ""}</button>
      <button type="button" data-ed-act="del" class="ed-blockmenu__danger">Delete</button>
    `;
    const rect = block.getBoundingClientRect();
    blockMenu.hidden = false;
    blockMenu.style.top = `${rect.top + window.scrollY + 24}px`;
    blockMenu.style.left = `${Math.max(8, rect.left + window.scrollX - 56)}px`;
  }

  function closeBlockMenu() {
    blockMenu.hidden = true;
    menuBlock = null;
  }

  dragBtn.addEventListener("click", () => {
    if (!currentBlock) return;
    blockMenu.hidden ? openBlockMenu(currentBlock) : closeBlockMenu();
  });

  blockMenu.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-ed-act]");
    if (!btn || !menuBlock) return;
    const act = btn.dataset.edAct;
    const block = menuBlock;
    closeBlockMenu();
    markDirty();

    if (act === "up" && block.previousElementSibling) {
      pushUndo({ restored: [placeOf(block)], caret: null });
      block.previousElementSibling.before(block);
      showGutterFor(block);
    } else if (act === "down" && block.nextElementSibling) {
      pushUndo({ restored: [placeOf(block)], caret: null });
      block.nextElementSibling.after(block);
      showGutterFor(block);
    } else if (act === "del") {
      // Keep the atomic snapshot: Cmd+Z re-inserts this exact element and
      // the save path still needs its pristine markup.
      pushUndo({ restored: [placeOf(block)], caret: null });
      block.remove();
      hideGutter();
    } else if (act === "dup") {
      let copy;
      if (snapshots.has(block)) {
        // Duplicate atomic blocks from their pristine snapshot, not the
        // (possibly library-mutated) live DOM.
        const tpl = document.createElement("template");
        tpl.innerHTML = snapshots.get(block);
        copy = tpl.content.firstElementChild;
        snapshots.set(copy, snapshots.get(block));
      } else {
        copy = block.cloneNode(true);
      }
      block.after(copy);
      pushUndo({ added: [copy], caret: null });
      if (!snapshots.has(copy)) markEditable(copy);
      rerenderDynamic(copy);
    } else if (act === "src") {
      openSourceEditor(block);
    }
  });

  document.addEventListener("click", (e) => {
    if (!blockMenu.hidden && !blockMenu.contains(e.target) && !gutter.contains(e.target)) {
      closeBlockMenu();
    }
  });

  // ---------------------------------------------------------------------
  // Drag to reorder — drag the handle, drop between blocks
  // ---------------------------------------------------------------------
  dragBtn.addEventListener("dragstart", (e) => {
    if (!currentBlock) return;
    draggingBlock = currentBlock;
    draggingBlock.classList.add("ed-drag-src");
    e.dataTransfer.setData("text/plain", "block");
    e.dataTransfer.effectAllowed = "move";
    closeBlockMenu();
  });

  dragBtn.addEventListener("dragend", () => {
    if (draggingBlock) draggingBlock.classList.remove("ed-drag-src");
    draggingBlock = null;
    dropLine.hidden = true;
  });

  let dropTarget = null; // { block, before }

  article.addEventListener("dragover", (e) => {
    if (!draggingBlock) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const blocks = topBlocks().filter((b) => b !== draggingBlock);
    let best = null;
    for (const b of blocks) {
      const r = b.getBoundingClientRect();
      const mid = r.top + r.height / 2;
      if (e.clientY < mid) {
        best = { block: b, before: true, y: r.top };
        break;
      }
      best = { block: b, before: false, y: r.bottom };
    }
    dropTarget = best;
    if (best) {
      const articleRect = article.getBoundingClientRect();
      dropLine.hidden = false;
      dropLine.style.top = `${best.y + window.scrollY - 1}px`;
      dropLine.style.left = `${articleRect.left + window.scrollX}px`;
      dropLine.style.width = `${articleRect.width}px`;
    }
  });

  article.addEventListener("drop", (e) => {
    if (!draggingBlock || !dropTarget) return;
    e.preventDefault();
    pushUndo({ restored: [placeOf(draggingBlock)], caret: null });
    dropTarget.before ? dropTarget.block.before(draggingBlock) : dropTarget.block.after(draggingBlock);
    markDirty();
    dropLine.hidden = true;
    dropTarget = null;
  });

  // ---------------------------------------------------------------------
  // Source editor overlay (generic escape hatch; the only way to edit
  // Mermaid/sparkline internals)
  // ---------------------------------------------------------------------
  let sourceBlock = null;

  function openSourceEditor(block) {
    sourceBlock = block;
    sourceText.value = snapshots.get(block) || block.outerHTML;
    sourceOverlay.hidden = false;
    sourceText.focus();
  }

  ui.querySelector("[data-ed-source-cancel]").addEventListener("click", () => {
    sourceOverlay.hidden = true;
    sourceBlock = null;
  });

  ui.querySelector("[data-ed-source-apply]").addEventListener("click", () => {
    if (!sourceBlock) return;
    const tpl = document.createElement("template");
    tpl.innerHTML = sourceText.value.trim();
    const fresh = tpl.content.firstElementChild;
    if (!fresh) {
      edToast("Source must contain one element", "error");
      return;
    }
    // Keep the old block's atomic snapshot so Cmd+Z restores it intact.
    const place = placeOf(sourceBlock);
    sourceBlock.replaceWith(fresh);
    pushUndo({ restored: [place], added: [fresh], caret: null });
    if (fresh.matches(ATOMIC_SEL) || fresh.querySelector(ATOMIC_SEL)) {
      (fresh.matches(ATOMIC_SEL) ? [fresh] : Array.from(fresh.querySelectorAll(ATOMIC_SEL))).forEach((el) => {
        snapshots.set(el, el.outerHTML);
      });
    } else {
      markEditable(fresh);
    }
    rerenderDynamic(fresh);
    markDirty();
    sourceOverlay.hidden = true;
    sourceBlock = null;
  });

  function rerenderDynamic(el) {
    if (el.querySelector && (el.matches(".arch-diagram") || el.querySelector(".mermaid"))) {
      if (typeof window.mermaid !== "undefined") {
        window.mermaid.run({ nodes: el.querySelectorAll(".mermaid") }).catch(() => {});
      } else {
        edToast("Mermaid CDN not loaded on this page — diagram renders after you add it", "default");
      }
    }
    if (el.matches && (el.matches("[data-dq-sparkline]") || el.querySelector("[data-dq-sparkline]"))) {
      edToast("Sparkline animates after reload", "default");
    }
  }

  // ---------------------------------------------------------------------
  // Editing input. Structural edits are intercepted via beforeinput —
  // semantic inputTypes (insertParagraph, insertLineBreak,
  // deleteContentBackward) are more reliable than matching e.key, and they
  // cover IME/autocorrect/mobile keyboards. keydown remains only for the
  // "/" menu trigger. (Rec 6.) Handlers are thin dispatchers: they compute
  // the caret offset at event time and hand plain values to the pure
  // operations above — never Range objects.
  // ---------------------------------------------------------------------
  article.addEventListener("beforeinput", (e) => {
    if (!editing) return;
    const root = e.target.closest && e.target.closest('[contenteditable="true"]');
    if (!root) return;

    if (e.inputType === "insertParagraph" || e.inputType === "insertLineBreak") {
      if (root.closest("pre")) {
        e.preventDefault();
        insertPlainText("\n");
        markDirty();
        return;
      }
      if (root.closest("td, th")) {
        e.preventDefault();
        return;
      }
      if (root.tagName === "LI" || root.closest("li")) return; // native li split

      // Shift+Enter: let the browser insert the <br> natively — it stays
      // in the same element and handles the end-of-block case correctly.
      if (e.inputType === "insertLineBreak") return;

      // Labels/spans/figcaptions: Enter does nothing structural
      e.preventDefault();
      if (!TEXT_BLOCK_TAGS.has(root.tagName)) return;

      // Enter always yields a new paragraph, never the component menu —
      // the menu only opens via "/" on an empty block.
      if (isBlockEmpty(root)) {
        const p = insertEmptyParagraph(root, "after", { block: root, offset: 0 });
        setCaret(p, 0);
        return;
      }
      // A non-collapsed selection is replaced by the split: delete it
      // first, but only if it's fully inside this block.
      const sel = getSelection();
      if (sel.rangeCount && !sel.isCollapsed) {
        const r = sel.getRangeAt(0);
        if (!root.contains(r.startContainer) || !root.contains(r.endContainer)) return;
        r.deleteContents();
        sel.collapseToStart();
      }
      const offset = caretToOffset(root);
      if (offset === null) return; // selection not in this block — refuse to guess
      splitBlockAt(root, offset);
      return;
    }

    if (e.inputType === "deleteContentBackward" && isArticleTextBlock(root)) {
      if (isBlockEmpty(root)) {
        e.preventDefault();
        removeEmptyBlock(root);
        return;
      }
      // At block start: merge into the previous text block
      if (caretToOffset(root) === 0) {
        e.preventDefault();
        mergeWithPrevious(root);
      }
      return;
    }

    if (e.inputType === "deleteContentForward" && isArticleTextBlock(root) && isBlockEmpty(root)) {
      e.preventDefault();
      removeEmptyBlock(root);
      return;
    }

    // Anything that reached here mutates content natively — journal the
    // block's pre-change state so Cmd+Z can restore it.
    if (TYPING_INPUTS.has(e.inputType)) journalTyping(root);
  });

  article.addEventListener("keydown", (e) => {
    if (!editing) return;
    const root = e.target.closest && e.target.closest('[contenteditable="true"]');
    if (!root) return;

    // "/" on an empty text block opens the slash menu
    if (e.key === "/" && isArticleTextBlock(root) && isBlockEmpty(root)) {
      e.preventDefault();
      openSlashMenu(slashParagraphFrom(root));
    }
  });

  function insertPlainText(text) {
    const sel = getSelection();
    if (!sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    range.deleteContents();
    const node = document.createTextNode(text);
    range.insertNode(node);
    range.setStartAfter(node);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  // ---------------------------------------------------------------------
  // Slash menu
  // ---------------------------------------------------------------------
  let slashAnchor = null; // the empty <p> being replaced
  let slashIndex = 0;

  function libraryLoaded() {
    return !!document.querySelector('link[href*="components.css"]');
  }

  function renderSlashList(query) {
    const q = query.trim().toLowerCase();
    const items = TEMPLATES.filter(
      (t) => !q || t.label.toLowerCase().includes(q) || t.id.includes(q)
    );
    slashIndex = Math.min(slashIndex, Math.max(0, items.length - 1));
    slashList.innerHTML = items.length
      ? items
          .map(
            (t, i) =>
              `<button type="button" class="ed-menu__item" data-ed-tpl="${t.id}" data-sel="${i === slashIndex}">
                <span class="ed-menu__label">${t.label}</span>
                <span class="ed-menu__hint">${t.hint}</span>
              </button>`
          )
          .join("")
      : '<p class="ed-menu__empty">No matches</p>';
    return items;
  }

  // The menu opens only after the block operation has fully completed and
  // the caret is restored — it is positioned from the settled block's rect
  // and never runs while a mutation is in flight. (Rec 4.)
  function openSlashMenu(anchor) {
    if (!article.contains(anchor)) return;
    slashAnchor = anchor;
    slashIndex = 0;
    slashInput.value = "";
    renderSlashList("");
    const rect = anchor.getBoundingClientRect();
    slashMenu.hidden = false;
    slashMenu.style.top = `${rect.bottom + window.scrollY + 6}px`;
    slashMenu.style.left = `${rect.left + window.scrollX}px`;
    showGutterFor(anchor); // keep the plus / drag handle visible alongside
    slashInput.focus();
  }

  function closeSlashMenu() {
    slashMenu.hidden = true;
    slashAnchor = null;
  }

  function insertTemplate(id) {
    const tpl = TEMPLATES.find((t) => t.id === id);
    if (!tpl || !slashAnchor) return;
    const anchor = slashAnchor;
    closeSlashMenu();

    const place = placeOf(anchor);
    anchor.insertAdjacentHTML("afterend", tpl.html);
    const el = anchor.nextElementSibling;
    anchor.remove();
    pushUndo({ restored: [place], added: [el], caret: null });
    markDirty();

    if (tpl.atomic || el.matches(ATOMIC_SEL) || el.querySelector(ATOMIC_SEL)) {
      (el.matches(ATOMIC_SEL) ? [el] : Array.from(el.querySelectorAll(ATOMIC_SEL))).forEach((a) => {
        snapshots.set(a, a.outerHTML);
      });
      rerenderDynamic(el);
    } else {
      markEditable(el);
      const target = firstEditableIn(el);
      if (target) focusStart(target);
    }

    if (tpl.needsLibrary && !libraryLoaded()) {
      edToast("This page doesn't load components.css — add it to <head> for styling", "default");
    }
  }

  slashInput.addEventListener("input", () => {
    slashIndex = 0;
    renderSlashList(slashInput.value);
  });

  slashInput.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      const anchor = slashAnchor;
      closeSlashMenu();
      if (anchor) focusStart(anchor);
      return;
    }
    const items = TEMPLATES.filter((t) => {
      const q = slashInput.value.trim().toLowerCase();
      return !q || t.label.toLowerCase().includes(q) || t.id.includes(q);
    });
    if (e.key === "ArrowDown") {
      e.preventDefault();
      slashIndex = Math.min(slashIndex + 1, items.length - 1);
      renderSlashList(slashInput.value);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      slashIndex = Math.max(slashIndex - 1, 0);
      renderSlashList(slashInput.value);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (items[slashIndex]) insertTemplate(items[slashIndex].id);
    }
  });

  slashList.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-ed-tpl]");
    if (btn) insertTemplate(btn.dataset.edTpl);
  });

  document.addEventListener("mousedown", (e) => {
    if (!slashMenu.hidden && !slashMenu.contains(e.target)) closeSlashMenu();
  });

  // ---------------------------------------------------------------------
  // Inline toolbar (selection formatting)
  // ---------------------------------------------------------------------
  function hideToolbar() {
    toolbar.hidden = true;
  }

  function maybeShowToolbar() {
    if (!editing) return hideToolbar();
    const sel = getSelection();
    if (!sel.rangeCount || sel.isCollapsed) return hideToolbar();
    const range = sel.getRangeAt(0);
    const container =
      range.commonAncestorContainer.nodeType === 1
        ? range.commonAncestorContainer
        : range.commonAncestorContainer.parentElement;
    if (!container || !article.contains(container)) return hideToolbar();
    if (!container.closest('[contenteditable="true"]')) return hideToolbar();

    const rect = range.getBoundingClientRect();
    toolbar.hidden = false;
    toolbar.style.top = `${rect.top + window.scrollY - 40}px`;
    toolbar.style.left = `${rect.left + window.scrollX + rect.width / 2 - toolbar.offsetWidth / 2}px`;
  }

  document.addEventListener("mouseup", () => setTimeout(maybeShowToolbar, 0));
  document.addEventListener("keyup", (e) => {
    if (e.key.startsWith("Arrow") || e.shiftKey) maybeShowToolbar();
  });

  const INLINE_DEFS = {
    strong: { tag: "strong" },
    em: { tag: "em" },
    code: { tag: "code" },
    a: { tag: "a" },
  };

  /** Journal the enclosing editable block before an inline change. */
  function journalInline(anchorEl) {
    const root = anchorEl && anchorEl.closest('[contenteditable="true"]');
    if (root && article.contains(root)) {
      pushUndo({ mutated: [snapshotOf(root)], caret: null });
    }
  }

  function toggleHighlight(color) {
    const sel = getSelection();
    if (!sel.rangeCount || sel.isCollapsed) return;
    const range = sel.getRangeAt(0);
    const anchorEl =
      sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement;

    const existing = anchorEl && anchorEl.closest("mark.hl");
    if (existing && article.contains(existing)) {
      journalInline(anchorEl);
      if (existing.classList.contains(`hl--${color}`)) {
        // Same color again — remove the highlight
        const parent = existing.parentNode;
        while (existing.firstChild) parent.insertBefore(existing.firstChild, existing);
        existing.remove();
        parent.normalize();
      } else {
        existing.className = `hl hl--${color}`;
      }
      markDirty();
      hideToolbar();
      return;
    }

    journalInline(anchorEl);
    const wrapper = document.createElement("mark");
    wrapper.className = `hl hl--${color}`;
    try {
      range.surroundContents(wrapper);
    } catch {
      wrapper.appendChild(range.extractContents());
      range.insertNode(wrapper);
    }
    markDirty();
    sel.removeAllRanges();
    hideToolbar();
  }

  function toggleInline(kind) {
    const def = INLINE_DEFS[kind];
    const sel = getSelection();
    if (!sel.rangeCount || sel.isCollapsed) return;
    const range = sel.getRangeAt(0);
    const anchorEl =
      sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement;
    journalInline(anchorEl);

    const selector = def.cls ? `${def.tag}.${def.cls.split(" ").join(".")}` : def.tag;
    const existing = anchorEl && anchorEl.closest(selector);
    if (existing && article.contains(existing) && (def.cls || !def.clsRequired)) {
      // Unwrap (toggle off) — but don't unwrap a plain <code> when asking for chip etc.
      if (kind !== "chip" || existing.classList.contains("code-chip")) {
        const parent = existing.parentNode;
        while (existing.firstChild) parent.insertBefore(existing.firstChild, existing);
        existing.remove();
        parent.normalize();
        markDirty();
        hideToolbar();
        return;
      }
    }

    const wrapper = document.createElement(def.tag);
    if (def.cls) wrapper.className = def.cls;
    if (kind === "a") {
      const url = prompt("Link URL:", "https://");
      if (!url) return;
      wrapper.setAttribute("href", url);
    }
    try {
      range.surroundContents(wrapper);
    } catch {
      wrapper.appendChild(range.extractContents());
      range.insertNode(wrapper);
    }
    markDirty();
    sel.removeAllRanges();
    hideToolbar();
  }

  toolbar.addEventListener("mousedown", (e) => e.preventDefault()); // keep selection
  toolbar.addEventListener("click", (e) => {
    if (e.target.closest("[data-ed-ai]")) {
      edToast("AI actions coming soon", "default");
      return;
    }
    const hlBtn = e.target.closest("[data-ed-hl]");
    if (hlBtn) {
      const color = hlBtn.dataset.edHl;
      // Remember the choice: the main button applies it next time and its
      // leading dot shows the active color.
      if (!hlBtn.hasAttribute("data-ed-hl-main")) {
        const main = toolbar.querySelector("[data-ed-hl-main]");
        main.dataset.edHl = color;
        toolbar.querySelector(".ed-toolbar__hl-dot").style.background =
          hlBtn.style.background;
      }
      toggleHighlight(color);
      return;
    }
    const btn = e.target.closest("[data-ed-inline]");
    if (btn) toggleInline(btn.dataset.edInline);
  });
})();
