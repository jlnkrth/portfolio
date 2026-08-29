# How serious WYSIWYG editors are built

Research against primary sources (official docs and source code) into how ProseMirror, Lexical, Slate, Quill, CKEditor 5, Tiptap, and Editor.js are architected — and what our hand-rolled `editor.js` should borrow. Compiled 2026-07-17. Every claim cites the source that owns it.

## TL;DR

Every mature editor reaches the same conclusion: **the DOM is never the source of truth.** They all keep an internal document model, funnel every change through an explicit operation/transaction layer, represent the caret as a position *in the model* (not a live DOM Range), re-render the DOM from the model, and only *tolerate* the browser's native contenteditable behavior for plain typing — detecting what the browser did (via MutationObserver and/or `beforeinput`) and re-expressing it as a model change. Structural edits (Enter, Backspace-at-start, block insertion) are never left to the browser; they are preventDefault-ed and executed as model operations. Editor.js is the one exception that, like ours, uses one contenteditable per block — but even it owns a JSON block model and never round-trips HTML.

The bug class we hit (paragraph truncated when the slash menu opened) is exactly what the model-first architecture exists to prevent: our block content only exists in the DOM, so any DOM surgery done with a stale or half-collapsed selection destroys data with no way back.

---

## ProseMirror

**Sources:** [ProseMirror Guide](https://prosemirror.net/docs/guide/) (all quotes below), [prosemirror-view `domobserver.ts` source](https://github.com/ProseMirror/prosemirror-view/blob/master/src/domobserver.ts).

### Source of truth

The document "isn't a blob of HTML, but a custom data structure that only contains elements that you explicitly allow it to contain … All updates go through a single point, where you can inspect them and react to them" ([Guide, Introduction](https://prosemirror.net/docs/guide/)). Documents are immutable values: "every time you update a document, you get a new document value," which shares unchanged sub-nodes with the old one and "makes it impossible to have an editor in an invalid in-between state during an update" ([Guide, Identity and persistence](https://prosemirror.net/docs/guide/)).

Inline content is stored as a *flat sequence* with marks (bold, em, link) attached as metadata, not as a nested tag tree — so "each document has one valid representation" and positions are character offsets, not tree paths ([Guide, Structure](https://prosemirror.net/docs/guide/)).

### Model ↔ DOM sync

The view renders the state's document into a contenteditable element and treats it as an input/output surface. For typing, the browser is deliberately allowed to act first: "Even typing is usually left to the browser, because interfering with that tends to break spell-checking, autocapitalizing on some mobile interfaces … When the browser updates the DOM, the editor notices, re-parses the changed part of the document, and translates the difference into a transaction" ([Guide, Editable DOM](https://prosemirror.net/docs/guide/)). The "noticing" is a `MutationObserver` configured with `childList`, `characterData`, `attributes`, and `subtree`, whose records are mapped back to document positions and handed to `handleDOMChange` ([domobserver.ts](https://github.com/ProseMirror/prosemirror-view/blob/master/src/domobserver.ts)). Updates in the other direction diff old doc vs. new doc and touch only the changed DOM ([Guide, Efficient updating](https://prosemirror.net/docs/guide/)).

### Transactions, steps, position mapping

Every change is a **transaction** built from **steps** (`ReplaceStep`, `AddMarkStep`…). Steps are small and invertible so the undo history "can save these steps and apply their inverse," and collab "sends these steps to other editors" ([Guide, Transforms/Why?](https://prosemirror.net/docs/guide/)). Crucially, each step yields a **position map**, and transforms accumulate a `Mapping`, so any position (e.g. the selection, a decoration) can be carried across a document change instead of going stale ([Guide, Mapping](https://prosemirror.net/docs/guide/)).

### Selection

Selection is part of the immutable editor state (`doc`, `selection`, `storedMarks`), represented as model positions with `anchor`/`head` ([Guide, The editor state / Selection](https://prosemirror.net/docs/guide/)). By default a transaction maps the old selection through each step to produce the new one ([Guide, Transactions](https://prosemirror.net/docs/guide/)). The DOM selection is only rewritten "when it is actually out of sync with the selection in the state," to avoid disturbing hidden browser selection state ([Guide, Efficient updating](https://prosemirror.net/docs/guide/)).

### Enter / Backspace / menus

Editing actions are **commands**: functions `(state, dispatch) => boolean` that either dispatch a transaction or return false so the next handler runs. Backspace is a command chain — `deleteSelection`, then `joinBackward` (block merge at textblock start), then `selectNodeBackward` — and only "when none of these apply, the browser is allowed to run its own backspace behavior" ([Guide, Commands](https://prosemirror.net/docs/guide/)). UI that lives inside the document without being document content (like a slash-menu anchor) is a **widget decoration**: "Widget decorations insert a DOM node, which isn't part of the actual document, at a given position" ([Guide, Decorations](https://prosemirror.net/docs/guide/)).

### Browser quirks

`domobserver.ts` is a catalog of why raw contenteditable can't be trusted: IE11 firing mutation callbacks *before* the DOM updates; Safari inserting "inappropriate nodes in the table row" when a composition ends in a table cell (with a dedicated `fixUpBadSafariComposition` repair function); browsers inserting "a bogus break node if you backspace out the last bit of text before an inline-flex node"; Firefox producing duplicate `<br>`s that must be manually removed ([domobserver.ts source](https://github.com/ProseMirror/prosemirror-view/blob/master/src/domobserver.ts)).

### Serialization

The schema declares `toDOM` per node/mark (e.g. `["p", 0]` where `0` is the content hole) and `parseDOM` rules (CSS-selector based) for the reverse; `DOMParser.fromSchema` builds the HTML→model parser used for initial load and paste. Documents also have a built-in JSON round-trip via `toJSON` / `nodeFromJSON` ([Guide, Serialization and Parsing](https://prosemirror.net/docs/guide/)).

---

## Lexical (Meta)

**Sources:** [Introduction](https://lexical.dev/docs/intro), [Editor State](https://lexical.dev/docs/concepts/editor-state), [Selection](https://lexical.dev/docs/concepts/selection), [Nodes](https://lexical.dev/docs/concepts/nodes), [@lexical/html](https://lexical.dev/docs/packages/lexical-html), [LexicalEvents.ts source](https://github.com/facebook/lexical/blob/main/packages/lexical/src/LexicalEvents.ts).

### Source of truth

"With Lexical, the source of truth is not the DOM, but rather an underlying state model that Lexical maintains." The docs open with the motivating example: `<i><b>Lexical</b></i>`, `<i><b>Lex</b><b>ical</b></i>` and `<b><i>Lexical</i></b>` all render identically — HTML is "way too flexible" for editing, so Lexical stores a canonical flat node tree with formatting as attributes ([Editor State](https://lexical.dev/docs/concepts/editor-state)).

### Double buffering and the reconciler

An `EditorState` (node tree + selection) is immutable after reconciliation. `editor.update()` clones the current state into a work-in-progress "pending" state: "There's the 'current' frozen editor state to represent what was most recently reconciled to the DOM, and another work-in-progress 'pending' editor state that represents future changes for the next reconciliation" — explicitly called double-buffering ([Editor State, Updating state](https://lexical.dev/docs/concepts/editor-state)). Lexical's own **DOM reconciler** then diffs current vs. pending "and uses this diff to update only the parts of the DOM that need changing … a kind-of virtual DOM, except Lexical is able to skip doing much of the diffing work, as it knows what was mutated" ([Introduction, DOM Reconciler](https://lexical.dev/docs/intro)).

### Node keys

Every node has a stable, runtime-only **NodeKey**; "All versions of a logical node have the same key" across state snapshots, and node methods locate the latest version of themselves in the active state via that key. Mutation goes through `node.getWritable()`, which clones the frozen node ([Editor State, Reading and Updating](https://lexical.dev/docs/concepts/editor-state); [Nodes, Node Properties](https://lexical.dev/docs/concepts/nodes)).

### Selection

Selection is part of the EditorState, so "for every update … the selection always remains consistent with that of the EditorState's node tree." A `RangeSelection` has `anchor`/`focus` points made of `{key, offset, type}` — the node's key plus an offset, not a DOM node reference. The Lexical selection "is reconciled to the DOM selection during reconciliation" ([Selection](https://lexical.dev/docs/concepts/selection)).

### Input handling and commands

Lexical attaches to one contenteditable root and handles input through DOM events including `beforeinput`; the events source reads `event.getTargetRanges()` and dispatches semantic commands — e.g. the `insertParagraph` input type is handled as a command case, not left to the browser ([LexicalEvents.ts](https://github.com/facebook/lexical/blob/main/packages/lexical/src/LexicalEvents.ts), see the `'beforeinput'` listener, `getTargetRanges()` use, and `case 'insertParagraph'`). Commands are the wiring system: "Lexical dispatches commands internally when key presses are triggered," and handlers are registered with priorities, propagating until one stops it ([Introduction, Commands](https://lexical.dev/docs/intro)).

### Serialization

EditorStates are "fully serializable to JSON" (`editor.parseEditorState()` for the reverse), with each node implementing `exportJSON`/`importJSON` ([Editor State](https://lexical.dev/docs/concepts/editor-state); [Nodes](https://lexical.dev/docs/concepts/nodes)). HTML is a separate lossy-ish pipeline: `@lexical/html` exports `$generateHtmlFromNodes` and `$generateNodesFromDOM` (parse HTML with `DOMParser` first), the same functions the clipboard package uses ([@lexical/html](https://lexical.dev/docs/packages/lexical-html)).

---

## Slate

**Sources:** [Introduction](https://docs.slatejs.org/), [Locations](https://docs.slatejs.org/concepts/03-locations), [Operations](https://docs.slatejs.org/concepts/05-operations), [Commands](https://docs.slatejs.org/concepts/06-commands), [Normalizing](https://docs.slatejs.org/concepts/11-normalizing).

### Source of truth

Slate is "a pluggable implementation of `contenteditable` built on top of React" with a schema-less, nested JSON document model that parallels the DOM ("the document is a nested tree, it uses selections and ranges") but is owned by the editor, rendered through React ([Introduction](https://docs.slatejs.org/)).

### Selection

Positions are model coordinates: a `Path` is an array of child indexes (`[0, 0]`), a `Point` is `{path, offset}`, a `Range` is `{anchor, focus}`, and the selection is just a `Range` stored on the top-level `Editor` object. "Points always refer to text nodes," which "simplifies working with ranges as there are fewer edge cases" compared to the DOM ([Locations](https://docs.slatejs.org/concepts/03-locations)).

### Commands → operations

High-level intent is expressed as **commands** (`Editor.insertBreak(editor)`, `Editor.deleteBackward(editor, {unit: 'word'})`) which "never need to define a location … because they always act on the user's current selection." Slate defines its own command layer "because the DOM's version [`execCommand`] is too opinionated and inconsistent" ([Commands](https://docs.slatejs.org/concepts/06-commands)). Under the hood every command decomposes into low-level **operations** — `insert_text`, `remove_node`, `set_selection`, etc. — each "easily define-able, apply-able, compose-able and even undo-able," which is what makes collaborative editing possible ([Operations](https://docs.slatejs.org/concepts/05-operations)).

### Normalization

Slate's most distinctive contribution: after operations run, `normalizeNode` repairs the tree until it's valid, multi-pass ("you only ever have to worry about fixing a single issue at once"). Built-in constraints include: every element must contain at least one text descendant "to ensure that the selection's anchor and focus points … can always be placed inside any node"; adjacent identical text nodes merge; blocks contain either blocks or inlines, never both — because that's what makes "splitting a block in two" behave consistently ([Normalizing](https://docs.slatejs.org/concepts/11-normalizing)).

---

## Quill

**Sources:** [Designing the Delta Format](https://quilljs.com/guides/designing-the-delta-format), [Parchment README](https://github.com/slab/parchment) ([raw](https://raw.githubusercontent.com/slab/parchment/main/README.md)).

### Delta: one format for documents *and* changes

"Quill is the first rich text editor to actually understand its own contents" — other editors "just pass the user HTML, along with the burden of parsing and interpreting this," and that interpretation "will differ from those of major browser vendors" ([Delta guide](https://quilljs.com/guides/designing-the-delta-format)). A Delta is a JSON array of ops (`insert`, `retain`, `delete`) with `attributes` for formatting. Two constraints make it reliable: **compact** (no redundant splits) and **canonical** ("there cannot be two unequal Deltas that represent the same content" — deep-compare equals content-compare). Line formats attach to the newline character; every document ends in `\n`; embeds are always length 1. The same format describes a document (a change against the empty document) and an edit ([Delta guide](https://quilljs.com/guides/designing-the-delta-format)).

### Parchment: the DOM-mirror tree

Parchment is "Quill's document model … a parallel tree structure to the DOM tree" made of **Blots**, each of which owns a `domNode` ([Parchment README](https://github.com/slab/parchment)). Two details are directly relevant to us:

- **Selection mapping is a first-class Blot API**: leaf blots implement `index(node, offset)` (DOM position → linear document index) and `position(index)` (index → `[node, offset]` consumable by a DOM Range) ([Parchment README, Blots](https://github.com/slab/parchment)).
- **DOM changes flow back through mutations**: blots implement `update(mutations: MutationRecord[], context)` — "Called when blot changes, with the mutation records of its change" — i.e. Quill watches the DOM with a MutationObserver and lets each blot reinterpret what the browser did, plus an `optimize()` pass after each update cycle that must "reduce complexity of the DOM tree" ([Parchment README, Blots](https://github.com/slab/parchment)).

---

## CKEditor 5

**Source:** [Editing engine architecture](https://ckeditor.com/docs/ckeditor5/latest/framework/architecture/editing-engine.html).

### Three layers, two views

The engine is MVC with a **model** (the data), a **view** layer, and **conversion** between them. There is *one* model document converted into *two* virtual-DOM-like views: the **editing view** (what the user sees in contenteditable) and the **data view** (input/output format). "The views are rendered to the DOM by the `ViewRenderer`, which handles all the quirks required to tame `contentEditable` used in the editing pipeline" ([Editing engine, View](https://ckeditor.com/docs/ckeditor5/latest/framework/architecture/editing-engine.html)).

### Model details

The model is a tree where text nodes carry attributes (`"bar"` with `bold=true` instead of a `<strong>` element), which "significantly reduces the complexity of algorithms working with the model." The doc calls out the exact ambiguity that bites DOM-based editors: with a caret at `"Foo ^bar"` before a `<strong>`, native DOM selection can report the position anchored either inside or outside the tag; the model has exactly one representation. Positions are `(path of offsets)`; a document-wide `ModelDocumentSelection` "is automatically kept in sync when the document structure changes" ([Editing engine, Model](https://ckeditor.com/docs/ckeditor5/latest/framework/architecture/editing-engine.html)).

### Writer-only mutation, operations, schema

"You can only change the document structure, selection, and create elements using the model writer" inside `change()` blocks; "All document structure changes happen through operations. This concept comes from Operational Transformation," and operations are grouped into batches that act as single undo steps ([Editing engine, Changing the model](https://ckeditor.com/docs/ckeditor5/latest/framework/architecture/editing-engine.html)). A **schema** defines what's allowed where and drives paste filtering, feature enablement, and where the selection may be placed ([Editing engine, Schema](https://ckeditor.com/docs/ckeditor5/latest/framework/architecture/editing-engine.html)).

### DOM events and conversion

Native DOM events are wrapped by **observers** (`MutationObserver`, `SelectionObserver`, `KeyObserver`, `CompositionObserver`, …) that fire abstracted events on the view document — "Ideally, an event's consumer should not have any access to the native DOM" ([Editing engine, Observers](https://ckeditor.com/docs/ckeditor5/latest/framework/architecture/editing-engine.html)). Data flows through named conversions: **upcasting** (HTML → view → model, on load and paste) and **downcasting** (model → view → HTML/rendered DOM); there is no "editing upcasting" — user actions are analyzed by features which apply changes *to the model* ([Editing engine, Conversion](https://ckeditor.com/docs/ckeditor5/latest/framework/architecture/editing-engine.html)).

---

## Tiptap (briefly)

**Source:** [Tiptap overview](https://tiptap.dev/docs/editor/getting-started/overview).

Tiptap invents no new editing architecture: it "wraps the proven ProseMirror library in a modern, framework-agnostic API" and "under the hood … heavily relies on Events, Commands, and Extensions." Its value-add is packaging — an extension system (StarterKit, tables, slash menus), framework bindings (React/Vue/Svelte), and paid collaboration/AI features on top ([Tiptap overview](https://tiptap.dev/docs/editor/getting-started/overview)). Everything said about ProseMirror's model, transactions, and DOM handling applies unchanged.

---

## Editor.js (architecturally closest to ours)

**Sources:** [Base concepts](https://editorjs.io/base-concepts/), [Saving data](https://editorjs.io/saving-data/).

Editor.js validates the per-block approach — with a critical difference from our implementation. "The Editor.js workspace consists of separate Blocks: paragraphs, headings, images, lists, quotes, etc. Each of them is an independent `contenteditable` element (or more complex structure) provided by Plugin and united by Editor's Core," explicitly motivated by the bugs of single-contenteditable editors ("permanent bugs with moving text fragments … while page parts are jumping and twitches") ([Base concepts](https://editorjs.io/base-concepts/)).

But its output is **not the DOM's HTML**: `editor.save()` asks every block tool to produce clean data and returns `{time, blocks: [{id, type, data}], version}` JSON — "clean data output instead of HTML-markup" ([Base concepts](https://editorjs.io/base-concepts/); [Saving data](https://editorjs.io/saving-data/)). Each block owns its own (de)serialization, so a corrupted DOM inside one block can't silently corrupt the document container structure or other blocks. The per-block contenteditable choice limits the blast radius of browser weirdness; the JSON model keeps the saved artifact independent of whatever the browser did to the DOM.

---

## Comparison table

| | Source of truth | DOM→model sync | Caret representation | Structural edits | Serialization |
|---|---|---|---|---|---|
| **ProseMirror** | Immutable node tree + schema ([guide](https://prosemirror.net/docs/guide/)) | Browser types first, MutationObserver + re-parse → transaction ([guide](https://prosemirror.net/docs/guide/); [domobserver.ts](https://github.com/ProseMirror/prosemirror-view/blob/master/src/domobserver.ts)) | Model positions (integers), mapped through every step ([guide](https://prosemirror.net/docs/guide/)) | Commands dispatch transactions of invertible steps ([guide](https://prosemirror.net/docs/guide/)) | Schema `toDOM`/`parseDOM` + JSON `toJSON`/`nodeFromJSON` ([guide](https://prosemirror.net/docs/guide/)) |
| **Lexical** | Immutable EditorState, double-buffered ([docs](https://lexical.dev/docs/concepts/editor-state)) | `beforeinput` + events → commands → pending state; own reconciler writes DOM ([intro](https://lexical.dev/docs/intro); [source](https://github.com/facebook/lexical/blob/main/packages/lexical/src/LexicalEvents.ts)) | `{nodeKey, offset}` points inside EditorState ([docs](https://lexical.dev/docs/concepts/selection)) | Commands with priorities; updates batched then reconciled ([intro](https://lexical.dev/docs/intro)) | JSON per node (`exportJSON`); HTML via `@lexical/html` ([docs](https://lexical.dev/docs/packages/lexical-html)) |
| **Slate** | Plain JS/JSON tree rendered by React ([intro](https://docs.slatejs.org/)) | React renders model; input becomes commands → operations | `{path, offset}` points; selection is a model Range ([docs](https://docs.slatejs.org/concepts/03-locations)) | Commands → granular operations + multi-pass normalization ([ops](https://docs.slatejs.org/concepts/05-operations); [normalizing](https://docs.slatejs.org/concepts/11-normalizing)) | Model *is* JSON; HTML (de)serializers user-defined ([intro](https://docs.slatejs.org/)) |
| **Quill** | Delta (linear ops) + Parchment blot tree mirroring DOM ([delta](https://quilljs.com/guides/designing-the-delta-format); [parchment](https://github.com/slab/parchment)) | MutationRecords delivered to each blot's `update()` ([parchment](https://github.com/slab/parchment)) | Linear index; blots map `index()`↔`position()` to DOM ([parchment](https://github.com/slab/parchment)) | Delta ops (insert/retain/delete), canonical + compact ([delta](https://quilljs.com/guides/designing-the-delta-format)) | Delta JSON is the format; HTML derived from DOM/blots |
| **CKEditor 5** | Model tree with attributed text; separate editing + data views ([docs](https://ckeditor.com/docs/ckeditor5/latest/framework/architecture/editing-engine.html)) | Observers abstract DOM events; features write to model via writer; downcast re-renders ([docs](https://ckeditor.com/docs/ckeditor5/latest/framework/architecture/editing-engine.html)) | Model positions (offset paths); document selection auto-synced ([docs](https://ckeditor.com/docs/ckeditor5/latest/framework/architecture/editing-engine.html)) | OT-style operations in batches, writer-only mutation ([docs](https://ckeditor.com/docs/ckeditor5/latest/framework/architecture/editing-engine.html)) | Upcast/downcast conversion pipelines to data view/HTML ([docs](https://ckeditor.com/docs/ckeditor5/latest/framework/architecture/editing-engine.html)) |
| **Editor.js** | JSON block list; each block tool owns its data ([docs](https://editorjs.io/base-concepts/)) | Per-block contenteditable; block tool interprets its own DOM | Native, scoped per block | Core handles block-level ops; tools handle in-block | `save()` → `{blocks:[{id,type,data}]}` JSON ([docs](https://editorjs.io/saving-data/)) |
| **Ours (`editor.js`)** | The live DOM itself | None — DOM *is* the model | Live DOM Range read ad hoc | keydown + direct DOM surgery | `clone.innerHTML` on save |

---

## What our `editor.js` should borrow

Our editor makes each block contenteditable, mutates the DOM directly on keydown, and serializes `innerHTML` on save. That's workable for a local tool, but the truncation bug shows the failure mode: content only exists in the DOM, so one bad Range operation loses data permanently. Ranked recommendations, smallest first:

### 1. Snapshot before every structural change (cheapest, do first)

ProseMirror steps are invertible precisely so any change can be undone ([guide, Transforms](https://prosemirror.net/docs/guide/)); Lexical keeps the previous frozen EditorState around by design ([docs](https://lexical.dev/docs/concepts/editor-state)). Our minimal equivalent: before `splitBlock`, `removeEmptyBlock`, the Backspace-at-start path, or opening the slash menu, push `{block, beforeHTML: block.innerHTML, caretOffset}` onto a journal. That gives Cmd-Z for structural edits and turns "truncated mid-word" from data loss into an undo. This is the single highest-leverage change.

### 2. Represent the caret as `(block, character offset)`, never as a held DOM Range

Every editor studied stores selection in model coordinates and *derives* the DOM selection: ProseMirror maps positions through each step ([guide](https://prosemirror.net/docs/guide/)), Lexical uses `{key, offset}` ([docs](https://lexical.dev/docs/concepts/selection)), Slate uses `{path, offset}` ([docs](https://docs.slatejs.org/concepts/03-locations)), Parchment blots convert with `index()`/`position()` ([README](https://github.com/slab/parchment)). Our `splitBlock` builds a tail Range from a live selection and extracts it — if the selection moved (focus shift to the slash menu input, an async re-render), the extraction cuts the wrong content. Write two helpers, `caretToOffset(block)` and `offsetToCaret(block, n)` (walk text nodes), capture the offset *at keydown time*, and pass the number around instead of Range objects.

### 3. Make structural edits explicit, pure operations

All five main editors funnel Enter/Backspace into named commands operating on state: ProseMirror's `joinBackward` chain ([guide, Commands](https://prosemirror.net/docs/guide/)), Slate's `insertBreak`/`deleteBackward` ([docs](https://docs.slatejs.org/concepts/06-commands)), Lexical's `insertParagraph` command case ([source](https://github.com/facebook/lexical/blob/main/packages/lexical/src/LexicalEvents.ts)), CKEditor's writer-only mutation ([docs](https://ckeditor.com/docs/ckeditor5/latest/framework/architecture/editing-engine.html)). For us: `splitBlockAt(block, offset)`, `mergeWithPrevious(block)`, `replaceBlock(block, html)` — each takes explicit inputs (never reads `getSelection()` internally), snapshots first (rec 1), mutates, then restores the caret via rec 2. Keydown handlers become thin dispatchers.

### 4. Keep the slash menu out of the block's content path

ProseMirror renders menu anchors as widget decorations — "a DOM node, which isn't part of the actual document" ([guide, Decorations](https://prosemirror.net/docs/guide/)); Lexical isolates arbitrary UI in DecoratorNodes ([docs](https://lexical.dev/docs/concepts/nodes)). Our menu is already a floating element, which is right — but `openSlashMenu` runs entangled with block creation/replacement (`slashParagraphFrom` converts the current block first, `splitBlock` opens it mid-flow). Sequence it strictly: complete and verify the block operation, restore the caret, *then* position the menu from the block's rect. The menu must never run while a Range extraction is in flight, and closing it must not mutate the anchor block beyond removing a placeholder.

### 5. Add a normalize pass after structural edits

Slate runs `normalizeNode` repeatedly until the tree is valid — e.g. every element keeps at least one text child so the selection always has somewhere to land ([docs](https://docs.slatejs.org/concepts/11-normalizing)); Parchment's `optimize()` must "reduce complexity of the DOM tree" after every update ([README](https://github.com/slab/parchment)). Ours would be ~20 lines: after any operation, for each touched block strip empty text nodes and stray `<br>`s at block edges, collapse whitespace-only blocks to truly empty (we partially do this in `splitBlock` already), ensure no nested `contenteditable`, and ensure every editable block is non-collapsed. Run it in one place instead of scattered special cases.

### 6. Prefer `beforeinput` over keydown for intercepting edits

Lexical handles editing through `beforeinput`, reading `event.getTargetRanges()` for the exact affected range and switching on semantic `inputType` values like `insertParagraph` ([source](https://github.com/facebook/lexical/blob/main/packages/lexical/src/LexicalEvents.ts)). For us, `beforeinput` with `inputType === "insertParagraph"` / `"deleteContentBackward"` is more reliable than `e.key === "Enter"` (IME composition, autocorrect, mobile keyboards don't always produce clean keydowns), and `getTargetRanges()` tells us what the browser *was about to* change before we preventDefault. Keep keydown only for the `/` trigger and shortcuts.

### 7. Don't rebuild toward a full model — but know where the line is

The per-block contenteditable design is legitimized by Editor.js ([base concepts](https://editorjs.io/base-concepts/)), and for a local editing tool over static HTML, per-block scoping actually limits the blast radius of browser quirks. What we should *not* do is add features that require cross-block selections, collaborative editing, or marks-aware transformations — that's the point where every team studied here ended up building (or adopting) a real model, schema, and reconciler, because DOM-as-truth stops scaling exactly there ([ProseMirror guide](https://prosemirror.net/docs/guide/); [Lexical editor-state](https://lexical.dev/docs/concepts/editor-state)). If the editor's scope grows, adopt Tiptap or Lexical rather than reimplementing them.

### Postscript: why nobody trusts raw contenteditable (Q4 evidence)

- ProseMirror's DOM observer works around: IE11 mutation callbacks arriving before the DOM changes, Safari relocating composed text out of table cells, bogus `<br>` insertion on backspace, Firefox double-`<br>`s ([domobserver.ts](https://github.com/ProseMirror/prosemirror-view/blob/master/src/domobserver.ts)).
- Lexical: the same rich text has many equivalent HTML forms, so the DOM can't be canonical ([editor-state](https://lexical.dev/docs/concepts/editor-state)).
- Slate: built its own command layer because DOM `execCommand` is "too opinionated and inconsistent" ([commands](https://docs.slatejs.org/concepts/06-commands)).
- Quill: editors that pass raw HTML around inherit "the burden of parsing and interpreting this," which "will differ from those of major browser vendors" ([delta guide](https://quilljs.com/guides/designing-the-delta-format)).
- CKEditor 5: ships a dedicated renderer to handle "all the quirks required to tame `contentEditable`," and notes browsers disagree on whether boundary selections anchor in text nodes or elements ([editing engine](https://ckeditor.com/docs/ckeditor5/latest/framework/architecture/editing-engine.html)).
- Editor.js: single-contenteditable editors exhibit "permanent bugs with moving text fragments or scaling images, while page parts are jumping and twitches" ([base concepts](https://editorjs.io/base-concepts/)).
