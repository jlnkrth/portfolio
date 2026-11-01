# kreth.work

Personal portfolio hosted on **Cloudflare Workers Static Assets**, deployed from
this GitHub repo. Source stays on GitHub; the public site is built into `dist/`
and served by the Worker in `worker/index.js`.

## Layout

- `index.html` / `styles.css` — public site
- `admin/` — public branded login landing (`Continue with Google` → Access)
- `components.html` — component library (protected on `admin.kreth.work`)
- `notes/`, `projects/`, `books/`, … — content
- `worker/` + `wrangler.jsonc` — host routing, redirects, now-playing proxy
- `scripts/build-dist.mjs` — copies only public files into `dist/`
- `spotify-worker/` — separate Spotify now-playing Worker
- `robots.txt` — keeps admin/library paths out of search

## Hosts

| Host | Role |
|------|------|
| `kreth.work` | Public portfolio |
| `www.kreth.work` | 301 → `kreth.work` |
| `admin.kreth.work` | Cloudflare Access (Google). Exact allow: `julian@karmastudio.co`. Serves the Component Library at `/` and templates under `/notes/_templates/` |

Public `/admin/` is the login landing page. Public `/components.html` and
`/notes/_templates/*` redirect to the protected admin host.

## Admin access

Cloudflare Access (Google identity provider, Instant Auth) gates
`admin.kreth.work`. Create the Access application in the Cloudflare Zero Trust
dashboard; store the Google OAuth client secret only in Access — never in this
repo.

Local article/book **save** still needs the edit server below (UI-only admin
toggle via sessionStorage when Access is not in play).

## Develop

```bash
npm install
npm run build          # writes dist/
npm run dev            # wrangler dev after build
# or plain static:
python3 -m http.server 8000
```

Same-origin `/api/now-playing` needs the portfolio Worker (and the
`NOW_PLAYING` service binding). On a plain Python server the widget falls back
only if you temporarily point `now-playing.js` at the Spotify Worker URL.

## Edit articles in the browser

```bash
node scripts/edit-server.mjs
# open http://localhost:3030/notes/<slug>/ → Edit → Cmd+S
```

### Edit books

Same edit server. Open a book page, unlock admin UI, then edit status/verdict/
notes and **Save**. Updates `data/books.json` and regenerates that book's HTML.

## Deploy

```bash
npm run deploy
```

Production deploys also run from Cloudflare Workers Builds on pushes to `main`
(configure the GitHub App for this repo). After DNS is on Cloudflare, custom
domains `kreth.work`, `www.kreth.work`, and `admin.kreth.work` attach to the
`kreth-work` Worker.

## PR previews (hosted draft review)

Pull requests get a live Workers preview via `.github/workflows/preview.yml`.
Each PR uploads a version with a stable alias (`pr-<number>-kreth-work.<account>.workers.dev`)
and the bot comments that URL plus deep links to any `noindex` draft notes.

**One-time setup** (repo → Settings → Secrets and variables → Actions):

| Secret | Where to get it |
|--------|-----------------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare → My Profile → API Tokens → **Edit Cloudflare Workers** |
| `CLOUDFLARE_ACCOUNT_ID` | Workers overview sidebar → Account ID |

Local equivalent (requires `wrangler login`):

```bash
npm run preview                          # versioned preview URL
npx wrangler versions upload --preview-alias staging
npm run drafts -- --base https://staging-kreth-work.<account>.workers.dev
```

Optional: in the Cloudflare Worker **Settings → Builds**, turn on
**non-production branch builds** so Workers Builds also posts preview URLs
(same `wrangler versions upload` path as the GitHub Action).
