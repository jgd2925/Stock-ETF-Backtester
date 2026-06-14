import { useState, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { PortfolioBuilder } from "@/components/PortfolioBuilder";
import { BacktestSettings } from "@/components/BacktestSettings";
import { ResultsChart } from "@/components/ResultsChart";
import { ResultsTable } from "@/components/ResultsTable";
import { AnnualReturnsTable } from "@/components/AnnualReturnsTable";
import { SymbolBreakdown } from "@/components/SymbolBreakdown";
import { NavHeader } from "@/components/NavHeader";
import { fetchHistoricalData } from "@/lib/api";
import { runBacktest } from "@/lib/backtest";
import type { BacktestOptions, BacktestResult } from "@/lib/backtest";
import { saveTargetPortfolio } from "@/lib/localTrades";
import { cn } from "@/lib/utils";
import {
  Play, Loader2, BarChart3, AlertCircle,
  ChevronDown, ChevronUp, Download, RefreshCw,
  TrendingUp, CheckCircle2, Info,
} from "lucide-react";

const PORTFOLIO_COLORS = ["#3B82F6", "#22C55E", "#F59E0B", "#EF4444", "#A855F7"];

interface Portfolio {
  id: string;
  label: string;
  color: string;
  holdings: Array<{ symbol: string; name: string; weight: number }>;
}

const STORAGE_KEY = "portfolio-backtester-state";

function defaultPortfolios(): Portfolio[] {
  return [{ id: "p1", label: "포트폴리오 1", color: PORTFOLIO_COLORS[0], holdings: [] }];
}

function defaultOptions(): BacktestOptions {
  const end = new Date(); end.setDate(1);
  const start = new Date(end); start.setFullYear(start.getFullYear() - 10);
  return { startDate: start, endDate: end, initialAmount: 10_000_000, monthlyContribution: 500_000, reinvestDividends: true, rebalancePeriod: "annually", contributionDay: 1 };
}

function loadFromStorage(): { portfolios: Portfolio[]; options: BacktestOptions } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const opts = parsed.options;
    return {
      portfolios: parsed.portfolios ?? defaultPortfolios(),
      options: { ...defaultOptions(), ...opts, startDate: new Date(opts.startDate), endDate: new Date(opts.endDate) },
    };
  } catch { return null; }
}

