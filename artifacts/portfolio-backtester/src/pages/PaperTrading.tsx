import { useState, useEffect, useCallback } from "react";
import {
  TrendingUp, Loader2, AlertCircle, Plus, Minus, RefreshCw,
  Trash2, ArrowUpRight, ArrowDownRight, ChevronDown, ChevronUp,
} from "lucide-react";
import { NavHeader } from "@/components/NavHeader";
import { SymbolSearch } from "@/components/SymbolSearch";
import { getTrades, addTrade, deleteTrade, type LocalTrade } from "@/lib/localTrades";
import { fetchQuote } from "@/lib/api";
import type { SearchResult } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Holding {
  symbol: string;
  name: string;
  quantity: number;
  avgCost: number;
  currency: string;
  currentPrice: number | null;
  loadingPrice: boolean;
}

function computeHoldings(trades: LocalTrade[]): Omit<Holding, "currentPrice" | "loadingPrice">[] {
  const map: Record<string, { quantity: number; totalCost: number; currency: string; name: string }> = {};
  for (const t of trades) {
    if (!map[t.symbol]) map[t.symbol] = { quantity: 0, totalCost: 0, currency: t.currency, name: t.name };
    const h = map[t.symbol];
    if (t.type === "buy") {
      h.totalCost += t.quantity * t.price;
      h.quantity += t.quantity;
    } else {
      const avg = h.quantity > 0 ? h.totalCost / h.quantity : 0;
      h.quantity -= t.quantity;
      h.totalCost -= t.quantity * avg;
      if (h.quantity <= 0) { h.quantity = 0; h.totalCost = 0; }
    }
  }
  return Object.entries(map)
    .filter(([, h]) => h.quantity > 0.0001)
    .map(([symbol, h]) => ({
      symbol, name: h.name, quantity: h.quantity,
      avgCost: h.quantity > 0 ? h.totalCost / h.quantity : 0,
      currency: h.currency,
    }));
}

function fmtPrice(price: number, currency: string) {
  if (currency === "KRW") return `₩${Math.round(price).toLocaleString()}`;
  return `$${price.toFixed(2)}`;
}

function fmtValue(value: number, currency: string) {
  if (currency === "KRW") {
    if (Math.abs(value) >= 100_000_000) return `${(value / 100_000_000).toFixed(2)}억원`;
    if (Math.abs(value) >= 10_000) return `${Math.round(value / 10_000).toLocaleString()}만원`;
    return `₩${Math.round(value).toLocaleString()}`;
  }
  return `$${value.toFixed(2)}`;
}

function fmtQty(n: number) {
  return n % 1 === 0 ? String(n) : n.toFixed(4);
}

