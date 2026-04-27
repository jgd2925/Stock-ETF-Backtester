export async function onRequestGet(context) {
  const symbol = context.params.symbol;
  const url = new URL(context.request.url);
  const qs = url.searchParams.toString();

  const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?${qs}`;

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
