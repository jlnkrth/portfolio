const ALLOWED_ORIGINS = new Set([
  "https://kreth.work",
  "https://www.kreth.work",
  "http://localhost:8000",
  "http://localhost:8001",
  "http://localhost:3030",
  "http://127.0.0.1:8000",
  "http://127.0.0.1:8001",
  "http://127.0.0.1:3030",
]);

const SCOPES = "user-read-currently-playing user-read-recently-played";
const REFRESH_KEY = "refresh_token";
const ACCESS_KEY = "access_token";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    try {
      if (url.pathname === "/login") {
        return handleLogin(url, env);
      }
      if (url.pathname === "/callback") {
        return await handleCallback(url, env);
      }
      if (url.pathname === "/api/now-playing") {
        return await handleNowPlaying(env, origin);
      }
      return new Response("Not found", { status: 404, headers: corsHeaders(origin) });
    } catch (err) {
      return json({ error: err.message || "Server error" }, 500, origin);
    }
  },
};

function corsHeaders(origin) {
  const headers = {
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(origin),
    },
  });
}

function html(body, status = 200) {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function requireCredentials(env) {
  return Boolean(env.SPOTIFY_CLIENT_ID && env.SPOTIFY_CLIENT_SECRET);
}

function basicAuth(env) {
  return "Basic " + btoa(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`);
}

function redirectUri(url) {
  return `${url.origin}/callback`;
}

function setupKeyOk(url, env) {
  const key = url.searchParams.get("key");
  return Boolean(env.SETUP_SECRET && key && key === env.SETUP_SECRET);
}

async function kvGet(env, key, type) {
  if (!env.SPOTIFY) return null;
  try {
    return type ? await env.SPOTIFY.get(key, { type }) : await env.SPOTIFY.get(key);
  } catch {
    return null;
  }
}

async function kvPut(env, key, value, options) {
  if (!env.SPOTIFY) return;
  await env.SPOTIFY.put(key, value, options);
}

async function kvDelete(env, key) {
  if (!env.SPOTIFY) return;
  await env.SPOTIFY.delete(key);
}

async function getRefreshToken(env) {
  return (await kvGet(env, REFRESH_KEY)) || env.SPOTIFY_REFRESH_TOKEN || null;
}

function handleLogin(url, env) {
  if (!requireCredentials(env)) {
    return html("<h1>Missing Spotify credentials</h1><p>Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET on the Worker.</p>", 500);
  }
  if (!setupKeyOk(url, env)) {
    return html("<h1>Unauthorized</h1><p>Open /login?key=… with the setup secret.</p>", 401);
  }

  const params = new URLSearchParams({
    response_type: "code",
    client_id: env.SPOTIFY_CLIENT_ID,
    scope: SCOPES,
    redirect_uri: redirectUri(url),
    show_dialog: "true",
    state: env.SETUP_SECRET,
  });

  return Response.redirect(`https://accounts.spotify.com/authorize?${params}`, 302);
}

async function handleCallback(url, env) {
  if (!requireCredentials(env)) {
    return html("<h1>Missing Spotify credentials</h1>", 500);
  }
  if (url.searchParams.get("state") !== env.SETUP_SECRET) {
    return html("<h1>Unauthorized</h1><p>State mismatch. Start again from /login?key=…</p>", 401);
  }

  const error = url.searchParams.get("error");
  if (error) {
    return html(`<h1>Spotify auth error</h1><p>${escapeHtml(error)}</p>`, 400);
  }

  const code = url.searchParams.get("code");
  if (!code) {
    return html("<h1>Missing authorization code</h1>", 400);
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri(url),
  });

  const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: basicAuth(env),
    },
    body,
  });

  const data = await tokenRes.json();
  if (!tokenRes.ok) {
    return html(`<h1>Token exchange failed</h1><pre>${escapeHtml(JSON.stringify(data, null, 2))}</pre>`, 500);
  }

  if (!data.refresh_token) {
    return html(
      "<h1>No refresh token returned</h1><p>Revoke the app at <a href=\"https://www.spotify.com/account/apps/\">spotify.com/account/apps</a>, then try /login again.</p>",
      400
    );
  }

  await kvPut(env, REFRESH_KEY, data.refresh_token);
  await kvDelete(env, ACCESS_KEY);

  return html(
    "<h1>Spotify connected</h1><p>The now-playing widget can read your current track. You can close this tab.</p>"
  );
}

async function refreshAccessToken(env) {
  const cached = await kvGet(env, ACCESS_KEY, "json");
  if (cached && typeof cached === "object" && cached.token && cached.expiresAt && Date.now() < cached.expiresAt - 60_000) {
    return cached.token;
  }

  const refreshToken = await getRefreshToken(env);
  if (!refreshToken) {
    throw new Error("Missing refresh token. Visit /login?key=… to authorize.");
  }

  const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: basicAuth(env),
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    throw new Error(`Token refresh failed (${tokenRes.status}): ${text}`);
  }

  const data = await tokenRes.json();
  const expiresAt = Date.now() + data.expires_in * 1000;
  const ttl = Math.max(60, Number(data.expires_in) || 3600);
  await kvPut(env, ACCESS_KEY, JSON.stringify({ token: data.access_token, expiresAt }), {
    expirationTtl: ttl,
  });
  return data.access_token;
}

function trackPayload(item, playing) {
  return {
    playing,
    title: item.name,
    artist: item.artists.map((a) => a.name).join(", "),
    albumArt: item.album.images[0]?.url || null,
    url: item.external_urls?.spotify || null,
  };
}

async function spotifyGet(path, accessToken) {
  return fetch(`https://api.spotify.com/v1${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

async function handleNowPlaying(env, origin) {
  if (!requireCredentials(env)) {
    return json({ error: "Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET" }, 500, origin);
  }

  if (!(await getRefreshToken(env))) {
    return json({ error: "Missing refresh token. Visit /login?key=… to authorize." }, 503, origin);
  }

  const accessToken = await refreshAccessToken(env);
  const currentRes = await spotifyGet("/me/player/currently-playing", accessToken);

  if (currentRes.status === 204) {
    const recentRes = await spotifyGet("/me/player/recently-played?limit=1", accessToken);
    if (!recentRes.ok) {
      return json({ error: await recentRes.text() }, recentRes.status, origin);
    }
    const recent = await recentRes.json();
    const item = recent.items?.[0]?.track;
    if (!item) {
      return json({ playing: false, title: null, artist: null, albumArt: null, url: null }, 200, origin);
    }
    return json(trackPayload(item, false), 200, origin);
  }

  if (!currentRes.ok) {
    return json({ error: await currentRes.text() }, currentRes.status, origin);
  }

  const data = await currentRes.json();
  if (!data?.item) {
    return json({ playing: false, title: null, artist: null, albumArt: null, url: null }, 200, origin);
  }

  return json(trackPayload(data.item, data.is_playing !== false), 200, origin);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
