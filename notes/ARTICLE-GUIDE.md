# Notes — article types & components

Use this guide when drafting or editing articles under `notes/<slug>/index.html`.

Articles share one HTML shell (head meta, header, `<article class="article">`, prev/next nav). **Type** decides which body components are required and in what order.

---

## Writing principles

House style. Two layers: **sentences** (Paul Graham) and **momentum** (King, Ferriss/McPhee, Sugarman, viral X long-form). PG alone produces bite-size aphorism stacks — polished paragraphs with nothing pulling the reader between them. The momentum layer fixes that.

### Voice (overrides everything below)

The register is **spoken, then cleaned up** — Julian explaining something to a smart friend, transcribed, with only the grammar fixed and the rambling cut. Not "an article." The test for every paragraph: could this have come out of his mouth in a conversation? If it reads like prose that was *written*, rewrite it.

- **Contractions always.** "don't", "it's", "here's". "Do not" and "that is" are article-voice.
- **Spoken connectors, not essay glue.** "So", "Okay, so", "And here's the thing", "Which is weird, right?" — the way sentences chain in speech. Never "Furthermore", "Moreover", or elegant written transitions.
- **Talk to the reader.** "you" is doing work in almost every paragraph. Rhetorical questions are fine if they're ones you'd actually ask out loud.
- **Nerd out on details, plainly.** When the topic gets technical, get *more* specific, not more decorated: exact numbers, exact mechanisms, the concrete thing that happens. Enthusiastic precision, no jargon-flexing, no cute metaphors layered on top.
- **No copywriter fragments.** Punchy three-word sentence stacks ("Zero surprise. Not luck. Fitness.") are ad copy, not speech. One is fine where a person would actually pause; a pattern of them is the tell.
- **No pull quotes, no manufactured aphorisms.** If a line sounds like it was written to be screenshotted, cut it or say it plainly.

### Sentence layer (Paul Graham)