export default function PaperTrading() {
  const [isDark, setIsDark] = useState(() =>
    typeof window !== "undefined" ? document.documentElement.classList.contains("dark") : false
  );
  function toggleDark() {
    document.documentElement.classList.toggle("dark");
    setIsDark((d) => !d);
  }

  const [tab, setTab] = useState<"holdings" | "history">("holdings");
  const [formOpen, setFormOpen] = useState(false);

  const [trades, setTrades] = useState<LocalTrade[]>(() => getTrades());
  const [holdings, setHoldings] = useState<Holding[]>([]);

  const [selectedSymbol, setSelectedSymbol] = useState<SearchResult | null>(null);
  const [tradeType, setTradeType] = useState<"buy" | "sell">("buy");
  const [quantity, setQuantity] = useState("");
  const [quoteData, setQuoteData] = useState<{ price: number; currency: string; name: string } | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [tradeError, setTradeError] = useState<string | null>(null);
  const [tradeSuccess, setTradeSuccess] = useState<string | null>(null);

  const refreshPrices = useCallback(async (base: Omit<Holding, "currentPrice" | "loadingPrice">[]) => {
    setHoldings(base.map((h) => ({ ...h, currentPrice: null, loadingPrice: true })));
    const updated = await Promise.all(
      base.map(async (h) => {
        try {
          const q = await fetchQuote(h.symbol);
          return { ...h, currentPrice: q?.price ?? null, loadingPrice: false };
        } catch {
          return { ...h, currentPrice: null, loadingPrice: false };
        }
      })
    );
    setHoldings(updated);
  }, []);

  useEffect(() => {
    refreshPrices(computeHoldings(trades));
  }, [trades, refreshPrices]);

  useEffect(() => {
    if (!selectedSymbol) { setQuoteData(null); return; }
    setLoadingQuote(true);
    fetchQuote(selectedSymbol.symbol).then((q) => { setQuoteData(q); setLoadingQuote(false); });
  }, [selectedSymbol]);

  function handleSelectSymbol(r: SearchResult) {
    setSelectedSymbol(r);
    setTradeError(null);
  }

  async function executeTrade() {
    if (!selectedSymbol || !quoteData) return;
    const qty = parseFloat(quantity);
    if (!qty || qty <= 0) { setTradeError("수량을 입력하세요."); return; }

    if (tradeType === "sell") {
      const hMap = computeHoldings(trades);
      const held = hMap.find((h) => h.symbol === selectedSymbol.symbol);
      if (!held || held.quantity < qty) {
        setTradeError(`보유 수량이 부족합니다. (보유: ${held ? fmtQty(held.quantity) : 0}주)`);
        return;
      }
    }

    setTradeError(null);
    setSubmitting(true);
    addTrade({
      symbol: selectedSymbol.symbol,
      name: quoteData.name || selectedSymbol.shortName,
      type: tradeType,
      quantity: qty,
      price: quoteData.price,
      currency: quoteData.currency,
    });
    const updated = getTrades();
    setTrades(updated);
    setTradeSuccess(`${selectedSymbol.symbol} ${fmtQty(qty)}주 ${tradeType === "buy" ? "매수" : "매도"} 완료`);
    setQuantity("");
    setSelectedSymbol(null);
    setQuoteData(null);
    setFormOpen(false);
    setTimeout(() => setTradeSuccess(null), 3000);
    setSubmitting(false);
  }

  function handleDelete(id: string) {
    if (!confirm("이 거래를 삭제하시겠습니까?")) return;
    deleteTrade(id);
    setTrades(getTrades());
  }

  const totalValue = holdings.reduce((s, h) => h.currentPrice !== null ? s + h.quantity * h.currentPrice : s, 0);
  const totalCost = holdings.reduce((s, h) => s + h.quantity * h.avgCost, 0);
  const totalPnl = totalValue - totalCost;
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;
  const mixedCurrency = holdings.length > 0 && new Set(holdings.map((h) => h.currency)).size > 1;
  const mainCurrency = holdings[0]?.currency ?? "USD";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <NavHeader isDark={isDark} onToggleDark={toggleDark} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 py-4 sm:py-6">
        {/* ─── Desktop: side-by-side / Mobile: stacked ─── */}
        <div className="flex flex-col lg:grid lg:grid-cols-[360px_1fr] xl:grid-cols-[400px_1fr] gap-4 lg:gap-6">

          {/* ═══ LEFT PANEL ═══ */}
          <aside className="flex flex-col gap-3 lg:gap-4">

            {/* Summary cards – always visible if holdings exist */}
            {holdings.length > 0 && (
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <div className="bg-card border border-border rounded-xl p-3 sm:p-4 shadow-sm">
                  <p className="text-[10px] sm:text-xs text-muted-foreground mb-1">총 평가금액</p>
                  <p className="text-sm sm:text-base font-mono font-bold text-foreground truncate">
                    {mixedCurrency ? "—" : fmtValue(totalValue, mainCurrency)}
                  </p>
                </div>
                <div className="bg-card border border-border rounded-xl p-3 sm:p-4 shadow-sm">
                  <p className="text-[10px] sm:text-xs text-muted-foreground mb-1">평가손익</p>
                  <p className={cn(
                    "text-sm sm:text-base font-mono font-bold truncate",
                    mixedCurrency ? "text-foreground" : totalPnl >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500"
                  )}>
                    {mixedCurrency ? "—" : (totalPnl >= 0 ? "+" : "") + fmtValue(totalPnl, mainCurrency)}
                  </p>
                  {!mixedCurrency && (
                    <p className={cn("text-[10px] font-mono", totalPnlPct >= 0 ? "text-green-500" : "text-red-500")}>
                      {totalPnlPct >= 0 ? "+" : ""}{totalPnlPct.toFixed(2)}%
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Trade form – collapsible on mobile, always open on desktop */}
            <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
              {/* Mobile toggle header */}
              <button
                className="lg:hidden w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-foreground"
                onClick={() => setFormOpen((v) => !v)}
              >
                <span className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  매수 / 매도
                </span>
                {formOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </button>

              {/* Desktop always-visible header */}
              <div className="hidden lg:flex items-center gap-2 px-5 py-4 border-b border-border">
                <TrendingUp className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">매수 / 매도</h2>
              </div>

              <div className={cn(
                "flex flex-col gap-4 p-4 sm:p-5",
                "lg:flex",
                formOpen ? "flex" : "hidden"
              )}>
                {/* Buy / Sell toggle */}
                <div className="flex gap-1 bg-muted rounded-lg p-1">
                  {(["buy", "sell"] as const).map((t) => (
                    <button key={t}
                      onClick={() => { setTradeType(t); setTradeError(null); }}
                      className={cn(
                        "flex-1 py-2 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-1.5",
                        t === "buy"
                          ? tradeType === "buy" ? "bg-green-500 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                          : tradeType === "sell" ? "bg-red-500 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                      )}>
                      {t === "buy" ? <Plus className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
                      {t === "buy" ? "매수" : "매도"}
                    </button>
                  ))}
                </div>

                {/* Symbol search */}
                <SymbolSearch onSelect={handleSelectSymbol} placeholder="종목 검색..." />

                {/* Selected symbol quote */}
                {selectedSymbol && (
                  <div className="bg-muted/60 rounded-lg p-3 flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-mono font-bold text-primary">{selectedSymbol.symbol}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-[150px]">{selectedSymbol.shortName}</p>
                    </div>
                    <div className="text-right shrink-0">
                      {loadingQuote
                        ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                        : quoteData
                          ? <>
                              <p className="text-sm font-mono font-bold text-foreground">{fmtPrice(quoteData.price, quoteData.currency)}</p>
                              <p className="text-[10px] text-muted-foreground">{quoteData.currency}</p>
                            </>
                          : <p className="text-xs text-destructive">조회 실패</p>}
                    </div>
                  </div>
                )}

                {/* Quantity input */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">수량 (주)</label>
                  <div className="flex items-center gap-2 border border-border bg-background rounded-md px-3 py-2.5 focus-within:ring-1 focus-within:ring-primary/50 focus-within:border-primary transition-all">
                    <input
                      type="number" min="0" step="0.0001" value={quantity}
                      onChange={(e) => { setQuantity(e.target.value); setTradeError(null); }}
                      placeholder="0"
                      className="flex-1 bg-transparent outline-none text-sm font-mono min-w-0"
                    />
                    <span className="text-xs text-muted-foreground shrink-0">주</span>
                  </div>
                  {quoteData && quantity && parseFloat(quantity) > 0 && (
                    <p className="text-xs text-muted-foreground pl-1">
                      ≈ {fmtPrice(quoteData.price * parseFloat(quantity), quoteData.currency)}
                    </p>
                  )}
                </div>

                {/* Error / Success */}
                {tradeError && (
                  <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-xs text-destructive">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    {tradeError}
                  </div>
                )}
                {tradeSuccess && (
                  <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 text-xs text-green-600 dark:text-green-400">
                    {tradeSuccess}
                  </div>
                )}

                {/* Submit */}
                <button
                  onClick={executeTrade}
                  disabled={submitting || !selectedSymbol || !quoteData || !quantity}
                  className={cn(
                    "flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all",
                    submitting || !selectedSymbol || !quoteData || !quantity
                      ? "bg-muted text-muted-foreground cursor-not-allowed"
                      : tradeType === "buy"
                        ? "bg-green-500 text-white hover:bg-green-600 active:scale-[0.98]"
                        : "bg-red-500 text-white hover:bg-red-600 active:scale-[0.98]"
                  )}>
                  {submitting
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : tradeType === "buy"
                      ? <><Plus className="w-4 h-4" />매수 주문</>
                      : <><Minus className="w-4 h-4" />매도 주문</>}
                </button>
              </div>
            </div>

            {/* Success toast (also shown when form is closed) */}
            {tradeSuccess && !formOpen && (
              <div className="lg:hidden bg-green-500/10 border border-green-500/20 rounded-lg p-3 text-xs text-green-600 dark:text-green-400 text-center">
                {tradeSuccess}
              </div>
            )}
          </aside>

          {/* ═══ RIGHT PANEL ═══ */}
          <section className="min-w-0">
            <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
              {/* Tabs */}
              <div className="border-b border-border flex items-center px-2 sm:px-4">
                {(["holdings", "history"] as const).map((t) => (
                  <button key={t} onClick={() => setTab(t)}
                    className={cn(
                      "px-3 sm:px-4 py-3.5 text-xs font-medium border-b-2 transition-all -mb-px whitespace-nowrap",
                      tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                    )}>
                    {t === "holdings" ? `보유 종목 (${holdings.length})` : `거래 내역 (${trades.length})`}
                  </button>
                ))}
                <button
                  onClick={() => refreshPrices(computeHoldings(trades))}
                  className="ml-auto p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-all"
                  title="시세 새로고침"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Content */}
              <div className="overflow-x-auto">
                {tab === "holdings" ? (
                  holdings.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-4">
                      <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                        <TrendingUp className="w-6 h-6 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">보유 종목 없음</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {/* mobile hint */}
                          <span className="lg:hidden">위 매수/매도를 열어 종목을 추가해보세요</span>
                          <span className="hidden lg:inline">왼쪽에서 종목을 검색하여 매수해보세요</span>
                        </p>
                      </div>
                    </div>
                  ) : (
                    <table className="w-full text-xs min-w-[520px]">
                      <thead>
                        <tr className="border-b border-border bg-muted/40">
                          {["종목", "수량", "평균단가", "현재가", "평가금액", "손익", "수익률"].map((h) => (
                            <th key={h} className="px-3 sm:px-4 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {holdings.map((h) => {
                          const cv = h.currentPrice !== null ? h.quantity * h.currentPrice : null;
                          const cost = h.quantity * h.avgCost;
                          const pnl = cv !== null ? cv - cost : null;
                          const pct = pnl !== null && cost > 0 ? (pnl / cost) * 100 : null;
                          return (
                            <tr key={h.symbol} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                              <td className="px-3 sm:px-4 py-3">
                                <p className="font-mono font-bold text-primary">{h.symbol}</p>
                                <p className="text-muted-foreground truncate max-w-[100px]">{h.name}</p>
                              </td>
                              <td className="px-3 sm:px-4 py-3 font-mono">{fmtQty(h.quantity)}</td>
                              <td className="px-3 sm:px-4 py-3 font-mono">{fmtPrice(h.avgCost, h.currency)}</td>
                              <td className="px-3 sm:px-4 py-3 font-mono">
                                {h.loadingPrice
                                  ? <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                                  : h.currentPrice !== null ? fmtPrice(h.currentPrice, h.currency) : "—"}
                              </td>
                              <td className="px-3 sm:px-4 py-3 font-mono">{cv !== null ? fmtValue(cv, h.currency) : "—"}</td>
                              <td className={cn("px-3 sm:px-4 py-3 font-mono font-semibold",
                                pnl === null ? "" : pnl >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500"
                              )}>
                                {pnl !== null
                                  ? <span className="flex items-center gap-0.5">
                                      {pnl >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                                      {(pnl >= 0 ? "+" : "") + fmtValue(pnl, h.currency)}
                                    </span>
                                  : "—"}
                              </td>
                              <td className={cn("px-3 sm:px-4 py-3 font-mono font-semibold",
                                pct === null ? "" : pct >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500"
                              )}>
                                {pct !== null ? `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%` : "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )
                ) : (
                  trades.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-4">
                      <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                        <TrendingUp className="w-6 h-6 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">거래 내역 없음</p>
                        <p className="text-xs text-muted-foreground mt-1">매수/매도 주문을 실행하면 여기에 기록됩니다</p>
                      </div>
                    </div>
                  ) : (
                    <table className="w-full text-xs min-w-[480px]">
                      <thead>
                        <tr className="border-b border-border bg-muted/40">
                          {["날짜", "종목", "유형", "수량", "체결가", "합계", ""].map((h, i) => (
                            <th key={i} className="px-3 sm:px-4 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[...trades].reverse().map((t) => (
                          <tr key={t.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                            <td className="px-3 sm:px-4 py-3 text-muted-foreground whitespace-nowrap">
                              {new Date(t.createdAt).toLocaleDateString("ko-KR", { year: "2-digit", month: "2-digit", day: "2-digit" })}
                            </td>
                            <td className="px-3 sm:px-4 py-3 font-mono font-bold text-primary">{t.symbol}</td>
                            <td className="px-3 sm:px-4 py-3">
                              <span className={cn(
                                "px-2 py-0.5 rounded-full text-[10px] font-semibold",
                                t.type === "buy" ? "bg-green-500/15 text-green-600 dark:text-green-400" : "bg-red-500/15 text-red-500"
                              )}>
                                {t.type === "buy" ? "매수" : "매도"}
                              </span>
                            </td>
                            <td className="px-3 sm:px-4 py-3 font-mono">{fmtQty(t.quantity)}</td>
                            <td className="px-3 sm:px-4 py-3 font-mono">{fmtPrice(t.price, t.currency)}</td>
                            <td className="px-3 sm:px-4 py-3 font-mono">{fmtPrice(t.quantity * t.price, t.currency)}</td>
                            <td className="px-3 sm:px-4 py-3">
                              <button onClick={() => handleDelete(t.id)}
                                className="p-1 text-muted-foreground hover:text-destructive transition-colors rounded">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )
                )}
              </div>
            </div>
          </section>
        </div>
      </main>

      <footer className="border-t border-border py-4 mt-4">
        <p className="text-xs text-muted-foreground text-center px-4">
          모의투자는 실제 투자가 아닙니다 · 데이터: Yahoo Finance · 실제 체결가와 차이가 있을 수 있습니다
        </p>
      </footer>
    </div>
  );
}
