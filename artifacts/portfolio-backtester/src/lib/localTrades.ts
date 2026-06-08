export interface LocalTrade {
  id: string;
  userId: string;
  symbol: string;
  name: string;
  type: "buy" | "sell";
  quantity: number;
  price: number;
  currency: string;
  createdAt: string;
}

function storageKey(userId: string) {
  return `pt_trades_${userId}`;
}

export function getTrades(userId: string): LocalTrade[] {
  try {
    return JSON.parse(localStorage.getItem(storageKey(userId)) ?? "[]");
  } catch {
    return [];
  }
}

export function addTrade(
  userId: string,
  trade: Omit<LocalTrade, "id" | "createdAt">
): LocalTrade {
  const newTrade: LocalTrade = {
    ...trade,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  const trades = getTrades(userId);
  localStorage.setItem(storageKey(userId), JSON.stringify([...trades, newTrade]));
  return newTrade;
}

export function deleteTrade(userId: string, tradeId: string) {
  const trades = getTrades(userId).filter((t) => t.id !== tradeId);
  localStorage.setItem(storageKey(userId), JSON.stringify(trades));
}