function exportCsv(results: BacktestResult[]) {
  if (results.length === 0) return;
  const header = ["날짜", ...results.flatMap((r) => [`${r.label} 자산`, `${r.label} 투자금`, `${r.label} 수익률(%)`])];
  const allDates = new Set<number>();
  results.forEach((r) => r.series.forEach((p) => allDates.add(p.date)));
  const sortedDates = [...allDates].sort((a, b) => a - b);
  const rows = sortedDates.map((date) => {
    const d = new Date(date).toISOString().slice(0, 10);
    const cols: (string | number)[] = [d];
    results.forEach((r) => {
      const point = r.series.find((p) => p.date === date);
      if (point) {
        const ret = point.invested > 0 ? ((point.value - point.invested) / point.invested) * 100 : 0;
        cols.push(Math.round(point.value), Math.round(point.invested), ret.toFixed(2));
      } else { cols.push("", "", ""); }
    });
    return cols;
  });
  const csv = [header, ...rows].map((r) => r.join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url;
  a.download = `backtest_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  URL.revokeObjectURL(url);
}

function fmtFinalValue(v: number) {
  if (v >= 1_000_000_000_000) return `${(v / 1_000_000_000_000).toFixed(1)}조`;
  if (v >= 100_000_000) return `${(v / 100_000_000).toFixed(2)}억`;
  if (v >= 10_000) return `${(v / 10_000).toFixed(0)}만`;
  return String(Math.round(v));
}

export default function Home() {
  const [, navigate] = useLocation();
  const [isDark, setIsDark] = useState(() =>
    typeof window !== "undefined" ? document.documentElement.classList.contains("dark") : false
  );
  const [portfolios, setPortfolios] = useState<Portfolio[]>(() => loadFromStorage()?.portfolios ?? defaultPortfolios());
  const [options, setOptions] = useState<BacktestOptions>(() => loadFromStorage()?.options ?? defaultOptions());
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<BacktestResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fxConverted, setFxConverted] = useState(false);
  const [activeResultTab, setActiveResultTab] = useState<"chart" | "metrics" | "annual" | "symbols">("chart");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [appliedPortfolioId, setAppliedPortfolioId] = useState<string | null>(null);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ portfolios, options })); } catch {}
  }, [portfolios, options]);

  function toggleDark() {
    document.documentElement.classList.toggle("dark");
    setIsDark((d) => !d);
  }

  function applyToMockTrading(portfolioId: string, label: string, color: string) {
    const portfolio = portfolios.find((p) => p.id === portfolioId);
    if (!portfolio) return;
    saveTargetPortfolio({ label, color, holdings: portfolio.holdings });
    setAppliedPortfolioId(portfolioId);
    setTimeout(() => { setAppliedPortfolioId(null); navigate("/paper-trading"); }, 800);
  }

  const runBacktests = useCallback(async () => {
    setError(null);
    const validPortfolios = portfolios.filter(
      (p) => p.holdings.length > 0 && Math.abs(p.holdings.reduce((s, h) => s + h.weight, 0) - 100) <= 1
    );
    if (validPortfolios.length === 0) {
      setError("최소 하나의 포트폴리오에 종목을 추가하고 비중 합계가 100%인지 확인하세요.");
      return;
    }
    setRunning(true); setResults([]); setFxConverted(false);
    try {
      const allSymbols = new Set<string>();
      validPortfolios.forEach((p) => p.holdings.forEach((h) => allSymbols.add(h.symbol)));
      const dataMap: Record<string, { prices: any[]; dividends: any[]; currency: string }> = {};
      const fetchResults = await Promise.allSettled(
        [...allSymbols].map(async (symbol) => {
          const data = await fetchHistoricalData(symbol, options.startDate, options.endDate);
          dataMap[symbol] = data;
        })
      );
      const errors: string[] = [];
      fetchResults.forEach((r, i) => {
        if (r.status === "rejected") errors.push(`${[...allSymbols][i]}: ${(r.reason as Error)?.message ?? "데이터 로드 실패"}`);
      });
      if (errors.length > 0) setError(`일부 종목 데이터를 불러오지 못했습니다:\n${errors.join("\n")}`);

      const loadedSymbols = Object.keys(dataMap);
      const hasKRW = loadedSymbols.some((s) => dataMap[s].currency === "KRW");
      const hasUSD = loadedSymbols.some((s) => dataMap[s].currency === "USD");
      if (hasKRW && hasUSD) {
        try {
          const fxData = await fetchHistoricalData("USDKRW=X", options.startDate, options.endDate);
          const fxPrices = fxData.prices;
          function getFxRate(date: number): number {
            if (fxPrices.length === 0) return 1300;
            let closest = fxPrices[0];
            for (const p of fxPrices) { if (Math.abs(p.date - date) < Math.abs(closest.date - date)) closest = p; }
            return closest.adjClose > 0 ? closest.adjClose : 1300;
          }
          for (const symbol of loadedSymbols) {
            if (dataMap[symbol].currency === "USD") {
              dataMap[symbol].prices = dataMap[symbol].prices.map((p: any) => {
                const rate = getFxRate(p.date);
                return { ...p, open: p.open * rate, high: p.high * rate, low: p.low * rate, close: p.close * rate, adjClose: p.adjClose * rate };
              });
              dataMap[symbol].dividends = dataMap[symbol].dividends.map((d: any) => ({ ...d, amount: d.amount * getFxRate(d.date) }));
              dataMap[symbol].currency = "KRW";
            }
          }
          setFxConverted(true);
        } catch {
          setError("환율(USDKRW) 데이터를 불러오지 못했습니다. 결과가 부정확할 수 있습니다.");
        }
      }
      const backtestResults: BacktestResult[] = validPortfolios.map((p) => {
        const assetsData = p.holdings.filter((h) => dataMap[h.symbol]).map((h) => ({
          symbol: h.symbol, prices: dataMap[h.symbol].prices, dividends: dataMap[h.symbol].dividends,
        }));
        return runBacktest(p.holdings.filter((h) => dataMap[h.symbol]), assetsData, options, p.id, p.label, p.color);
      });
      setResults(backtestResults.filter((r) => r.series.length > 0));
    } catch (e: unknown) {
      setError(`백테스팅 중 오류가 발생했습니다: ${(e as Error).message}`);
    } finally { setRunning(false); }
  }, [portfolios, options]);

  const hasValidPortfolio = portfolios.some(
    (p) => p.holdings.length > 0 && Math.abs(p.holdings.reduce((s, h) => s + h.weight, 0) - 100) <= 1
  );

  return (
    <div className="min-h-screen bg-background">
      <NavHeader isDark={isDark} onToggleDark={toggleDark} />

      <main className="max-w-7xl mx-auto px-3 sm:px-5 py-4 sm:py-6 pb-24 lg:pb-6">
        <div className="grid grid-cols-1 lg:grid-cols-[480px_1fr] xl:grid-cols-[520px_1fr] gap-4 lg:gap-5">

          {/* ── LEFT: Config panel ── */}
          <aside className="flex flex-col gap-3">

            {/* Portfolio builder card */}
            <div className="bg-card border border-card-border rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-foreground">포트폴리오 구성</h2>
                  <span className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded-full font-medium">{portfolios.length}개</span>
                </div>
              </div>
              <div className="p-4">
                <PortfolioBuilder portfolios={portfolios} onChange={setPortfolios} />
              </div>

              {/* Apply to paper trading */}
              {portfolios.some((p) => p.holdings.length > 0 && Math.abs(p.holdings.reduce((s, h) => s + h.weight, 0) - 100) <= 1) && (
                <div className="border-t border-border px-4 py-3 bg-muted/30">
                  <div className="flex items-center gap-1.5 mb-2">
                    <TrendingUp className="w-3 h-3 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground font-medium">모의투자에 적용</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {portfolios
                      .filter((p) => p.holdings.length > 0 && Math.abs(p.holdings.reduce((s, h) => s + h.weight, 0) - 100) <= 1)
                      .map((p) => (
                        <button
                          key={p.id}
                          onClick={() => applyToMockTrading(p.id, p.label, p.color)}
                          className={cn(
                            "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all",
                            appliedPortfolioId === p.id
                              ? "bg-green-500/10 border-green-500/30 text-green-600 dark:text-green-400"
                              : "border-border text-muted-foreground hover:text-foreground hover:bg-card"
                          )}
                        >
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                          {p.label}
                          {appliedPortfolioId === p.id
                            ? <CheckCircle2 className="w-3 h-3" />
                            : <TrendingUp className="w-3 h-3 opacity-50" />}
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </div>

            {/* Settings card */}
            <div className="bg-card border border-card-border rounded-2xl shadow-sm overflow-hidden">
              <button
                data-testid="button-toggle-settings"
                onClick={() => setSettingsOpen((v) => !v)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/30 transition-colors"
              >
                <h2 className="text-sm font-semibold text-foreground">백테스팅 설정</h2>
                <div className="flex items-center gap-2">
                  {!settingsOpen && (
                    <span className="text-[10px] text-muted-foreground">
                      {(() => {
                        const yrs = Math.round((options.endDate.getTime() - options.startDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
                        const amt = options.initialAmount >= 100_000_000 ? `${(options.initialAmount / 100_000_000).toFixed(0)}억` : `${(options.initialAmount / 10_000).toFixed(0)}만`;
                        return `${yrs}년 · ${amt}원`;
                      })()}
                    </span>
                  )}
                  {settingsOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </div>
              </button>
              {settingsOpen && (
                <div className="p-4 border-t border-border">
                  <BacktestSettings options={options} onChange={setOptions} />
                </div>
              )}
            </div>

            {/* Run button — desktop only (mobile has sticky button) */}
            <div className="hidden lg:flex flex-col gap-2">
              <button
                data-testid="button-run-backtest"
                onClick={runBacktests}
                disabled={running || !hasValidPortfolio}
                className={cn(
                  "flex items-center justify-center gap-2 w-full py-3 rounded-xl font-semibold text-sm transition-all shadow-sm",
                  running || !hasValidPortfolio
                    ? "bg-muted text-muted-foreground cursor-not-allowed"
                    : "bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.99]",
                )}
              >
                {running ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />데이터 수집 중...</>
                ) : (
                  <><Play className="w-4 h-4 fill-current" />백테스팅 실행</>
                )}
              </button>
              {!hasValidPortfolio && !running && (
                <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                  <Info className="w-3 h-3" />
                  종목 추가 후 비중 합계를 100%로 맞춰주세요
                </div>
              )}
              {error && (
                <div className="flex gap-2 bg-destructive/8 border border-destructive/20 rounded-xl p-3 text-xs text-destructive">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <pre className="whitespace-pre-wrap font-sans">{error}</pre>
                </div>
              )}
            </div>
          </aside>

          {/* ── RIGHT: Results panel ── */}
          <section className="flex flex-col gap-3 min-w-0">

            {/* Error / fx notice */}
            {error && (
              <div className="lg:hidden flex gap-2 bg-destructive/8 border border-destructive/20 rounded-xl p-3 text-xs text-destructive">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <pre className="whitespace-pre-wrap font-sans">{error}</pre>
              </div>
            )}
            {fxConverted && (
              <div className="flex items-center gap-2 bg-blue-500/8 border border-blue-500/20 rounded-xl px-4 py-2.5 text-xs text-blue-700 dark:text-blue-300">
                <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                USD 자산 가격이 기간별 실제 USD/KRW 환율로 원화 환산되었습니다.
              </div>
            )}

            {results.length === 0 && !running ? (
              /* Empty state */
              <div className="flex flex-col items-center justify-center min-h-[420px] bg-card border border-card-border rounded-2xl gap-5 p-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <BarChart3 className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <p className="text-base font-semibold text-foreground">백테스팅을 시작하세요</p>
                  <p className="text-sm text-muted-foreground mt-1">과거 데이터로 포트폴리오 성과를 시뮬레이션합니다</p>
                </div>
                <div className="grid grid-cols-3 gap-3 w-full max-w-xs">
                  {[
                    { n: "1", title: "종목 추가", desc: "검색 또는 인기 종목" },
                    { n: "2", title: "비중 설정", desc: "합계 100% 맞추기" },
                    { n: "3", title: "실행", desc: "결과 분석" },
                  ].map((s) => (
                    <div key={s.n} className="flex flex-col items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-bold flex items-center justify-center">{s.n}</div>
                      <p className="text-xs font-semibold text-foreground">{s.title}</p>
                      <p className="text-[10px] text-muted-foreground">{s.desc}</p>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground/60 mt-1">* 과거 성과는 미래 수익을 보장하지 않습니다</p>
              </div>

            ) : running ? (
              /* Loading */
              <div className="flex flex-col items-center justify-center min-h-[420px] bg-card border border-card-border rounded-2xl gap-4">
                <div className="relative">
                  <Loader2 className="w-10 h-10 text-primary animate-spin" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-foreground">백테스팅 중...</p>
                  <p className="text-xs text-muted-foreground mt-1">실시간 데이터를 수집하고 계산 중입니다</p>
                </div>
              </div>

            ) : (
              <>
                {/* Tabs + chart */}
                <div className="bg-card border border-card-border rounded-2xl shadow-sm overflow-hidden">
                  <div className="border-b border-border flex items-center px-3 overflow-x-auto scrollbar-none">
                    {(["chart", "metrics", "annual", "symbols"] as const).map((tab) => (
                      <button
                        key={tab}
                        data-testid={`tab-result-${tab}`}
                        onClick={() => setActiveResultTab(tab)}
                        className={cn(
                          "px-3 py-3.5 text-xs font-medium border-b-2 transition-all -mb-px whitespace-nowrap shrink-0",
                          activeResultTab === tab
                            ? "border-primary text-primary"
                            : "border-transparent text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {tab === "chart" ? "📈 차트" : tab === "metrics" ? "📊 성과 지표" : tab === "annual" ? "📅 연도별" : "🔍 종목별"}
                      </button>
                    ))}
                    <div className="ml-auto shrink-0 pl-2">
                      <button
                        data-testid="button-export-csv"
                        onClick={() => exportCsv(results)}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-all"
                        title="CSV 내보내기"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">CSV</span>
                      </button>
                    </div>
                  </div>
                  <div className="p-4">
                    {activeResultTab === "chart"   && <ResultsChart results={results} />}
                    {activeResultTab === "metrics" && <ResultsTable results={results} />}
                    {activeResultTab === "annual"  && <AnnualReturnsTable results={results} />}
                    {activeResultTab === "symbols" && <SymbolBreakdown results={results} />}
                  </div>
                </div>

                {/* Summary cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
                  {results.map((r) => (
                    <div
                      key={r.portfolioId}
                      data-testid={`card-result-${r.portfolioId}`}
                      className="bg-card border border-card-border rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
                        <span className="text-xs font-semibold text-foreground truncate flex-1">{r.label}</span>
                        <span className={cn(
                          "text-xs font-mono font-bold tabular-nums",
                          r.totalReturn >= 0 ? "text-green-600 dark:text-green-400" : "text-destructive"
                        )}>
                          {r.totalReturn >= 0 ? "+" : ""}{r.totalReturn.toFixed(1)}%
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mb-3">
                        <div>
                          <p className="text-[10px] text-muted-foreground">CAGR</p>
                          <p className={cn("text-xs font-mono font-semibold tabular-nums", r.cagr >= 0 ? "text-foreground" : "text-destructive")}>
                            {r.cagr >= 0 ? "+" : ""}{r.cagr.toFixed(2)}%
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground">최대 낙폭</p>
                          <p className="text-xs font-mono font-semibold tabular-nums text-red-500">-{r.maxDrawdown.toFixed(1)}%</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground">변동성</p>
                          <p className="text-xs font-mono font-semibold tabular-nums text-foreground">{r.volatility.toFixed(1)}%</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground">최종 자산</p>
                          <p className="text-xs font-mono font-bold tabular-nums text-foreground">{fmtFinalValue(r.finalValue)}</p>
                        </div>
                      </div>

                      <button
                        onClick={() => applyToMockTrading(r.portfolioId, r.label, r.color)}
                        className={cn(
                          "w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-medium border transition-all",
                          appliedPortfolioId === r.portfolioId
                            ? "bg-green-500/10 border-green-500/30 text-green-600 dark:text-green-400"
                            : "border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                        )}
                      >
                        {appliedPortfolioId === r.portfolioId
                          ? <><CheckCircle2 className="w-3 h-3" />모의투자 이동 중...</>
                          : <><TrendingUp className="w-3 h-3" />모의투자에 적용</>}
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>
      </main>

      {/* ── Mobile sticky run button ── */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-md border-t border-border px-4 py-3 safe-bottom">
        <button
          data-testid="button-run-backtest"
          onClick={runBacktests}
          disabled={running || !hasValidPortfolio}
          className={cn(
            "flex items-center justify-center gap-2 w-full py-3.5 rounded-xl font-semibold text-sm transition-all shadow-lg",
            running || !hasValidPortfolio
              ? "bg-muted text-muted-foreground cursor-not-allowed"
              : "bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.99]",
          )}
        >
          {running ? (
            <><Loader2 className="w-4 h-4 animate-spin" />데이터 수집 중...</>
          ) : (
            <><Play className="w-4 h-4 fill-current" />{hasValidPortfolio ? "백테스팅 실행" : "종목 추가 후 실행 가능"}</>
          )}
        </button>
      </div>
    </div>
  );
}
