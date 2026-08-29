import "dotenv/config";
import express from "express";

const PORT = parseInt(process.env.PORT || "3001", 10);
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.SPOTIFY_REFRESH_TOKEN;
const REDIRECT_URI = `http://localhost:${PORT}/callback`;
const SCOPES = [
  "user-read-currently-playing",
  "user-read-recently-played",
].join(" ");

const STATIC_ORIGINS = new Set([
  "http://localhost:8000",
  "http://localhost:8001",
  "http://127.0.0.1:8000",
  "http://127.0.0.1:8001",
]);

const app = express();

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && STATIC_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

let cachedAccessToken = null;
let tokenExpiresAt = 0;

function requireCredentials(res) {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    res.status(500).json({
      error: "Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET in .env",
    });
    return false;
  }
  return true;
}

async function refreshAccessToken() {
  if (!REFRESH_TOKEN) {
    throw new Error("Missing SPOTIFY_REFRESH_TOKEN in .env");
  }

  const now = Date.now();
  if (cachedAccessToken && now < tokenExpiresAt - 60_000) {
    return cachedAccessToken;
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: REFRESH_TOKEN,
  });

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization:
        "Basic " +
        Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64"),
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token refresh failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  cachedAccessToken = data.access_token;
  tokenExpiresAt = now + data.expires_in * 1000;
  return cachedAccessToken;
}

function trackPayload(item, playing) {
  const track = item;
  return {
    playing,
    title: track.name,
    artist: track.artists.map((a) => a.name).join(", "),
    albumArt: track.album.images[0]?.url || null,
    url: track.external_urls?.spotify || null,
  };
}

async function spotifyGet(path, accessToken) {
  return fetch(`https://api.spotify.com/v1${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

app.get("/login", (req, res) => {
  if (!requireCredentials(res)) return;

  const params = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    scope: SCOPES,
    redirect_uri: REDIRECT_URI,
    show_dialog: "true",
  });

  res.redirect(`https://accounts.spotify.com/authorize?${params}`);
});

app.get("/callback", async (req, res) => {
  if (!requireCredentials(res)) return;

  const { code, error } = req.query;
  if (error) {
    res.status(400).send(`Spotify auth error: ${error}`);
    return;
  }
  if (!code) {
    res.status(400).send("Missing authorization code.");
    return;
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
  });

  try {
    const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization:
          "Basic " +
          Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64"),
      },
      body,
    });

    const data = await tokenRes.json();
    if (!tokenRes.ok) {
      res.status(500).send(`Token exchange failed: ${JSON.stringify(data)}`);
      return;
    }

    console.log("\n--- Spotify OAuth complete ---");
    if (data.refresh_token) {
      console.log("Add this to spotify-server/.env:\n");
      console.log(`SPOTIFY_REFRESH_TOKEN=${data.refresh_token}\n`);
    } else {
      console.log(
        "No refresh_token returned (you may have already authorized this app)."
      );
      console.log("Revoke the app at https://www.spotify.com/account/apps/ and try /login again.\n");
    }
    console.log("Restart the server after updating .env.\n");

    res.send(
      "<h1>Spotify connected</h1><p>Check the server terminal for your <code>SPOTIFY_REFRESH_TOKEN</code>, add it to <code>.env</code>, then restart.</p>"
    );
  } catch (err) {
    res.status(500).send(`Callback error: ${err.message}`);
  }
});

app.get("/api/now-playing", async (req, res) => {
  if (!requireCredentials(res)) return;

  if (!REFRESH_TOKEN) {
    res.status(503).json({
      error: "Missing SPOTIFY_REFRESH_TOKEN. Visit /login to authorize.",
    });
    return;
  }

  try {
    const accessToken = await refreshAccessToken();
    const currentRes = await spotifyGet(
      "/me/player/currently-playing",
      accessToken
    );

    if (currentRes.status === 204) {
      const recentRes = await spotifyGet(
        "/me/player/recently-played?limit=1",
        accessToken
      );
      if (!recentRes.ok) {
        const text = await recentRes.text();
        res.status(recentRes.status).json({ error: text });
        return;
      }
      const recent = await recentRes.json();
      const item = recent.items?.[0]?.track;
      if (!item) {
        res.json({ playing: false, title: null, artist: null, albumArt: null, url: null });
        return;
      }
      res.json(trackPayload(item, false));
      return;
    }

    if (!currentRes.ok) {
      const text = await currentRes.text();
      res.status(currentRes.status).json({ error: text });
      return;
    }

    const data = await currentRes.json();
    if (!data?.item) {
      res.json({ playing: false, title: null, artist: null, albumArt: null, url: null });
      return;
    }

    res.json(trackPayload(data.item, data.is_playing !== false));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Spotify server listening on http://localhost:${PORT}`);
  console.log(`OAuth setup: http://localhost:${PORT}/login`);
  console.log(`Now playing API: http://localhost:${PORT}/api/now-playing`);
});
