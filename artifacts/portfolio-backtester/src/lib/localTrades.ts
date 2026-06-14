const TRADES_KEY = "pt_trades";
const TARGET_KEY = "pt_target_portfolio";

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

export interface TargetPortfolio {
  label: string;
  color: string;
  holdings: { symbol: string; name: string; weight: number }[];
  savedAt: string;
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

export function getTargetPortfolio(): TargetPortfolio | null {
  try {
    const raw = localStorage.getItem(TARGET_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveTargetPortfolio(p: Omit<TargetPortfolio, "savedAt">): void {
  localStorage.setItem(TARGET_KEY, JSON.stringify({ ...p, savedAt: new Date().toISOString() }));
}

export function clearTargetPortfolio(): void {
  localStorage.removeItem(TARGET_KEY);
}
