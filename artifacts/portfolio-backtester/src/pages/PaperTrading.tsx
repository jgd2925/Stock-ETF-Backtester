import { useState, useEffect, useCallback } from "react";
import {
  TrendingUp, Loader2, AlertCircle, Plus, Minus, RefreshCw,
  Trash2, ArrowUpRight, ArrowDownRight, ChevronDown, ChevronUp,
  Target, CheckCircle2, X, Scale, Info,
} from "lucide-react";
import { NavHeader } from "@/components/NavHeader";
import { SymbolSearch } from "@/components/SymbolSearch";
import {
  getTrades, addTrade, deleteTrade,
  getTargetPortfolio, clearTargetPortfolio,
  type LocalTrade, type TargetPortfolio,
} from "@/lib/localTrades";
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

interface RebalanceTrade {
  symbol: string;
  name: string;
  type: "buy" | "sell";
  quantity: number;
  price: number;
  currency: string;
  currentValue: number;
  targetValue: number;
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

  // Target portfolio state
  const [targetPortfolio, setTargetPortfolioState] = useState<TargetPortfolio | null>(() => getTargetPortfolio());
  const [rebalancePreview, setRebalancePreview] = useState<RebalanceTrade[] | null>(null);
  const [rebalanceTotalValue, setRebalanceTotalValue] = useState(0);
  const [rebalancing, setRebalancing] = useState(false);
  const [rebalanceError, setRebalanceError] = useState<string | null>(null);
  const [rebalanceDone, setRebalanceDone] = useState(false);

