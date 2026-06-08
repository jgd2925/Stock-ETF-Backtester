import { useState, useEffect, useCallback } from "react";
import {
  TrendingUp, Loader2, AlertCircle, Plus, Minus, RefreshCw,
  Trash2, LogIn, ArrowUpRight, ArrowDownRight
} from "lucide-react";
import { NavHeader } from "@/components/NavHeader";
import { AuthModal } from "@/components/AuthModal";
import { SymbolSearch } from "@/components/SymbolSearch";
import { useAuth } from "@/contexts/AuthContext";
import { supabase, type PaperTrade } from "@/lib/supabase";
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

function computeHoldings(trades: PaperTrade[]): Record<string, Omit<Holding, "currentPrice" | "loadingPrice">> {
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
  return Object.fromEntries(
    Object.entries(map)
      .filter(([, h]) => h.quantity > 0.0001)
      .map(([symbol, h]) => [symbol, { symbol, name: h.name, quantity: h.quantity, avgCost: h.quantity > 0 ? h.totalCost / h.quantity : 0, currency: h.currency }])
  );
}

function formatPrice(price: number, currency: string) {
  if (currency === "KRW") return `₩${Math.round(price).toLocaleString()}`;
  return `$${price.toFixed(2)}`;
}

function formatValue(value: number, currency: string) {
  if (currency === "KRW") {
    if (Math.abs(value) >= 100_000_000) return `${(value / 100_000_000).toFixed(2)}억원`;
    if (Math.abs(value) >= 10_000) return `${Math.round(value / 10_000).toLocaleString()}만원`;
    return `₩${Math.round(value).toLocaleString()}`;
  }
  return `$${value.toFixed(2)}`;
}

