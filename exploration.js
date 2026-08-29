// dqnamo-inspired experiments — vanilla JS, no dependencies.
(function () {
  "use strict";

  const ENCRYPTED_CHARS = "-_~`!@#$%^&*()+=[]{}|;:,.<>?";
  const MAX_REVEAL_STEPS = 48;

  function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function getTextSegments(text) {
    if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
      const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
      return Array.from(segmenter.segment(text), ({ segment }) => segment);
    }
    return Array.from(text);
  }

  function stableChar(segment, index) {
    let hash = index + 1;
    for (const ch of segment) hash = (hash * 31 + (ch.codePointAt(0) ?? 0)) % 2147483647;
    return ENCRYPTED_CHARS[hash % ENCRYPTED_CHARS.length];
  }

  function randomChar() {
    return ENCRYPTED_CHARS[Math.floor(Math.random() * ENCRYPTED_CHARS.length)];
  }

  function scrambleSegments(segments, revealed, mode) {
    return segments
      .map((seg, i) => {
        if (seg.trim() === "" || i < revealed) return seg;
        return mode === "stable" ? stableChar(seg, i) : randomChar();
      })
      .join("");
  }

  function revealStep(count) {
    return Math.max(1, Math.ceil(count / MAX_REVEAL_STEPS));
  }

  // --- Scramble text ---
  function initScrambleText(root) {
    const display = root.querySelector("[data-dq-scramble-display]");
    const live = root.querySelector("[data-dq-scramble-live]");
    if (!display || !live) return;

    let target = display.textContent || "";
    let timer = null;

    function setTarget(next) {
      target = next;
      live.textContent = next;
      if (timer) clearInterval(timer);

      const segments = getTextSegments(next);
      if (!segments.length || prefersReducedMotion()) {
        display.textContent = next;
        return;
      }

      let revealed = 0;
      const step = revealStep(segments.length);
      display.textContent = scrambleSegments(segments, revealed, "random");

      timer = setInterval(() => {
        revealed = Math.min(segments.length, revealed + step);
        display.textContent = scrambleSegments(segments, revealed, "random");
        if (revealed >= segments.length) clearInterval(timer);
      }, 32);
    }

    root.querySelectorAll("[data-dq-scramble-trigger]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const next = btn.getAttribute("data-dq-scramble-value");
        if (next) setTarget(next);
      });
    });

    setTarget(target);
  }

  // --- Agent dock ---
  function initAgentDock(root) {
    const form = root.querySelector(".dq-agent-dock__form");
    const composer = root.querySelector(".dq-agent-dock__composer");
    const textarea = root.querySelector(".dq-agent-dock__textarea");
    const status = root.querySelector(".dq-agent-dock__status");
    const chatBtn = root.querySelector(".dq-agent-dock__chat");
    const chatLabel = root.querySelector(".dq-agent-dock__chat-label");
    const closeBtn = root.querySelector(".dq-agent-dock__close");
    if (!form || !composer || !textarea || !status) return;

    let mode = "idle";

    function setMode(next) {
      mode = next;
      root.dataset.mode = next;
      status.textContent =
        next === "working"
          ? root.dataset.workingStatus || "Working…"
          : root.dataset.idleStatus || "Ready";
      composer.setAttribute("aria-hidden", next !== "composing" ? "true" : "false");
      if (chatLabel) chatLabel.textContent = next === "composing" ? "Send" : "Chat";
      if (next === "composing") requestAnimationFrame(() => textarea.focus());
    }

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (mode === "composing") {
        const msg = textarea.value.trim();
        if (!msg) {
          setMode("composing");
          return;
        }
        textarea.value = "";
        setMode("working");
        setTimeout(() => setMode("idle"), 1800);
        return;
      }
      setMode("composing");
    });

    closeBtn?.addEventListener("click", () => setMode("idle"));
    textarea.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        form.requestSubmit();
      }
    });

    setMode("idle");
  }

  // --- Scroll fade list ---
  function initScrollFadeList(root) {
    const scroll = root.querySelector(".dq-scroll-fade__scroll");
    if (!scroll) return;

    const maxFade = Number(root.dataset.maxFade) || 76;
    let frame = 0;

    function update() {
      const maxScroll = Math.max(0, scroll.scrollHeight - scroll.clientHeight);
      const fromTop = scroll.scrollTop;
      const fromBottom = maxScroll - scroll.scrollTop;
      root.style.setProperty("--top-fade-height", `${Math.min(maxFade, Math.max(0, fromTop))}px`);
      root.style.setProperty(
        "--bottom-fade-height",
        `${Math.min(maxFade, Math.max(0, fromBottom))}px`
      );
    }

    function schedule() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    }

    update();
    scroll.addEventListener("scroll", schedule, { passive: true });
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(schedule);
      ro.observe(scroll);
      if (scroll.firstElementChild) ro.observe(scroll.firstElementChild);
    }
  }

  // --- Model selector ---
  const DEFAULT_MODELS = [
    {
      id: "atlas-pro",
      name: "Atlas Pro",
      vendor: "Northwind",
      capability: 92,
      speed: 68,
      context: 200,
      cost: 3,
    },
    {
      id: "lumen-fast",
      name: "Lumen Fast",
      vendor: "Helix",
      capability: 78,
      speed: 95,
      context: 128,
      cost: 1,
    },
    {
      id: "summit-reason",
      name: "Summit Reason",
      vendor: "Cedar",
      capability: 88,
      speed: 54,
      context: 256,
      cost: 5,
    },
  ];

  function initModelSelector(root) {
    const trigger = root.querySelector(".dq-model-selector__trigger");
    const menu = root.querySelector(".dq-model-selector__menu");
    const nameEl = root.querySelector(".dq-model-selector__name");
    const logoEl = root.querySelector(".dq-model-selector__logo");
    const prompt = root.querySelector(".dq-model-selector__prompt");
    if (!trigger || !menu || !nameEl) return;

    let open = false;
    let selected = DEFAULT_MODELS[0];

    function renderMenu() {
      menu.innerHTML = DEFAULT_MODELS.map(
        (m) => `
        <button type="button" class="dq-model-selector__option${m.id === selected.id ? " is-active" : ""}" data-model-id="${m.id}">
          <span class="dq-model-selector__option-head">
            <span class="dq-model-selector__option-logo" aria-hidden="true">${m.vendor.slice(0, 1)}</span>
            <span>
              <span class="dq-model-selector__option-name">${m.name}</span>
              <span class="dq-model-selector__option-vendor">${m.vendor}</span>
            </span>
          </span>
          <span class="dq-model-selector__bars">
            ${barRow("Capability", m.capability)}
            ${barRow("Speed", m.speed)}
            ${barRow("Context", Math.min(100, m.context / 3))}
            ${barRow("Cost", 100 - m.cost * 15)}
          </span>
        </button>`
      ).join("");
    }

    function barRow(label, value) {
      return `<span class="dq-model-selector__bar-row"><span>${label}</span><span class="dq-model-selector__bar"><span style="width:${value}%"></span></span></span>`;
    }

    function select(model) {
      selected = model;
      nameEl.textContent = model.name;
      if (logoEl) logoEl.textContent = model.vendor.slice(0, 1);
      renderMenu();
    }

    function setOpen(next) {
      open = next;
      root.dataset.open = next ? "true" : "false";
      trigger.setAttribute("aria-expanded", String(next));
    }

    trigger.addEventListener("click", () => setOpen(!open));
    menu.addEventListener("click", (e) => {
      const opt = e.target.closest("[data-model-id]");
      if (!opt) return;
      const model = DEFAULT_MODELS.find((m) => m.id === opt.dataset.modelId);
      if (model) select(model);
      setOpen(false);
    });

    document.addEventListener("click", (e) => {
      if (!root.contains(e.target)) setOpen(false);
    });

    root.querySelector(".dq-model-selector__form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const text = prompt?.value.trim();
      if (!text) return;
      prompt.value = "";
      root.dispatchEvent(
        new CustomEvent("dq-model-submit", {
          detail: { model: selected, prompt: text },
          bubbles: true,
        })
      );
    });

    renderMenu();
    select(selected);
  }

  // --- Animated banner ---
  function initAnimatedBanner(root) {
    const countdown = root.querySelector(".dq-banner__countdown");
    if (!countdown) return;

    const target = Date.now() + 3 * 60 * 60 * 1000 + 42 * 60 * 1000;

    function pad(n) {
      return String(n).padStart(2, "0");
    }

    function tick() {
      const diff = Math.max(0, target - Date.now());
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      countdown.textContent = `${pad(h)}:${pad(m)}:${pad(s)}`;
    }

    tick();
    setInterval(tick, 1000);
  }

  // --- Sparkline ---
  function buildSparkPath(values, width, height, curve) {
    if (values.length < 2) return "";
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const step = width / (values.length - 1);
    const pts = values.map((v, i) => {
      const x = i * step;
      const y = height - ((v - min) / range) * (height - 8) - 4;
      return [x, y];
    });

    if (curve === "sharp") {
      return `M ${pts.map((p) => p.join(" ")).join(" L ")}`;
    }

    let d = `M ${pts[0][0]} ${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i];
      const p1 = pts[i + 1];
      const cx = (p0[0] + p1[0]) / 2;
      d += ` C ${cx} ${p0[1]}, ${cx} ${p1[1]}, ${p1[0]} ${p1[1]}`;
    }
    return d;
  }

  function initSparkline(root) {
    const svg = root.querySelector(".dq-sparkline__svg");
    const path = root.querySelector(".dq-sparkline__path");
    const fill = root.querySelector(".dq-sparkline__fill");
    const valueEl = root.querySelector(".dq-sparkline__value");
    const trendEl = root.querySelector(".dq-sparkline__trend");
    const curveBtns = root.querySelectorAll("[data-dq-sparkline-curve]");
    const replayBtn = root.querySelector("[data-dq-sparkline-replay]");
    if (!svg || !path) return;

    const datasets = {
      up: [8200, 8450, 9100, 8800, 10200, 11100, 12478],
      down: [12478, 11800, 11200, 10900, 9800, 9200, 8700],
    };

    let curve = "smooth";
    let dataset = "up";
    const width = 220;
    const height = 72;

    function render(replay) {
      const values = datasets[dataset];
      const d = buildSparkPath(values, width, height, curve);
      const last = values.at(-1);
      const first = values[0];
      const delta = first === 0 ? 0 : ((last - first) / first) * 100;
      const positive = delta >= 0;

      root.dataset.trend = positive ? "up" : "down";
      if (valueEl) valueEl.textContent = `$${last.toLocaleString()}`;
      if (trendEl) {
        trendEl.textContent = `${Math.abs(delta).toFixed(0)}%`;
        trendEl.dataset.direction = positive ? "up" : "down";
      }

      const fillD = `${d} L ${width} ${height} L 0 ${height} Z`;
      if (fill) fill.setAttribute("d", fillD);

      if (prefersReducedMotion()) {
        path.setAttribute("d", d);
        return;
      }

      path.style.transition = "none";
      path.setAttribute("d", d);
      const len = path.getTotalLength();
      path.style.strokeDasharray = String(len);
      path.style.strokeDashoffset = replay ? String(len) : "0";

      if (replay) {
        requestAnimationFrame(() => {
          path.style.transition = "stroke-dashoffset 980ms cubic-bezier(0.25, 1, 0.5, 1)";
          path.style.strokeDashoffset = "0";
        });
      }
    }

    curveBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        curve = btn.dataset.dqSparklineCurve || "smooth";
        curveBtns.forEach((b) => b.setAttribute("data-active", b === btn ? "true" : "false"));
        render(true);
      });
    });

    replayBtn?.addEventListener("click", () => {
      dataset = dataset === "up" ? "down" : "up";
      render(true);
    });

    render(true);
  }

  // --- Signature ---
  function initSignature(root) {
    const path = root.querySelector(".dq-signature__path");
    const replayBtn = root.querySelector("[data-dq-signature-replay]");
    if (!path) return;

    function replay() {
      path.classList.remove("is-drawing");
      void path.getBoundingClientRect();
      path.classList.add("is-drawing");
    }

    replayBtn?.addEventListener("click", replay);
    replay();
  }

  // --- Logo trace loader ---
  function initLogoTraceLoader(root) {
    const trace = root.querySelector(".dq-trace__stroke");
    const fill = root.querySelector(".dq-trace__fill");
    const panel = root.querySelector(".dq-trace__panel");
    const logoWrap = root.querySelector(".dq-trace__logo");
    const status = root.querySelector(".dq-trace__status");
    const replayBtn = root.querySelector("[data-dq-trace-replay]");
    if (!trace || !panel) return;

    let phase = "loading";

    function setPhase(next) {
      phase = next;
      root.dataset.phase = next;
      if (status) {
        status.textContent =
          next === "loading" ? "Loading" : next === "completing" ? "Completing" : "Ready";
      }
    }

    function runSequence() {
      setPhase("loading");
      root.classList.remove("is-complete");
      trace.classList.remove("is-done");
      fill?.classList.remove("is-visible");
      panel.classList.remove("is-visible");
      logoWrap?.classList.remove("is-settled");

      if (prefersReducedMotion()) {
        setPhase("ready");
        root.classList.add("is-complete");
        trace.classList.add("is-done");
        fill?.classList.add("is-visible");
        panel.classList.add("is-visible");
        logoWrap?.classList.add("is-settled");
        return;
      }

      setTimeout(() => {
        setPhase("completing");
        trace.classList.add("is-done");
        fill?.classList.add("is-visible");
      }, 2200);

      setTimeout(() => {
        setPhase("ready");
        root.classList.add("is-complete");
        panel.classList.add("is-visible");
        logoWrap?.classList.add("is-settled");
      }, 2800);
    }

    replayBtn?.addEventListener("click", runSequence);
    runSequence();
  }

  // --- Dynamic button ---
  function initDynamicButton(root) {
    const btn = root.querySelector(".dq-dynamic-btn");
    const label = root.querySelector(".dq-dynamic-btn__label");
    const measure = root.querySelector(".dq-dynamic-btn__measure");
    const demoBtn = root.querySelector("[data-dq-dynamic-demo]");
    const variantBtns = root.querySelectorAll("[data-dq-dynamic-variant]");
    if (!btn || !label || !measure) return;

    const states = [
      { text: "Save", icon: "save" },
      { text: "Copy", icon: "copy" },
      { text: "Invite teammates", icon: "users" },
      { text: "Processing", icon: "spin" },
    ];
    let index = 0;

    const icons = {
      save: '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M17 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7l-4-4Zm-5 16a3 3 0 1 1 0-6 3 3 0 0 1 0 6Zm4-8H5V5h10v6Z"/></svg>',
      copy: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
      users: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
      spin: '<svg class="dq-dynamic-btn__spin" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-3-6.7"/></svg>',
    };

    function syncWidth() {
      const styles = getComputedStyle(btn);
      const pad =
        parseFloat(styles.paddingLeft) +
        parseFloat(styles.paddingRight) +
        parseFloat(styles.borderLeftWidth) +
        parseFloat(styles.borderRightWidth);
      const gap = parseFloat(styles.gap) || 0;
      const iconEl = btn.querySelector(".dq-dynamic-btn__icon");
      const iconWidth =
        iconEl && iconEl.childElementCount > 0
          ? iconEl.getBoundingClientRect().width
          : 0;
      const contentWidth =
        measure.scrollWidth + iconWidth + (iconWidth > 0 ? gap : 0);
      btn.style.width = `${Math.ceil(contentWidth + pad)}px`;
    }

    function setState(state, animate) {
      const iconEl = btn.querySelector(".dq-dynamic-btn__icon");
      label.textContent = state.text;
      measure.textContent = state.text;
      if (iconEl) iconEl.innerHTML = icons[state.icon] || "";

      if (animate && !prefersReducedMotion()) {
        label.classList.remove("is-visible");
        requestAnimationFrame(() => {
          syncWidth();
          label.classList.add("is-visible");
        });
      } else {
        label.classList.add("is-visible");
        syncWidth();
      }
    }

    demoBtn?.addEventListener("click", () => {
      index = (index + 1) % states.length;
      setState(states[index], true);
    });

    variantBtns.forEach((vbtn) => {
      vbtn.addEventListener("click", () => {
        const variant = vbtn.dataset.dqDynamicVariant || "primary";
        btn.dataset.variant = variant;
        variantBtns.forEach((b) => b.setAttribute("data-active", b === vbtn ? "true" : "false"));
      });
    });

    setState(states[0], false);
    window.addEventListener("resize", syncWidth);
  }

  // --- Boot ---
  document.querySelectorAll("[data-dq-scramble]").forEach(initScrambleText);
  document.querySelectorAll("[data-dq-agent-dock]").forEach(initAgentDock);
  document.querySelectorAll("[data-dq-scroll-fade]").forEach(initScrollFadeList);
  document.querySelectorAll("[data-dq-model-selector]").forEach(initModelSelector);
  document.querySelectorAll("[data-dq-banner]").forEach(initAnimatedBanner);
  document.querySelectorAll("[data-dq-sparkline]").forEach(initSparkline);
  document.querySelectorAll("[data-dq-signature]").forEach(initSignature);
  document.querySelectorAll("[data-dq-trace]").forEach(initLogoTraceLoader);
  document.querySelectorAll("[data-dq-dynamic]").forEach(initDynamicButton);
})();
