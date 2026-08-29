# Local Spotify now-playing server

Small Node proxy for the portfolio sidebar widget. Keeps Spotify secrets off the static site.

## Prerequisites

- Node.js 18+
- A [Spotify Developer](https://developer.spotify.com/dashboard) app

## 1. Create a Spotify app

1. Go to [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) and create an app.
2. Under **Settings**, add this **Redirect URI**:
   ```
   http://localhost:3001/callback
   ```
3. Copy the **Client ID** and **Client Secret**.
4. Under **Users and Access**, add your Spotify account (required in Development mode).

## 2. Configure environment

```bash
cd spotify-server
cp .env.example .env
```

Fill in `.env`:

```env
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
SPOTIFY_REFRESH_TOKEN=
PORT=3001
```

## 3. Install and start the server

```bash
npm install
npm start
```

## 4. One-time OAuth (get refresh token)

With the server running, open:

```
http://localhost:3001/login
```

Authorize the app. The terminal prints:

```
SPOTIFY_REFRESH_TOKEN=...
```

Paste that value into `.env`, then restart the server.

## 5. Run the static site

In the portfolio root:

```bash
python3 -m http.server 8000
```

Open [http://localhost:8000](http://localhost:8000). The widget polls `http://localhost:3001/api/now-playing` every 30 seconds.

Play something on Spotify (desktop or mobile with an active device) and the sidebar should update within one poll.

## API

### `GET /api/now-playing`

Returns:

```json
{
  "playing": true,
  "title": "Scott Street",
  "artist": "Phoebe Bridgers",
  "albumArt": "https://i.scdn.co/image/...",
  "url": "https://open.spotify.com/track/..."
}
```

- **200 + `playing: true`** — currently playing; widget shows track.
- **200 + `playing: false`** — nothing playing; widget hides.
- **503** — missing refresh token; complete `/login` first.

## Notes

- CORS is limited to `http://localhost:8000`.
- `now-playing.js` only runs on `localhost` / `127.0.0.1`, so production deploys are unaffected.
- Never commit `.env` or refresh tokens.