From [Good Writing](https://www.paulgraham.com/goodwriting.html), [Write Simply](https://paulgraham.com/simply.html), and [Writing, Briefly](https://paulgraham.com/writing44.html):

- **Ordinary words, simple sentences.** The reader should notice the ideas, not the prose. Never use a fancy word where a plain one works.
- **Conversational tone.** Write the way you would explain it to a colleague. Don't try to sound impressive — it reads as clumsy, not smart.
- **Use rhythm as a correctness check.** If a sentence sounds wrong when read aloud, the idea behind it is usually wrong too. Fix both at once.
- **No adverbs, no passive voice** (King). Replace the adverb with a stronger verb. Start with the noun, then the action.
- **Show, don't tell** (King). A scene, a number, a named example — not a verdict. "DeepSeek trained V3 for $5.6M" beats "Chinese labs are efficient."

### Momentum layer (the long-form fix)

- **Decide the lead and the close first, then fill the middle** (McPhee via Ferriss). If the lead won't come, write the close and work backwards.
- **Lead formula:** open with a specific person, moment, or situation — not a thesis statement. Second paragraph is the nutgraph: why this matters now and what the reader gets if they finish. *Then* the claim.
- **The slippery slide** (Sugarman): every sentence has one job — get the next sentence read. If a sentence doesn't pull forward, it pushes away. Cut it.
- **Open loops.** Promise something early ("there's a second effect nobody prices in") and pay it off later. Always close every loop you open.
- **Vary the rhythm.** Short punches only land when longer passages set them up. If every paragraph is 1–2 clipped sentences, nothing is emphasized because everything is. Let an idea breathe for 4–6 sentences, then hit.
- **Sections connect, not stack.** The last sentence of each section should make the next section's question inevitable. If you can shuffle the sections without breaking anything, they aren't connected.
- **Personal proof.** At least one first-person story, observation, or number per major section. Verdicts without evidence read as content marketing.
- **One honest-mistakes beat.** Where the argument is weakest, say so before the reader does. It buys trust for everything else.

### Process (King's two doors)

1. **Draft with the door closed.** Fast, no self-editing, longer than needed.
2. **Rewrite with the door open.** Read as a stranger. Cut at least 10% (Sugarman cut far more). Read aloud; fix what catches.
3. **Skim test.** Read only the first line of every paragraph. The argument should still be followable — that's the mobile reader's actual path.

### Titles (the hook rule)

The title must make it impossible not to read. A descriptive title ("Constraint Makes Experts") files the idea; a hook title picks a fight with the reader's assumptions. Every article title gets tested against: would a stranger click this in a feed of 100 posts?

Directions that work:

- **Bold prediction with a date:** "In 18 months, the US will be behind Europe in AI"
- **Controversial imperative:** "Teach your kids Chinese or they won't be able to use frontier AI"
- **Concrete stakes:** name the money, the loser, or the deadline in the title itself
- **Curiosity gap** (Ferriss): don't tell the whole story — "Largest drop in home prices since 1960: the reasons, numbers, and what you can do" beats the plain fact. Prescriptive beats descriptive.

Rules: the article must actually cash the check the title writes (no bait-and-switch), and the dek carries the news peg or nuance the title omits.

### Targets

- **Flagship pieces: 1,500–3,000 words.** Simple sentences ≠ short essays. Depth and dwell time are what long-form is for.
- **Write for the 10%** (Ferriss). Make a tenth of readers love it; ignore the rest. Prescriptive beats descriptive. Evergreen beats newsy.
- **Thesis lands by the end of the lead, not necessarily line one.** The hook earns the thesis; on X only the first 2–3 lines show before "Show more".
- **One idea per section.** Verb-led titles (*Cut before you polish*, *Trust the survivors*). Never *Introduction* or *Conclusion*.
- **Close with a specific next step,** not a summary. Last line should be quotable on its own.

---

## AI-pattern checks

Run these on every article before publish. Source: Wikipedia's [Signs of AI writing](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing) (WikiProject AI Cleanup). One hit may be coincidence; clusters are the tell. Fix by rewriting the idea, not by swapping the flagged word for a synonym.

### Vocabulary (grep for these)

- [ ] **AI-vocabulary words** — `delve`, `crucial`, `pivotal`, `testament`, `tapestry`, `landscape` (abstract), `vibrant`, `robust`, `intricate`, `interplay`, `meticulous`, `boasts`, `showcase`, `underscore`/`highlight`/`emphasize` (as verbs), `foster`, `enhance`, `garner`, `enduring`, `valuable insights`, `align with`, `Additionally` (sentence-initial). Zero tolerance in clusters; one or two only if genuinely the best word.
- [ ] **Copula avoidance** — `serves as`, `stands as`, `marks a`, `functions as`, `represents a`, `refers to`, `features`/`offers` (meaning "has"). Just write "is", "are", "has".
- [ ] **Vague attributions** — `experts argue`, `observers have cited`, `industry reports`, `some critics say`. Name the source or cut the claim.

### Sentence patterns (read for these)

- [ ] **Negative parallelisms** — "not just X, but Y", "It's not X, it's Y", "X rather than Y". Max one per article, and only if it earns its place.
- [ ] **Rule of three** — "adjective, adjective, adjective" or three parallel short phrases. LLMs use it to fake comprehensiveness. Break the triple: two items or four, or one developed properly.
- [ ] **Superficial "-ing" analysis tails** — sentences ending in ", highlighting...", ", reflecting...", ", contributing to...", ", ensuring...". Cut the tail or make the claim its own sentence with evidence.
- [ ] **Significance inflation** — "marks a pivotal moment", "key turning point", "broader trends/debates", "lasting legacy", "evolving landscape". If the thing matters, show why with a specific; don't assert importance.
- [ ] **Elegant variation** — calling the same thing by a new synonym every mention to avoid repetition. Pick one name and repeat it; repetition is honest.
- [ ] **Promotional tone** — "nestled", "rich heritage", "commitment to", "natural beauty", press-release cadence. Read each descriptive sentence and ask: would a skeptic write this?

### Structure and style

- [ ] **Em-dash density** — LLMs overuse em dashes. Budget: roughly one per 150–200 words. Replace the rest with periods, commas, or parentheses.
- [ ] **Bold overuse** — bold at most one phrase per section; never bold mid-sentence decorations.
- [ ] **Inline-header vertical lists** — bullets shaped "**Label**: explanation" repeated 4+ times read as generated. Convert to prose or a real table.
- [ ] **Title case headings** — sentence case for `<h2>`s.
- [ ] **Outline-like conclusions** — closing sections about "challenges and future prospects" or summary recaps. The close should add something, not recap.
- [ ] **Phrasal templates** — "In this article, we will explore...", "In conclusion", "It's important to note/remember". Delete on sight.

### How to run it

1. Grep the draft for the vocabulary lists above (case-insensitive).
2. Read the full piece once looking only for the sentence patterns — ignore meaning on this pass.
3. Count em dashes and bolds; compare against budget.
4. Anything flagged: rewrite the underlying idea in your own words. If a flagged phrase survives review, it should be because you'd defend it out loud.

---

## Liveliness rules

These come from the structure patterns in Emil Kowalski's UI essays. Treat them as hard constraints for article pacing and block usage.

- **Density:** target at least 1 non-prose element per ~120 words (roughly every 2–3 paragraphs). Never let plain prose run for 4+ paragraphs without a visual break.
- **Diversity:** use at least 4 distinct element types in each article. Avoid overusing one block type for more than half of all elements.
- **Show-then-tell:** introduce an element in one sentence, render it, then explain what to notice.
- **Captions:** add a one-line muted caption below every block element with `<p class="element-caption">...</p>`.
- **Interaction:** include at least one interactive block (banner close, copyable block, sparkline controls, Mermaid, toast button).
- **Chips in prose:** use `code.code-chip` whenever you name a file, property, command, or module.
- **Close with momentum:** end with a CTA, related-link banner, or copyable artifact that gives the reader a next step.

---

## Article types

| Type | When to use | Examples |
|------|-------------|----------|
| **Principle** | A craft opinion or design lesson — no “we shipped” story | e.g. an essay on perceived speed or restraint in design |
| **Playbook** | A system others can adopt — rules, protocols, filing logic | *Why Memory Management Is Important for Your AI Agent* |
| **Case study** | What you built/changed and why — before → after | *How We Improved Our AI Agent in Slack by Making It Dumber* |

Pick one type per article. Do not blend case study and playbook in one piece — split if both are needed.

**Visual templates:** open `/notes/_templates/` locally. Each template is a complete sample article written in the house style — copy the folder, replace the prose with yours, keep the structure.

| Template | Sample article | Path |
|----------|----------------|------|
| Principle | *Delete Half* | `notes/_templates/principle/index.html` |
| Playbook | *One Place for Every Decision* | `notes/_templates/playbook/index.html` |
| Case study | *We Replaced Our Dashboard with a Text File* | `notes/_templates/case-study/index.html` |

---

## Component library (from `components.html`)

**Hard rule: articles may only use components that exist in the library.** No one-off markup, no inline `<style>` blocks, no article-local CSS. If an article needs a visual the library lacks, first check whether an existing component is close enough (a `plan-table` instead of a custom comparison grid, a `dq-sparkline` instead of a custom trend line). Only if nothing similar exists: add the component to `components.css` and a specimen to `components.html` first, then use it in the article.

Articles that use interactive or styled blocks need these assets in `<head>` and before `</body>`:

```html
<link rel="stylesheet" href="/components.css" />
<!-- before </body>: -->
<div class="toaster" id="toaster"></div>
<script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script> <!-- only if Mermaid -->
<script src="/components.js"></script>   <!-- copy buttons, banner, Mermaid init -->
<script src="/exploration.js"></script>  <!-- only if sparkline -->
```

Preview every block at `/components.html` (the hidden component library).

| Component | Class / markup | Best for |
|-----------|----------------|----------|
| Announcement banner | `.banner` | Related note, series, CTA at top |
| Inline code chip | `code.code-chip` | File names, modules, config keys in prose |
| Install code | `.install-code` | Single-line `npm install` |
| Command snippet | `.idx-command` | CLI with caption |
| Code block | `.code-block` | Protocols, configs — copy via `data-copy` |
| Index list | `.idx-list` | Wiki paths, routing matrix, monospace sitemap |
| Sparkline | `.dq-sparkline` | Before/after metric (needs `exploration.js`) |
| Bar chart | `.bar-chart` | Grouped horizontal comparisons (benchmarks, timings) |
| Architecture diagram | `.arch-diagram` + `pre.mermaid` | Sequence flows (needs Mermaid CDN) |
| Symptom table | `.plan-table` | Symptom → cause debugging tables |

**Copy blocks:** set `data-copy` on `.install-code`, `.idx-command`, or `.code-block` with `&#10;` for newlines. Use `data-copy-btn` on the button inside.

**By type:**

- **Principle** — `banner`, `code-block`, `article-figure` or `video-preview`, optional `dq-sparkline`
- **Playbook** — `plan-table`, `idx-list`, `install-code`, `idx-command`, `code-block`, optional `arch-diagram`, `banner`
- **Case study** — `plan-table`, `arch-diagram`, `idx-list`, `code-block`, `dq-sparkline`, `article-figure` or `video-preview`, `banner`

Each block should usually be followed by `<p class="element-caption">...</p>` unless the block already includes a built-in caption element.

---

## Shared components (every article)

| Component | Class / element | Required |
|-----------|-----------------|----------|
| Title | `<h1>` | Yes |
| Lead | 1–3 `<p>` before first `<h2>` | Yes |
| Sections | `<h2>` + prose | Yes (≥2) |
| Prev / next | `<nav class="article-nav">` | Yes |
| Meta + OG | `<head>` title, description, canonical, og:* | Yes |

**Lead rules:** State the thesis in the first paragraph. Second paragraph narrows scope or stakes. Do not put a `<h2>` before the reader knows why they are reading.

---

## Type-specific components

### Principle

**Goal:** Reader leaves with one memorable idea and 2–3 concrete moves.

| Order | Component | Required |
|-------|-----------|----------|
| 1 | `<h1>` | Yes |
| 2 | Lead (thesis) | Yes |
| 3 | `<h2>` sections — one idea each | Yes |
| 4 | Inline `<code>` or short `<pre>` example | If teaching a technique |
| 5 | Closing `<p>` with the one-line lesson | Yes |
| 6 | `article-nav` | Yes |

**Optional:** `.article-dek`, figure.

**Quotes:** Never use the `pull-quote` component. If quoting someone is worth it, embed a screenshot of the actual tweet or source as an `article-figure`; otherwise leave the quote out.

**Section naming:** Prefer verb-led or noun-led titles (*Respond before you finish*, *Keep motion honest*). Avoid *Introduction* / *Conclusion*.

---

### Playbook

**Goal:** Reader can implement the system — knows where things live, when to pause, what never to do.

| Order | Component | Required |
|-------|-----------|----------|
| 1 | `<h1>` | Yes |
| 2 | `.article-dek` — subtitle with the human hook | Yes |
| 3 | `.article-meta` — type badge `Playbook` | Recommended |
| 4 | `.article-tldr` — 3 bullets max | Recommended |
| 5 | `<h2>` The problem | Yes |
| 6 | `<h2>` The system — overview of where truth lives | Yes |
| 7 | `<h2>` Rules / protocol — spec text in a `.code-block` | Yes |
| 8 | `<h2>` Workflow — numbered `<ol>` | If steps matter |
| 9 | `<h2>` What changed in practice | Yes |
| 10 | `article-nav` | Yes |

**Protocol text:** Put the spec in a copyable `.code-block` (see component library). Hard constraints go in prose — one short paragraph, stated plainly.

---

### Case study

**Goal:** Reader understands the bet, the architecture, and the outcome — and can steal the pattern.

| Order | Component | Required |
|-------|-----------|----------|
| 1 | `<h1>` | Yes |
| 2 | `.article-dek` | Yes |
| 3 | `.article-meta` — type badge `Case study` | Recommended |
| 4 | Lead — hook + the counterintuitive fix | Yes |
| 5 | `<h2>` Failure mode / before state | Yes |
| 6 | `<h2>` The approach — what you reduced or restructured | Yes |
| 7 | Architecture — `arch-diagram`, `<pre>`, or list | Yes |
| 8 | `<h2>` What we removed / what we kept | If subtraction story |
| 9 | `<h2>` What changed — channel, metrics, trust | Yes |
| 10 | Closing — generalizable lesson (1 `<p>`) | Yes |
| 11 | `article-nav` | Yes |

**Voice:** Past tense for what you did; present tense for the lesson.

---

## Component reference (HTML)

### Type badge + dek

```html
<div class="article-meta">
  <span class="article-type">Playbook</span>
</div>
<h1>Why Memory Management Is Important for Your AI Agent</h1>
<p class="article-dek">How we turned our lazy AI assistant into a Type A person.</p>
```

### TL;DR

```html
<aside class="article-tldr" aria-label="Summary">
  <span class="article-tldr__label">TL;DR</span>
  <ul>
    <li>Wiki is source of truth; agent files hold references only.</li>
    <li>Pause and classify before every memory write.</li>
    <li>One <code>user.md</code> per person, keyed by Slack ID.</li>
  </ul>
</aside>
```

---

## Checklist before publish

- [ ] One type chosen; required components for that type present
- [ ] `description` and `og:description` match the dek or first sentence
- [ ] Slug is kebab-case; folder `notes/<slug>/index.html`
- [ ] Listed on `notes/index.html` and homepage Writing section
- [ ] Prev/next nav links updated on adjacent articles
- [ ] No inline styles on dek (use `.article-dek`)
- [ ] Code blocks only for specs, configs, or copy-pasteable examples — not prose

---

## File checklist (new article)

1. Copy from `notes/_templates/<type>/` → `notes/<slug>/index.html`
2. `notes/index.html` — add list item (newest first)
3. `index.html` — Writing section list item
4. Neighbor article — update `article-nav` link
5. Remove `.banner__template` (and optional CTA copy) from the banner before publish

See `.cursor/rules/articles.mdc` for agent-facing rules when editing `notes/**`.