  // Manual trade form state
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
      type: tradeType, quantity: qty, price: quoteData.price, currency: quoteData.currency,
    });
    const updated = getTrades();
    setTrades(updated);
    setTradeSuccess(`${selectedSymbol.symbol} ${fmtQty(qty)}주 ${tradeType === "buy" ? "매수" : "매도"} 완료`);
    setQuantity(""); setSelectedSymbol(null); setQuoteData(null); setFormOpen(false);
    setTimeout(() => setTradeSuccess(null), 3000);
    setSubmitting(false);
  }

  function handleDelete(id: string) {
    if (!confirm("이 거래를 삭제하시겠습니까?")) return;
    deleteTrade(id);
    setTrades(getTrades());
  }

  // ─── Rebalancing ────────────────────────────────────────────
  async function buildRebalancePreview() {
    if (!targetPortfolio) return;
    setRebalancing(true);
    setRebalanceError(null);
    setRebalanceDone(false);

    try {
      // Build price map from already-loaded holdings
      const priceMap: Record<string, { price: number; currency: string; name: string }> = {};
      for (const h of holdings) {
        if (h.currentPrice !== null) {
          priceMap[h.symbol] = { price: h.currentPrice, currency: h.currency, name: h.name };
        }
      }

      // Fetch prices for target symbols not yet loaded
      const missingSymbols = targetPortfolio.holdings.filter((h) => !priceMap[h.symbol]);
      if (missingSymbols.length > 0) {
        const results = await Promise.all(missingSymbols.map((h) => fetchQuote(h.symbol)));
        missingSymbols.forEach((h, i) => {
          const q = results[i];
          if (q) priceMap[h.symbol] = { price: q.price, currency: q.currency, name: q.name || h.name };
        });
      }

      // Build current holdings map (with prices)
      const holdingMap: Record<string, { quantity: number; price: number; currency: string; name: string }> = {};
      for (const h of holdings) {
        const p = priceMap[h.symbol];
        if (p && p.price > 0) {
          holdingMap[h.symbol] = { quantity: h.quantity, price: p.price, currency: p.currency, name: h.name };
        }
      }

      // Total portfolio value
      const totalValue = Object.values(holdingMap).reduce((s, h) => s + h.quantity * h.price, 0);
      if (totalValue <= 0) {
        setRebalanceError("리밸런싱할 보유 자산이 없습니다. 먼저 종목을 매수하세요.");
        setRebalancing(false);
        return;
      }

      // Check mixed currencies
      const holdingCurrencies = new Set(Object.values(holdingMap).map((h) => h.currency));
      const targetCurrencies = new Set(
        targetPortfolio.holdings.map((h) => priceMap[h.symbol]?.currency).filter(Boolean)
      );
      const allCurrencies = new Set([...holdingCurrencies, ...targetCurrencies]);
      if (allCurrencies.size > 1) {
        setRebalanceError("혼합 통화(KRW+USD) 포트폴리오는 자동 리밸런싱을 지원하지 않습니다.");
        setRebalancing(false);
        return;
      }

      const trades: RebalanceTrade[] = [];
      const targetSymbolSet = new Set(targetPortfolio.holdings.map((h) => h.symbol));

      // Sell holdings not in target
      for (const [symbol, holding] of Object.entries(holdingMap)) {
        if (!targetSymbolSet.has(symbol) && holding.quantity > 0.0001) {
          trades.push({
            symbol, name: holding.name, type: "sell",
            quantity: holding.quantity, price: holding.price, currency: holding.currency,
            currentValue: holding.quantity * holding.price, targetValue: 0,
          });
        }
      }

      // Rebalance target symbols
      for (const target of targetPortfolio.holdings) {
        const p = priceMap[target.symbol];
        if (!p || p.price <= 0) continue;
        const targetValue = totalValue * (target.weight / 100);
        const currentQty = holdingMap[target.symbol]?.quantity ?? 0;
        const currentValue = currentQty * p.price;
        const diff = targetValue - currentValue;
        const quantity = Math.abs(diff) / p.price;
        if (quantity < 0.00001) continue;
        trades.push({
          symbol: target.symbol, name: p.name, type: diff > 0 ? "buy" : "sell",
          quantity, price: p.price, currency: p.currency,
          currentValue, targetValue,
        });
      }

      setRebalanceTotalValue(totalValue);
      setRebalancePreview(trades);
    } catch (e: unknown) {
      setRebalanceError((e as Error).message ?? "리밸런싱 계획 생성 중 오류가 발생했습니다.");
    } finally {
      setRebalancing(false);
    }
  }

  function executeRebalance() {
    if (!rebalancePreview || rebalancePreview.length === 0) return;
    const sells = rebalancePreview.filter((t) => t.type === "sell");
    const buys = rebalancePreview.filter((t) => t.type === "buy");
    for (const t of [...sells, ...buys]) {
      addTrade({ symbol: t.symbol, name: t.name, type: t.type, quantity: t.quantity, price: t.price, currency: t.currency });
    }
    setTrades(getTrades());
    setRebalancePreview(null);
    setRebalanceDone(true);
    setTimeout(() => setRebalanceDone(false), 4000);
  }

  function dismissTarget() {
    clearTargetPortfolio();
    setTargetPortfolioState(null);
    setRebalancePreview(null);
    setRebalanceError(null);
  }

  // Summary
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
        <div className="flex flex-col lg:grid lg:grid-cols-[360px_1fr] xl:grid-cols-[400px_1fr] gap-4 lg:gap-6">

          {/* ═══ LEFT PANEL ═══ */}
          <aside className="flex flex-col gap-3 lg:gap-4">

            {/* ─ Summary cards ─ */}
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

            {/* ─ Target Portfolio + Rebalancing ─ */}
            {targetPortfolio && (
              <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: targetPortfolio.color }} />
                    <Target className="w-3.5 h-3.5 text-primary" />
                    <span className="text-xs font-semibold text-foreground">목표 포트폴리오</span>
                    <span className="text-[10px] text-muted-foreground">— {targetPortfolio.label}</span>
                  </div>
                  <button onClick={dismissTarget} className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="p-4 flex flex-col gap-3">
                  {/* Target weights list */}
                  <div className="flex flex-col gap-1.5">
                    {targetPortfolio.holdings.map((h) => {
                      const current = holdings.find((hh) => hh.symbol === h.symbol);
                      const currentPct = totalValue > 0 && current?.currentPrice !== null && current
                        ? (current.quantity * (current.currentPrice ?? 0) / totalValue) * 100
                        : null;
                      return (
                        <div key={h.symbol} className="flex items-center gap-2">
                          <span className="font-mono text-[11px] font-bold text-primary w-20 shrink-0 truncate">{h.symbol}</span>
                          <div className="flex-1 min-w-0">
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{ width: `${h.weight}%`, backgroundColor: targetPortfolio.color, opacity: 0.7 }}
                              />
                            </div>
                          </div>
                          <span className="text-[11px] font-mono text-muted-foreground w-9 text-right shrink-0">
                            {h.weight}%
                          </span>
                          {currentPct !== null && (
                            <span className={cn(
                              "text-[10px] font-mono w-12 text-right shrink-0",
                              Math.abs(currentPct - h.weight) > 3 ? "text-amber-500" : "text-green-500"
                            )}>
                              ({currentPct.toFixed(1)}%)
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {currentPctNote(holdings, totalValue) && (
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Info className="w-3 h-3 shrink-0" />
                      괄호 안 숫자는 현재 실제 비중입니다
                    </p>
                  )}

                  {rebalanceDone && (
                    <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                      <p className="text-xs text-green-600 dark:text-green-400 font-medium">리밸런싱 완료!</p>
                    </div>
                  )}

                  {rebalanceError && (
                    <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                      <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
                      <p className="text-xs text-destructive">{rebalanceError}</p>
                    </div>
                  )}

                  {/* Preview of trades */}
                  {rebalancePreview && rebalancePreview.length > 0 && (
                    <div className="flex flex-col gap-2 bg-muted/40 rounded-lg p-3">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                        실행 예정 거래 ({rebalancePreview.length}건)
                      </p>
                      <div className="flex flex-col gap-1">
                        {rebalancePreview.map((t, i) => (
                          <div key={i} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5">
                              <span className={cn(
                                "px-1.5 py-0.5 rounded text-[10px] font-bold",
                                t.type === "buy" ? "bg-green-500/20 text-green-600 dark:text-green-400" : "bg-red-500/20 text-red-500"
                              )}>
                                {t.type === "buy" ? "매수" : "매도"}
                              </span>
                              <span className="font-mono font-semibold text-foreground">{t.symbol}</span>
                            </div>
                            <div className="text-right">
                              <span className="font-mono text-foreground">{fmtQty(t.quantity)}주</span>
                              <span className="text-muted-foreground ml-1 text-[10px]">
                                ≈{fmtPrice(t.quantity * t.price, t.currency)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        총 포트폴리오 기준가: {fmtValue(rebalanceTotalValue, rebalancePreview[0]?.currency ?? "USD")}
                      </p>
                      <div className="flex gap-2 mt-1">
                        <button
                          onClick={executeRebalance}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:opacity-90 active:scale-[0.98] transition-all"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          확인 및 실행
                        </button>
                        <button
                          onClick={() => { setRebalancePreview(null); setRebalanceError(null); }}
                          className="px-3 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all border border-border"
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  )}

                  {rebalancePreview && rebalancePreview.length === 0 && (
                    <div className="bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
                      <p className="text-xs text-green-600 dark:text-green-400">이미 목표 비중에 근접해 있습니다.</p>
                    </div>
                  )}

                  {!rebalancePreview && (
                    <button
                      onClick={buildRebalancePreview}
                      disabled={rebalancing || holdings.length === 0}
                      className={cn(
                        "flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition-all",
                        rebalancing || holdings.length === 0
                          ? "bg-muted text-muted-foreground cursor-not-allowed"
                          : "bg-primary/10 text-primary hover:bg-primary/20 border border-primary/30 active:scale-[0.98]"
                      )}
                    >
                      {rebalancing
                        ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />계산 중...</>
                        : <><Scale className="w-3.5 h-3.5" />리밸런싱 계획 미리보기</>}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* ─ Trade form ─ */}
            <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
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
              <div className="hidden lg:flex items-center gap-2 px-5 py-4 border-b border-border">
                <TrendingUp className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">매수 / 매도</h2>
              </div>

              <div className={cn("flex flex-col gap-4 p-4 sm:p-5", "lg:flex", formOpen ? "flex" : "hidden")}>
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

                <SymbolSearch onSelect={handleSelectSymbol} placeholder="종목 검색..." />

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
                          ? <><p className="text-sm font-mono font-bold text-foreground">{fmtPrice(quoteData.price, quoteData.currency)}</p><p className="text-[10px] text-muted-foreground">{quoteData.currency}</p></>
                          : <p className="text-xs text-destructive">조회 실패</p>}
                    </div>
                  </div>
                )}

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
                    <p className="text-xs text-muted-foreground pl-1">≈ {fmtPrice(quoteData.price * parseFloat(quantity), quoteData.currency)}</p>
                  )}
                </div>

                {tradeError && (
                  <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-xs text-destructive">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />{tradeError}
                  </div>
                )}
                {tradeSuccess && (
                  <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 text-xs text-green-600 dark:text-green-400">{tradeSuccess}</div>
                )}

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

            {tradeSuccess && !formOpen && (
              <div className="lg:hidden bg-green-500/10 border border-green-500/20 rounded-lg p-3 text-xs text-green-600 dark:text-green-400 text-center">
                {tradeSuccess}
              </div>
            )}
          </aside>

          {/* ═══ RIGHT PANEL ═══ */}
          <section className="min-w-0">
            <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
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
                          const target = targetPortfolio?.holdings.find((t) => t.symbol === h.symbol);
                          return (
                            <tr key={h.symbol} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                              <td className="px-3 sm:px-4 py-3">
                                <p className="font-mono font-bold text-primary">{h.symbol}</p>
                                <p className="text-muted-foreground truncate max-w-[100px]">{h.name}</p>
                                {target && (
                                  <p className="text-[9px] text-primary/60 font-mono">목표 {target.weight}%</p>
                                )}
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
                                pnl === null ? "" : pnl >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500")}>
                                {pnl !== null
                                  ? <span className="flex items-center gap-0.5">
                                      {pnl >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                                      {(pnl >= 0 ? "+" : "") + fmtValue(pnl, h.currency)}
                                    </span>
                                  : "—"}
                              </td>
                              <td className={cn("px-3 sm:px-4 py-3 font-mono font-semibold",
                                pct === null ? "" : pct >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500")}>
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

function currentPctNote(holdings: Holding[], totalValue: number): boolean {
  return holdings.length > 0 && totalValue > 0;
}
