import { useState, useCallback, useEffect } from "react";
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
import { cn } from "@/lib/utils";
import {
  Play,
  Loader2,
  BarChart3,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Download,
  RefreshCw,
} from "lucide-react";

const PORTFOLIO_COLORS = [
  "#3B82F6",
  "#22C55E",
  "#F59E0B",
  "#EF4444",
  "#A855F7",
];

interface Portfolio {
  id: string;
  label: string;
  color: string;
  holdings: Array<{ symbol: string; name: string; weight: number }>;
}

const STORAGE_KEY = "portfolio-backtester-state";

function defaultPortfolios(): Portfolio[] {
  return [
    {
      id: "p1",
      label: "포트폴리오 1",
      color: PORTFOLIO_COLORS[0],
      holdings: [],
    },
  ];
}

function defaultOptions(): BacktestOptions {
  const end = new Date();
  end.setDate(1);
  const start = new Date(end);
  start.setFullYear(start.getFullYear() - 10);
  return {
    startDate: start,
    endDate: end,
    initialAmount: 10_000_000,
    monthlyContribution: 500_000,
    reinvestDividends: true,
    rebalancePeriod: "annually",
    contributionDay: 1,
  };
}

function loadFromStorage(): {
  portfolios: Portfolio[];
  options: BacktestOptions;
} | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const opts = parsed.options;
    return {
      portfolios: parsed.portfolios ?? defaultPortfolios(),
      options: {
        ...defaultOptions(),
        ...opts,
        startDate: new Date(opts.startDate),
        endDate: new Date(opts.endDate),
      },
    };
  } catch {
    return null;
  }
}

