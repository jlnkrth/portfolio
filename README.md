# kreth.work

A minimal personal portfolio. Two files, no build step, no framework.

- `index.html` — the page (structure + content)
- `styles.css` — typography, spacing, colors
- `components.html` — **hidden** component library (see below)
- `notes/ARTICLE-GUIDE.md` — article types (Principle, Playbook, Case study) and required components
- `components.css` / `components.js` — styles + behavior for the components
- `robots.txt` — keeps the components page out of search engines
- `CNAME` — custom domain for GitHub Pages (`kreth.work`)

## Components page (hidden)

`components.html` is a private catalog of every component used on the site
(announcement banner, hero, raised buttons, install/code blocks, pill button
groups, inline code, the "rule of thumb" note, live toasts, and the footer).

It is hidden from visitors, not linked anywhere from the public site. It is also
marked `noindex, nofollow` and disallowed in `robots.txt`, so search engines
skip it. Anyone with the direct URL (`/components.html`) can still open it —
if you need it fully private, put it behind auth on your host.

The only external request is the [Inter](https://rsms.me/inter/) variable font
from Google Fonts. Everything else is static.

## Edit

Open `index.html` and change the text in the header, `Today`, `Projects`,
and `Writing` sections. Update the links (`href="#"`) to
your real URLs.

## Run locally

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

The live now-playing widget needs the Cloudflare Worker in `spotify-worker/`. GitHub Pages cannot run that proxy.

## Edit articles in the browser

```bash
node scripts/edit-server.mjs
# open http://localhost:3030/notes/<slug>/ → click the Edit pill → write → Cmd+S
```

The edit server serves the site like the Python server, but injects a local
Notion-style editor (`editor.js` / `editor.css`) into every page and exposes
`POST /api/save`, which writes the edited `<article>` back into the real
HTML file. Nothing on disk ever references the editor, so the deployed site
is unaffected. In edit mode: hover a block for drag/insert controls, type `/`
in an empty paragraph for the component menu, select text for the inline
formatting toolbar, and use "Edit source" on a block for raw markup (the only
way to edit Mermaid/sparkline internals — they save from pristine snapshots,
never rendered SVG).

### Edit books in the browser

Use the same edit server (`http://localhost:3030`). Open any book page, click
**Admin Access** in the sidebar (below Components / Article templates), then:

- Click **Status**, **Verdict**, or the **Entertaining / Educational / Must Read** badge to change them
- Edit the lead line, author / published / pages in the metadata list, and the Notes / Highlights panels
- Click **Save** in the bottom-right pill

Save updates `data/books.json` and regenerates that book's `index.html`. Commit
and push to publish to kreth.work (GitHub Pages).

## Deploy

Any static host works (GitHub Pages, Netlify, Cloudflare Pages, Vercel).

### GitHub Pages
1. Push this folder to a repo.
2. Settings → Pages → deploy from branch (root).
3. The included `CNAME` sets the custom domain to `kreth.work`.
4. At your DNS provider, point `kreth.work` at GitHub Pages
   (A records to GitHub's IPs, or a `CNAME` for `www`).

### Cloudflare / Netlify / Vercel
Drop the folder in as a static site and set `kreth.work` as the custom domain.
Delete `CNAME` if your host doesn't use it.
