const TRADES_KEY = "pt_trades";

export interface LocalTrade {
  id: string;
  symbol: string;
  name: string;
  type: "buy" | "sell";
  quantity: number;
  price: number;
  currency: string;
  createdAt: string;
}

export function getTrades(): LocalTrade[] {
  try {
    return JSON.parse(localStorage.getItem(TRADES_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function addTrade(trade: Omit<LocalTrade, "id" | "createdAt">): LocalTrade {
  const newTrade: LocalTrade = {
    ...trade,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  const trades = getTrades();
  localStorage.setItem(TRADES_KEY, JSON.stringify([...trades, newTrade]));
  return newTrade;
}

export function deleteTrade(id: string) {
  const trades = getTrades().filter((t) => t.id !== id);
  localStorage.setItem(TRADES_KEY, JSON.stringify(trades));
}