function exportCsv(results: BacktestResult[]) {
  if (results.length === 0) return;
  const header = [
    "날짜",
    ...results.flatMap((r) => [
      `${r.label} 자산`,
      `${r.label} 투자금`,
      `${r.label} 수익률(%)`,
    ]),
  ];
  const allDates = new Set<number>();
  results.forEach((r) => r.series.forEach((p) => allDates.add(p.date)));
  const sortedDates = [...allDates].sort((a, b) => a - b);
  const rows = sortedDates.map((date) => {
    const d = new Date(date).toISOString().slice(0, 10);
    const cols: (string | number)[] = [d];
    results.forEach((r) => {
      const point = r.series.find((p) => p.date === date);
      if (point) {
        const ret =
          point.invested > 0
            ? ((point.value - point.invested) / point.invested) * 100
            : 0;
        cols.push(
          Math.round(point.value),
          Math.round(point.invested),
          ret.toFixed(2),
        );
      } else {
        cols.push("", "", "");
      }
    });
    return cols;
  });
  const csv = [header, ...rows].map((r) => r.join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `backtest_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Home() {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== "undefined") {
      return document.documentElement.classList.contains("dark");
    }
    return false;
  });

  const [portfolios, setPortfolios] = useState<Portfolio[]>(
    () => loadFromStorage()?.portfolios ?? defaultPortfolios(),
  );
  const [options, setOptions] = useState<BacktestOptions>(
    () => loadFromStorage()?.options ?? defaultOptions(),
  );
  const [running, setRunning] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ portfolios, options }),
      );
    } catch {}
  }, [portfolios, options]);

  const [results, setResults] = useState<BacktestResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fxConverted, setFxConverted] = useState(false);
  const [activeResultTab, setActiveResultTab] = useState<
    "chart" | "metrics" | "annual" | "symbols"
  >("chart");
  const [settingsOpen, setSettingsOpen] = useState(true);

  function toggleDark() {
    document.documentElement.classList.toggle("dark");
    setIsDark((d) => !d);
  }

  const runBacktests = useCallback(async () => {
    setError(null);

    const validPortfolios = portfolios.filter(
      (p) =>
        p.holdings.length > 0 &&
        Math.abs(p.holdings.reduce((s, h) => s + h.weight, 0) - 100) <= 1,
    );

    if (validPortfolios.length === 0) {
      setError(
        "최소 하나의 포트폴리오에 종목을 추가하고 비중 합계가 100%인지 확인하세요.",
      );
      return;
    }

    setRunning(true);
    setResults([]);
    setFxConverted(false);

    try {
      const allSymbols = new Set<string>();
      validPortfolios.forEach((p) =>
        p.holdings.forEach((h) => allSymbols.add(h.symbol)),
      );

      const dataMap: Record<string, { prices: any[]; dividends: any[]; currency: string }> = {};
      const fetchResults = await Promise.allSettled(
        [...allSymbols].map(async (symbol) => {
          const data = await fetchHistoricalData(
            symbol,
            options.startDate,
            options.endDate,
          );
          dataMap[symbol] = data;
        }),
      );

      const errors: string[] = [];
      fetchResults.forEach((r, i) => {
        if (r.status === "rejected") {
          errors.push(
            `${[...allSymbols][i]}: ${r.reason?.message ?? "데이터 로드 실패"}`,
          );
        }
      });

      if (errors.length > 0) {
        setError(
          `일부 종목 데이터를 불러오지 못했습니다:\n${errors.join("\n")}`,
        );
      }

      // 통화 혼용 감지 및 환율 변환
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
            for (const p of fxPrices) {
              if (Math.abs(p.date - date) < Math.abs(closest.date - date)) closest = p;
            }
            return closest.adjClose > 0 ? closest.adjClose : 1300;
          }

          for (const symbol of loadedSymbols) {
            if (dataMap[symbol].currency === "USD") {
              dataMap[symbol].prices = dataMap[symbol].prices.map((p: any) => {
                const rate = getFxRate(p.date);
                return {
                  ...p,
                  open: p.open * rate,
                  high: p.high * rate,
                  low: p.low * rate,
                  close: p.close * rate,
                  adjClose: p.adjClose * rate,
                };
              });
              dataMap[symbol].dividends = dataMap[symbol].dividends.map((d: any) => ({
                ...d,
                amount: d.amount * getFxRate(d.date),
              }));
              dataMap[symbol].currency = "KRW";
            }
          }
          setFxConverted(true);
        } catch {
          setError("환율(USDKRW) 데이터를 불러오지 못했습니다. USD 자산이 원화 자산과 비교되면 결과가 부정확할 수 있습니다.");
        }
      }

      const backtestResults: BacktestResult[] = validPortfolios.map(
        (p) => {
          const assetsData = p.holdings
            .filter((h) => dataMap[h.symbol])
            .map((h) => ({
              symbol: h.symbol,
              prices: dataMap[h.symbol].prices,
              dividends: dataMap[h.symbol].dividends,
            }));

          return runBacktest(
            p.holdings.filter((h) => dataMap[h.symbol]),
            assetsData,
            options,
            p.id,
            p.label,
            p.color,
          );
        },
      );

      setResults(backtestResults.filter((r) => r.series.length > 0));
    } catch (e: unknown) {
      const err = e as Error;
      setError(`백테스팅 중 오류가 발생했습니다: ${err.message}`);
    } finally {
      setRunning(false);
    }
  }, [portfolios, options]);

  const hasValidPortfolio = portfolios.some(
    (p) =>
      p.holdings.length > 0 &&
      Math.abs(p.holdings.reduce((s, h) => s + h.weight, 0) - 100) <= 1,
  );

  return (
    <div className="min-h-screen bg-background">
      <NavHeader isDark={isDark} onToggleDark={toggleDark} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[550px_1fr] gap-6">
          <aside className="flex flex-col gap-4">
            <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">
                  포트폴리오 구성
                </h2>
                <span className="text-xs text-muted-foreground">
                  {portfolios.length}개 포트폴리오
                </span>
              </div>
              <div className="p-5">
                <PortfolioBuilder
                  portfolios={portfolios}
                  onChange={setPortfolios}
                />
              </div>
            </div>

            <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
              <button
                data-testid="button-toggle-settings"
                onClick={() => setSettingsOpen((v) => !v)}
                className="w-full px-5 py-4 border-b border-border flex items-center justify-between hover:bg-muted/30 transition-colors"
              >
                <h2 className="text-sm font-semibold text-foreground">
                  백테스팅 설정
                </h2>
                {settingsOpen ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                )}
              </button>
              {settingsOpen && (
                <div className="p-5">
                  <BacktestSettings options={options} onChange={setOptions} />
                </div>
              )}
            </div>

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
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  데이터 수집 중...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  백테스팅 실행
                </>
              )}
            </button>

            {!hasValidPortfolio && !running && (
              <p className="text-xs text-muted-foreground text-center -mt-2">
                종목을 추가하고 비중 합계를 100%로 맞춰주세요
              </p>
            )}

            {error && (
              <div className="flex gap-2 bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-xs text-destructive">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <pre className="whitespace-pre-wrap font-sans">{error}</pre>
              </div>
            )}

            <div className="bg-accent/40 rounded-xl p-4 text-xs text-accent-foreground space-y-1.5">
              <p className="font-semibold text-sm">사용 방법</p>
              <p>1. 종목 검색 후 추가 (한국: 005930.KS, 미국: SPY, QQQ)</p>
              <p>2. 각 종목의 비중 설정 (합계 100%)</p>
              <p>3. 기간, 투자금, 적립식, 배당 설정</p>
              <p>4. 백테스팅 실행 후 결과 비교</p>
              <p className="text-muted-foreground pt-1">
                * 과거 데이터는 미래 수익을 보장하지 않습니다
              </p>
            </div>
          </aside>

          <section className="flex flex-col gap-4">
            {results.length === 0 && !running ? (
              <div className="flex flex-col items-center justify-center min-h-96 bg-card border border-card-border rounded-xl gap-4">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <BarChart3 className="w-8 h-8 text-primary" />
                </div>
                <div className="text-center">
                  <p className="text-base font-semibold text-foreground">
                    백테스팅을 시작하세요
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    종목을 추가하고 실행하면 결과가 여기에 표시됩니다
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-3 mt-2 w-full max-w-sm">
                  {[
                    { label: "S&P 500", example: "SPY" },
                    { label: "나스닥 100", example: "QQQ" },
                    { label: "삼성전자", example: "005930.KS" },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="bg-muted rounded-lg p-2.5 text-center"
                    >
                      <p className="text-xs font-mono font-semibold text-primary">
                        {item.example}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {item.label}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : running ? (
              <div className="flex flex-col items-center justify-center min-h-96 bg-card border border-card-border rounded-xl gap-4">
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
                <div className="text-center">
                  <p className="text-sm font-semibold text-foreground">
                    백테스팅 중...
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    실시간 시세 데이터를 수집하고 계산하고 있습니다
                  </p>
                </div>
              </div>
            ) : (
              <>
                {fxConverted && (
                  <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-lg px-4 py-2.5 text-xs text-blue-700 dark:text-blue-300">
                    <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                    USD 자산 가격이 기간별 실제 USD/KRW 환율로 원화 환산되어 계산되었습니다.
                  </div>
                )}
                <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
                  <div className="border-b border-border flex items-center gap-1 px-4 py-0">
                    {(["chart", "metrics", "annual", "symbols"] as const).map((tab) => (
                      <button
                        key={tab}
                        data-testid={`tab-result-${tab}`}
                        onClick={() => setActiveResultTab(tab)}
                        className={cn(
                          "px-3 sm:px-4 py-3.5 text-xs font-medium border-b-2 transition-all -mb-px whitespace-nowrap",
                          activeResultTab === tab
                            ? "border-primary text-primary"
                            : "border-transparent text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {tab === "chart"
                          ? "차트"
                          : tab === "metrics"
                            ? "성과 지표"
                            : tab === "annual"
                              ? "연도별 수익률"
                              : "종목별 분석"}
                      </button>
                    ))}
                    <div className="ml-auto">
                      <button
                        data-testid="button-export-csv"
                        onClick={() => exportCsv(results)}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-all"
                        title="CSV로 내보내기"
                      >
                        <Download className="w-3.5 h-3.5" />
                        CSV
                      </button>
                    </div>
                  </div>
                  <div className="p-5">
                    {activeResultTab === "chart" && (
                      <ResultsChart results={results} />
                    )}
                    {activeResultTab === "metrics" && (
                      <ResultsTable results={results} />
                    )}
                    {activeResultTab === "annual" && (
                      <AnnualReturnsTable results={results} />
                    )}
                    {activeResultTab === "symbols" && (
                      <SymbolBreakdown results={results} />
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-3">
                  {results.map((r) => (
                    <div
                      key={r.portfolioId}
                      data-testid={`card-result-${r.portfolioId}`}
                      className="bg-card border border-card-border rounded-xl p-4 shadow-sm"
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: r.color }}
                        />
                        <span className="text-xs font-semibold text-foreground truncate">
                          {r.label}
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center">
                          <span className="text-[11px] text-muted-foreground">
                            총 수익률
                          </span>
                          <span
                            className={cn(
                              "text-xs font-mono font-bold",
                              r.totalReturn >= 0
                                ? "text-green-600 dark:text-green-400"
                                : "text-destructive",
                            )}
                          >
                            {r.totalReturn >= 0 ? "+" : ""}
                            {r.totalReturn.toFixed(2)}%
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[11px] text-muted-foreground">
                            CAGR
                          </span>
                          <span
                            className={cn(
                              "text-xs font-mono font-semibold",
                              r.cagr >= 0
                                ? "text-foreground"
                                : "text-destructive",
                            )}
                          >
                            {r.cagr >= 0 ? "+" : ""}
                            {r.cagr.toFixed(2)}%
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[11px] text-muted-foreground">
                            MDD
                          </span>
                          <span className="text-xs font-mono font-semibold text-destructive">
                            -{r.maxDrawdown.toFixed(2)}%
                          </span>
                        </div>
                        <div className="pt-1 border-t border-border">
                          <div className="flex justify-between items-center">
                            <span className="text-[11px] text-muted-foreground">
                              최종 자산
                            </span>
                            <span className="text-xs font-mono font-bold text-foreground">
                              {r.finalValue >= 100_000_000
                                ? `${(r.finalValue / 100_000_000).toFixed(2)}억`
                                : r.finalValue >= 10_000
                                  ? `${(r.finalValue / 10_000).toFixed(0)}만`
                                  : r.finalValue.toFixed(0)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>
      </main>

      <footer className="border-t border-border mt-8 py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <p className="text-xs text-muted-foreground text-center">
            데이터 출처: Yahoo Finance · 과거 성과는 미래 수익을 보장하지
            않습니다 · 투자는 본인의 판단과 책임 하에 하시기 바랍니다
          </p>
        </div>
      </footer>
    </div>
  );
}
