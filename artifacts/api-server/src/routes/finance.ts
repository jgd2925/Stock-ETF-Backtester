import { Router } from "express";

const router = Router();

const YAHOO_BASE = "https://query1.finance.yahoo.com";
const YAHOO_BASE2 = "https://query2.finance.yahoo.com";

async function yahooFetch(url: string): Promise<Response> {
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json",
    "Accept-Language": "en-US,en;q=0.9",
    "Origin": "https://finance.yahoo.com",
    "Referer": "https://finance.yahoo.com",
  };
  try {
    const res = await fetch(url, { headers });
    if (res.ok) return res;
    throw new Error(`HTTP ${res.status}`);
  } catch {
    const url2 = url.replace(YAHOO_BASE, YAHOO_BASE2);
    return fetch(url2, { headers });
  }
}

router.get("/finance/search", async (req, res) => {
  const { q } = req.query;
  if (!q || typeof q !== "string") {
    res.status(400).json({ error: "Missing query parameter q" });
    return;
  }
  try {
    const url = `${YAHOO_BASE}/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=20&newsCount=0&enableFuzzyQuery=false&lang=ko-KR`;
    const response = await yahooFetch(url);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Finance search failed");
    res.status(500).json({ error: "검색 요청에 실패했습니다" });
  }
});

router.get("/finance/chart/:symbol", async (req, res) => {
  const { symbol } = req.params;
  const { period1, period2, interval = "1mo", events = "div,split" } = req.query;
  if (!period1 || !period2) {
    res.status(400).json({ error: "Missing period1 or period2" });
    return;
  }
  try {
    const url = `${YAHOO_BASE}/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${period1}&period2=${period2}&interval=${interval}&events=${events}&includeAdjustedClose=true`;
    const response = await yahooFetch(url);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Finance chart failed");
    res.status(500).json({ error: `${symbol} 데이터를 불러오지 못했습니다` });
  }
});

export default router;
