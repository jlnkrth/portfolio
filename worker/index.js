// Portfolio host Worker: static assets + redirects + same-origin now-playing proxy.
const PUBLIC_HOST_DEFAULT = "kreth.work";
const ADMIN_HOST_DEFAULT = "admin.kreth.work";
const SPOTIFY_FALLBACK =
  "https://kreth-now-playing.juliankreth-a09.workers.dev/api/now-playing";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const host = url.hostname.toLowerCase();
    const publicHost = (env.PUBLIC_HOST || PUBLIC_HOST_DEFAULT).toLowerCase();
    const adminHost = (env.ADMIN_HOST || ADMIN_HOST_DEFAULT).toLowerCase();
    const isLocal =
      host === "localhost" ||
      host === "127.0.0.1" ||
      host.endsWith(".workers.dev") ||
      host.endsWith(".workers-preview.dev");

    // www → apex
    if (host === `www.${publicHost}`) {
      url.hostname = publicHost;
      return Response.redirect(url.toString(), 301);
    }

    // Same-origin Spotify proxy
    if (url.pathname === "/api/now-playing") {
      return proxyNowPlaying(request, env);
    }

    const onAdminHost = host === adminHost;

    // Public site: send old admin asset URLs to the protected host
    if (!onAdminHost && !isLocal) {
      if (url.pathname === "/components.html" || url.pathname === "/components") {
        return Response.redirect(`https://${adminHost}/`, 302);
      }
      if (url.pathname.startsWith("/notes/_templates")) {
        const dest = new URL(url.pathname + url.search, `https://${adminHost}`);
        return Response.redirect(dest.toString(), 302);
      }
    }

    // Admin host: map / → Component Library
    if (onAdminHost) {
      if (url.pathname === "/" || url.pathname === "") {
        return serveAsset(env, url, "/components.html");
      }
      // On admin host, /admin login page is unnecessary — send to library
      if (url.pathname === "/admin" || url.pathname === "/admin/") {
        return Response.redirect(new URL("/", url.origin).toString(), 302);
      }
    }

    // Local/dev admin simulation via ?admin=1
    if (isLocal && url.searchParams.get("admin") === "1") {
      if (url.pathname === "/" || url.pathname === "") {
        return serveAsset(env, url, "/components.html");
      }
    }

    return serveAsset(env, url, url.pathname);
  },
};

function assetRequest(origin, pathname, search = "") {
  return new Request(new URL(pathname + search, origin));
}

async function serveAsset(env, url, pathname) {
  const path = pathname || "/";
  const search = url.search || "";

  // With html_handling: "none", directory URLs do not auto-map to index.html.
  if (path === "/" || path === "") {
    return env.ASSETS.fetch(assetRequest(url.origin, "/index.html", search));
  }

  if (path.endsWith("/")) {
    const indexed = await env.ASSETS.fetch(
      assetRequest(url.origin, `${path}index.html`, search)
    );
    if (indexed.status !== 404) return indexed;
  }

  const direct = await env.ASSETS.fetch(assetRequest(url.origin, path, search));
  if (direct.status !== 404) return direct;

  // /about → /about/index.html (common clean URL)
  if (!path.includes(".") && !path.endsWith("/")) {
    const nested = await env.ASSETS.fetch(
      assetRequest(url.origin, `${path}/index.html`, search)
    );
    if (nested.status !== 404) return nested;
  }

  return direct;
}

async function proxyNowPlaying(request, env) {
  const origin = new URL(request.url).origin;
  const headers = {
    Accept: "application/json",
    Origin: origin,
  };

  let res = null;
  if (env.NOW_PLAYING) {
    try {
      const upstream = new Request("https://now-playing.internal/api/now-playing", {
        method: "GET",
        headers,
      });
      res = await env.NOW_PLAYING.fetch(upstream);
      // Local unbound service binding returns a synthetic error body
      if (res.status >= 500) {
        const text = await res.clone().text();
        if (/not found|not connected|not running/i.test(text)) {
          res = null;
        } else {
          // Restore body for non-binding failures
          res = new Response(text, { status: res.status, headers: res.headers });
        }
      }
    } catch {
      res = null;
    }
  }

  if (!res) {
    res = await fetch(SPOTIFY_FALLBACK, { method: "GET", headers });
  }

  const out = new Headers(res.headers);
  out.set("Cache-Control", "no-store");
  out.set("Access-Control-Allow-Origin", origin);
  return new Response(res.body, { status: res.status, headers: out });
}
