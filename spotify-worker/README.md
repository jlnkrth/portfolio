# Now-playing Worker

Cloudflare Worker that powers the sidebar Spotify widget on [kreth.work](https://kreth.work/). GitHub Pages is static, so this API lives here instead.

The widget on the site polls `/api/now-playing`. Secrets stay in the Worker, not in the static repo.

## First-time setup

Needs a [Spotify Developer](https://developer.spotify.com/dashboard) app and Wrangler authenticated to this Cloudflare account.

```bash
cd spotify-worker
npm install
npx wrangler kv namespace create SPOTIFY
```

Paste the printed `kv_namespaces` block into `wrangler.jsonc`. Then:

```bash
printf '%s' "$SPOTIFY_CLIENT_ID" | npx wrangler secret put SPOTIFY_CLIENT_ID
printf '%s' "$SPOTIFY_CLIENT_SECRET" | npx wrangler secret put SPOTIFY_CLIENT_SECRET
printf '%s' "$SETUP_SECRET" | npx wrangler secret put SETUP_SECRET
npx wrangler deploy
```

Worker URL: `https://kreth-now-playing.juliankreth-a09.workers.dev`

In the Spotify app **Settings**, add this Redirect URI:

```
https://kreth-now-playing.juliankreth-a09.workers.dev/callback
```

Open `/login?key=<SETUP_SECRET>` once, authorize, then play a track.

## Deploy updates

```bash
npx wrangler deploy
```