export default function PaperTrading() {
  const { user, loading: authLoading } = useAuth();
  const [isDark, setIsDark] = useState(() =>
    typeof window !== "undefined" ? document.documentElement.classList.contains("dark") : false
  );
  const [authOpen, setAuthOpen] = useState(false);
  const [tab, setTab] = useState<"holdings" | "history">("holdings");

  const [trades, setTrades] = useState<PaperTrade[]>([]);
  const [loadingTrades, setLoadingTrades] = useState(false);

  const [holdings, setHoldings] = useState<Holding[]>([]);

  const [selectedSymbol, setSelectedSymbol] = useState<SearchResult | null>(null);
  const [tradeType, setTradeType] = useState<"buy" | "sell">("buy");
  const [quantity, setQuantity] = useState("");
  const [quoteData, setQuoteData] = useState<{ price: number; currency: string; name: string } | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [tradeError, setTradeError] = useState<string | null>(null);
  const [tradeSuccess, setTradeSuccess] = useState<string | null>(null);

  function toggleDark() {
    document.documentElement.classList.toggle("dark");
    setIsDark((d) => !d);
  }

  const loadTrades = useCallback(async () => {
    if (!user) return;
    setLoadingTrades(true);
    const { data, error } = await supabase
      .from("paper_trades")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });
    if (!error && data) setTrades(data as PaperTrade[]);
    setLoadingTrades(false);
  }, [user]);

  useEffect(() => {
    loadTrades();
  }, [loadTrades]);

  const refreshHoldingPrices = useCallback(async (baseHoldings: Omit<Holding, "currentPrice" | "loadingPrice">[]) => {
    const withLoading: Holding[] = baseHoldings.map((h) => ({ ...h, currentPrice: null, loadingPrice: true }));
    setHoldings(withLoading);
    const updated = await Promise.all(
      withLoading.map(async (h) => {
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
    const map = computeHoldings(trades);
    const list = Object.values(map);
    refreshHoldingPrices(list);
  }, [trades, refreshHoldingPrices]);

  useEffect(() => {
    if (!selectedSymbol) { setQuoteData(null); return; }
    setLoadingQuote(true);
    fetchQuote(selectedSymbol.symbol).then((q) => {
      setQuoteData(q);
      setLoadingQuote(false);
    });
  }, [selectedSymbol]);

  async function executeTrade() {
    if (!user || !selectedSymbol || !quoteData) return;
    const qty = parseFloat(quantity);
    if (!qty || qty <= 0) { setTradeError("수량을 입력하세요."); return; }

    if (tradeType === "sell") {
      const hMap = computeHoldings(trades);
      const held = hMap[selectedSymbol.symbol];
      if (!held || held.quantity < qty) {
        setTradeError(`보유 수량이 부족합니다. (보유: ${held?.quantity.toFixed(4) ?? 0}주)`);
        return;
      }
    }

    setTradeError(null);
    setSubmitting(true);
    const { error } = await supabase.from("paper_trades").insert({
      user_id: user.id,
      symbol: selectedSymbol.symbol,
      name: quoteData.name || selectedSymbol.shortName,
      type: tradeType,
      quantity: qty,
      price: quoteData.price,
      currency: quoteData.currency,
    });

    if (error) {
      setTradeError(error.message);
    } else {
      setTradeSuccess(`${selectedSymbol.symbol} ${qty}주 ${tradeType === "buy" ? "매수" : "매도"} 완료`);
      setQuantity("");
      setSelectedSymbol(null);
      setQuoteData(null);
      await loadTrades();
      setTimeout(() => setTradeSuccess(null), 3000);
    }
    setSubmitting(false);
  }

  async function deleteTrade(id: string) {
    if (!confirm("이 거래를 삭제하시겠습니까?")) return;
    await supabase.from("paper_trades").delete().eq("id", id);
    await loadTrades();
  }

  const totalValue = holdings.reduce((sum, h) => {
    if (h.currentPrice === null) return sum;
    return sum + h.quantity * h.currentPrice;
  }, 0);

  const totalCost = holdings.reduce((sum, h) => sum + h.quantity * h.avgCost, 0);
  const totalPnl = totalValue - totalCost;
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

  const mixedCurrency = holdings.length > 0 && new Set(holdings.map((h) => h.currency)).size > 1;

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <NavHeader isDark={isDark} onToggleDark={toggleDark} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {!user ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <TrendingUp className="w-8 h-8 text-primary" />
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-foreground">모의투자</p>
              <p className="text-sm text-muted-foreground mt-1">
                로그인하면 가상으로 종목을 매수/매도하고 수익률을 추적할 수 있습니다
              </p>
            </div>
            <button
              onClick={() => setAuthOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-all"
            >
              <LogIn className="w-4 h-4" />
              로그인 / 회원가입
            </button>
            <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
            <aside className="flex flex-col gap-4">
              <div className="bg-card border border-border rounded-xl shadow-sm p-5 flex flex-col gap-4">
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  매수 / 매도
                </h2>

                <div className="flex gap-1 bg-muted rounded-lg p-1">
                  {(["buy", "sell"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => { setTradeType(t); setTradeError(null); }}
                      className={cn(
                        "flex-1 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-1",
                        t === "buy"
                          ? tradeType === "buy" ? "bg-green-500 text-white shadow" : "text-muted-foreground hover:text-foreground"
                          : tradeType === "sell" ? "bg-red-500 text-white shadow" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {t === "buy" ? <Plus className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                      {t === "buy" ? "매수" : "매도"}
                    </button>
                  ))}
                </div>

                <SymbolSearch
                  onSelect={(r) => { setSelectedSymbol(r); setTradeError(null); }}
                  placeholder="종목 검색..."
                />

                {selectedSymbol && (
                  <div className="bg-muted/60 rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-mono font-bold text-primary">{selectedSymbol.symbol}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-[160px]">{selectedSymbol.shortName}</p>
                    </div>
                    <div className="text-right">
                      {loadingQuote ? (
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground ml-auto" />
                      ) : quoteData ? (
                        <>
                          <p className="text-sm font-mono font-bold text-foreground">
                            {formatPrice(quoteData.price, quoteData.currency)}
                          </p>
                          <p className="text-[10px] text-muted-foreground">{quoteData.currency}</p>
                        </>
                      ) : (
                        <p className="text-xs text-destructive">시세 조회 실패</p>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">수량 (주)</label>
                  <div className="flex items-center gap-2 border border-border bg-background rounded-md px-3 py-2 focus-within:ring-1 focus-within:ring-primary/50 focus-within:border-primary transition-all">
                    <input
                      type="number"
                      min="0"
                      step="0.0001"
                      value={quantity}
                      onChange={(e) => { setQuantity(e.target.value); setTradeError(null); }}
                      placeholder="0"
                      className="flex-1 bg-transparent outline-none text-sm font-mono"
                    />
                    <span className="text-xs text-muted-foreground">주</span>
                  </div>
                  {quoteData && quantity && parseFloat(quantity) > 0 && (
                    <p className="text-xs text-muted-foreground">
                      ≈ {formatPrice(quoteData.price * parseFloat(quantity), quoteData.currency)}
                    </p>
                  )}
                </div>

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

                <button
                  onClick={executeTrade}
                  disabled={submitting || !selectedSymbol || !quoteData || !quantity}
                  className={cn(
                    "flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all",
                    submitting || !selectedSymbol || !quoteData || !quantity
                      ? "bg-muted text-muted-foreground cursor-not-allowed"
                      : tradeType === "buy"
                        ? "bg-green-500 text-white hover:bg-green-600"
                        : "bg-red-500 text-white hover:bg-red-600"
                  )}
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : tradeType === "buy" ? (
                    <><Plus className="w-4 h-4" />매수 주문</>
                  ) : (
                    <><Minus className="w-4 h-4" />매도 주문</>
                  )}
                </button>
              </div>

              {!loadingTrades && holdings.length > 0 && (
                <div className="grid grid-cols-2 gap-3">
                  {[
                    {
                      label: "총 평가금액",
                      value: mixedCurrency ? "—" : formatValue(totalValue, holdings[0]?.currency ?? "USD"),
                      sub: null,
                    },
                    {
                      label: "평가손익",
                      value: mixedCurrency ? "—" : (totalPnl >= 0 ? "+" : "") + formatValue(totalPnl, holdings[0]?.currency ?? "USD"),
                      sub: `${totalPnlPct >= 0 ? "+" : ""}${totalPnlPct.toFixed(2)}%`,
                      positive: totalPnl >= 0,
                    },
                  ].map((card) => (
                    <div key={card.label} className="bg-card border border-border rounded-xl p-3 shadow-sm">
                      <p className="text-[10px] text-muted-foreground mb-1">{card.label}</p>
                      <p className={cn("text-sm font-mono font-bold", card.positive === undefined ? "text-foreground" : card.positive ? "text-green-600 dark:text-green-400" : "text-red-500")}>
                        {card.value}
                      </p>
                      {card.sub && (
                        <p className={cn("text-[10px] font-mono", card.positive ? "text-green-500" : "text-red-500")}>
                          {card.sub}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </aside>

            <section className="flex flex-col gap-4">
              <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
                <div className="border-b border-border flex items-center px-4 py-0">
                  {(["holdings", "history"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTab(t)}
                      className={cn(
                        "px-4 py-3.5 text-xs font-medium border-b-2 transition-all -mb-px",
                        tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {t === "holdings" ? `보유 종목 (${holdings.filter((h) => (h.currentPrice ?? 0) > 0 || h.loadingPrice).length})` : "거래 내역"}
                    </button>
                  ))}
                  <button
                    onClick={() => refreshHoldingPrices(Object.values(computeHoldings(trades)))}
                    className="ml-auto p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-all"
                    title="시세 새로고침"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="p-0 overflow-x-auto">
                  {tab === "holdings" ? (
                    loadingTrades ? (
                      <div className="flex justify-center py-12">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                      </div>
                    ) : holdings.length === 0 ? (
                      <div className="text-center py-12 text-sm text-muted-foreground">
                        보유 종목이 없습니다. 왼쪽에서 종목을 매수해보세요.
                      </div>
                    ) : (
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-border bg-muted/40">
                            {["종목", "수량", "평균단가", "현재가", "평가금액", "손익", "수익률"].map((h) => (
                              <th key={h} className="px-4 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {holdings.map((h) => {
                            const currentVal = h.currentPrice !== null ? h.quantity * h.currentPrice : null;
                            const costVal = h.quantity * h.avgCost;
                            const pnl = currentVal !== null ? currentVal - costVal : null;
                            const pnlPct = pnl !== null && costVal > 0 ? (pnl / costVal) * 100 : null;
                            return (
                              <tr key={h.symbol} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                                <td className="px-4 py-3">
                                  <p className="font-mono font-bold text-primary">{h.symbol}</p>
                                  <p className="text-muted-foreground truncate max-w-[120px]">{h.name}</p>
                                </td>
                                <td className="px-4 py-3 font-mono">{h.quantity % 1 === 0 ? h.quantity : h.quantity.toFixed(4)}</td>
                                <td className="px-4 py-3 font-mono">{formatPrice(h.avgCost, h.currency)}</td>
                                <td className="px-4 py-3 font-mono">
                                  {h.loadingPrice ? (
                                    <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                                  ) : h.currentPrice !== null ? (
                                    formatPrice(h.currentPrice, h.currency)
                                  ) : "—"}
                                </td>
                                <td className="px-4 py-3 font-mono">
                                  {currentVal !== null ? formatValue(currentVal, h.currency) : "—"}
                                </td>
                                <td className={cn("px-4 py-3 font-mono font-semibold", pnl === null ? "" : pnl >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500")}>
                                  {pnl !== null ? (
                                    <span className="flex items-center gap-0.5">
                                      {pnl >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                                      {(pnl >= 0 ? "+" : "") + formatValue(pnl, h.currency)}
                                    </span>
                                  ) : "—"}
                                </td>
                                <td className={cn("px-4 py-3 font-mono font-semibold", pnlPct === null ? "" : pnlPct >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500")}>
                                  {pnlPct !== null ? `${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(2)}%` : "—"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )
                  ) : (
                    loadingTrades ? (
                      <div className="flex justify-center py-12">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                      </div>
                    ) : trades.length === 0 ? (
                      <div className="text-center py-12 text-sm text-muted-foreground">
                        거래 내역이 없습니다.
                      </div>
                    ) : (
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-border bg-muted/40">
                            {["날짜", "종목", "유형", "수량", "체결가", "합계", ""].map((h, i) => (
                              <th key={i} className="px-4 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {[...trades].reverse().map((t) => (
                            <tr key={t.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                              <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                                {new Date(t.created_at).toLocaleDateString("ko-KR", { year: "2-digit", month: "2-digit", day: "2-digit" })}
                              </td>
                              <td className="px-4 py-3">
                                <span className="font-mono font-bold text-primary">{t.symbol}</span>
                              </td>
                              <td className="px-4 py-3">
                                <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold", t.type === "buy" ? "bg-green-500/15 text-green-600 dark:text-green-400" : "bg-red-500/15 text-red-500")}>
                                  {t.type === "buy" ? "매수" : "매도"}
                                </span>
                              </td>
                              <td className="px-4 py-3 font-mono">{t.quantity % 1 === 0 ? t.quantity : Number(t.quantity).toFixed(4)}</td>
                              <td className="px-4 py-3 font-mono">{formatPrice(t.price, t.currency)}</td>
                              <td className="px-4 py-3 font-mono">{formatPrice(t.quantity * t.price, t.currency)}</td>
                              <td className="px-4 py-3">
                                <button
                                  onClick={() => deleteTrade(t.id)}
                                  className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                                  title="거래 삭제"
                                >
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
        )}
      </main>

      <footer className="border-t border-border mt-8 py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <p className="text-xs text-muted-foreground text-center">
            모의투자는 실제 투자가 아닙니다 · 데이터 출처: Yahoo Finance · 실제 체결가와 차이가 있을 수 있습니다
          </p>
        </div>
      </footer>
    </div>
  );
}
