export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // ── Yahoo Finance proxy ───────────────────────────────────────────────
    if (path === "/api/finance/search") {
      const q = url.searchParams.get("q") || "";
      if (!q) {
        return new Response(JSON.stringify({ quotes: [] }), {
          headers: { "Content-Type": "application/json" },
        });
      }
      const yahooUrl =
        `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=15&newsCount=0&enableFuzzyQuery=false`;
      try {
        const resp = await fetch(yahooUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "application/json",
            "Accept-Language": "en-US,en;q=0.9",
          },
        });
        const data = await resp.text();
        return new Response(data, {
          status: resp.status,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: String(e) }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    const chartMatch = path.match(/^\/api\/finance\/chart\/([^/]+)$/);
    if (chartMatch) {
      const symbol = chartMatch[1];
      const qs = url.search;
      const yahooUrl =
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}${qs}`;
      try {
        const resp = await fetch(yahooUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "application/json",
            "Accept-Language": "en-US,en;q=0.9",
            "Origin": "https://finance.yahoo.com",
            "Referer": "https://finance.yahoo.com",
          },
        });
        const data = await resp.text();
        return new Response(data, {
          status: resp.status,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: String(e) }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // ── Auth & Trades proxy → Replit API server ───────────────────────────
    const isApiRoute =
      path.startsWith("/api/auth/") ||
      path.startsWith("/api/trades") ||
      path === "/api/healthz";

    if (isApiRoute) {
      const apiBase = env.REPLIT_API_URL;
      if (!apiBase) {
        return new Response(
          JSON.stringify({ error: "REPLIT_API_URL is not configured." }),
          { status: 503, headers: { "Content-Type": "application/json" } }
        );
      }
      const targetUrl = apiBase.replace(/\/$/, "") + path + url.search;
      try {
        const proxyReq = new Request(targetUrl, {
          method: request.method,
          headers: request.headers,
          body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
          redirect: "follow",
        });
        const resp = await fetch(proxyReq);
        const respHeaders = new Headers(resp.headers);
        respHeaders.set("Access-Control-Allow-Origin", url.origin);
        respHeaders.set("Access-Control-Allow-Credentials", "true");
        return new Response(resp.body, {
          status: resp.status,
          headers: respHeaders,
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: String(e) }), {
          status: 502,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // ── OPTIONS preflight ─────────────────────────────────────────────────
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": url.origin,
          "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Allow-Credentials": "true",
        },
      });
    }

    return env.ASSETS.fetch(request);
  },
};
