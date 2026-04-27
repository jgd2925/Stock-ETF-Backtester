export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const q = url.searchParams.get("q") || "";
  if (!q) {
    return new Response(JSON.stringify({ quotes: [] }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const yahooUrl = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=15&newsCount=0&enableFuzzyQuery=false`;

  const resp = await fetch(yahooUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Accept: "application/json",
    },
  });

  const data = await resp.text();
  return new Response(data, {
    status: resp.status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
