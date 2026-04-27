const API_BASE = "/api";

export interface SearchResult {
  symbol: string;
  shortName: string;
  longName: string;
  exchange: string;
  quoteType: string;
  market: string;
}

export interface HistoricalData {
  date: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  adjClose: number;
  dividend?: number;
}

export interface DividendData {
  date: number;
  amount: number;
}

export async function searchSymbol(query: string): Promise<SearchResult[]> {
  if (!query || query.length < 1) return [];
  try {
    const res = await fetch(`${API_BASE}/finance/search?q=${encodeURIComponent(query)}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const quotes: SearchResult[] = (json?.quotes ?? [])
      .filter((q: SearchResult) => q.symbol && q.quoteType !== "FUTURE" && q.quoteType !== "CURRENCY")
      .map((q: SearchResult) => ({
        symbol: q.symbol,
        shortName: q.shortName || q.longName || q.symbol,
        longName: q.longName || q.shortName || q.symbol,
        exchange: q.exchange,
        quoteType: q.quoteType,
        market: q.market,
      }));
    return quotes;
  } catch {
    return [];
  }
}

export async function fetchHistoricalData(
  symbol: string,
  startDate: Date,
  endDate: Date
): Promise<{ prices: HistoricalData[]; dividends: DividendData[] }> {
  const period1 = Math.floor(startDate.getTime() / 1000);
  const period2 = Math.floor(endDate.getTime() / 1000);

  const res = await fetch(
    `${API_BASE}/finance/chart/${encodeURIComponent(symbol)}?period1=${period1}&period2=${period2}&interval=1mo&events=div%2Csplit`,
    { headers: { Accept: "application/json" } }
  );
  if (!res.ok) throw new Error(`${symbol} 데이터를 불러오지 못했습니다 (HTTP ${res.status})`);
  const json = await res.json();

  const result = json?.chart?.result?.[0];
  if (!result) throw new Error(`${symbol}: 데이터가 없습니다`);

  const timestamps: number[] = result.timestamp ?? [];
  const indicators = result.indicators;
  const quote = indicators?.quote?.[0] ?? {};
  const adjCloses: number[] = indicators?.adjclose?.[0]?.adjclose ?? [];

  const prices: HistoricalData[] = timestamps.map((ts, i) => ({
    date: ts * 1000,
    open: quote.open?.[i] ?? 0,
    high: quote.high?.[i] ?? 0,
    low: quote.low?.[i] ?? 0,
    close: quote.close?.[i] ?? 0,
    volume: quote.volume?.[i] ?? 0,
    adjClose: adjCloses[i] ?? quote.close?.[i] ?? 0,
  })).filter((p) => p.adjClose && p.adjClose > 0);

  const dividendEvents = result.events?.dividends ?? {};
  const dividends: DividendData[] = Object.values(dividendEvents).map((d: unknown) => {
    const div = d as { date: number; amount: number };
    return { date: div.date * 1000, amount: div.amount };
  });

  return { prices, dividends };
}

export async function fetchQuote(symbol: string): Promise<{ price: number; currency: string; name: string } | null> {
  try {
    const period2 = Math.floor(Date.now() / 1000);
    const period1 = period2 - 86400 * 2;
    const res = await fetch(
      `${API_BASE}/finance/chart/${encodeURIComponent(symbol)}?period1=${period1}&period2=${period2}&interval=1d`,
      { headers: { Accept: "application/json" } }
    );
    if (!res.ok) return null;
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    const meta = result?.meta;
    if (!meta) return null;
    return {
      price: meta.regularMarketPrice ?? 0,
      currency: meta.currency ?? "USD",
      name: meta.shortName ?? meta.longName ?? symbol,
    };
  } catch {
    return null;
  }
}
