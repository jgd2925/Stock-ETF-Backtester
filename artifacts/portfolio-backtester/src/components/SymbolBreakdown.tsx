import { useState } from "react";
import { TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp, Info } from "lucide-react";
import type { BacktestResult, SymbolResult } from "@/lib/backtest";
import { cn } from "@/lib/utils";

interface Props {
  results: BacktestResult[];
}

function fmt(v: number, decimals = 2): string {
  return `${v >= 0 ? "+" : ""}${v.toFixed(decimals)}%`;
}

function fmtCompact(v: number): string {
  if (Math.abs(v) >= 1_000_000_000_000) return `${(v / 1_000_000_000_000).toFixed(2)}조`;
  if (Math.abs(v) >= 100_000_000) return `${(v / 100_000_000).toFixed(2)}억`;
  if (Math.abs(v) >= 10_000) return `${Math.round(v / 10_000).toLocaleString()}만`;
  return Math.round(v).toLocaleString();
}

function heatColor(value: number): string {
  if (value >= 40) return "bg-green-700 dark:bg-green-800 text-white";
  if (value >= 25) return "bg-green-600 dark:bg-green-700 text-white";
  if (value >= 15) return "bg-green-500 dark:bg-green-600 text-white";
  if (value >= 5) return "bg-green-400/80 dark:bg-green-700/60 text-green-900 dark:text-green-100";
  if (value >= -5) return "bg-muted text-foreground";
  if (value >= -15) return "bg-red-300/80 dark:bg-red-800/60 text-red-900 dark:text-red-100";
  if (value >= -25) return "bg-red-400 dark:bg-red-700 text-white";
  if (value >= -35) return "bg-red-500 dark:bg-red-800 text-white";
  return "bg-red-700 dark:bg-red-900 text-white";
}

interface MetricColDef {
  key: keyof SymbolResult;
  label: string;
  sublabel?: string;
  format: (v: SymbolResult) => string;
  higherIsBetter: boolean;
  colorize?: boolean;
}

const METRIC_COLS: MetricColDef[] = [
  {
    key: "weight",
    label: "비중",
    format: (s) => `${s.weight.toFixed(1)}%`,
    higherIsBetter: true,
  },
  {
    key: "investedAmount",
    label: "투자금액",
    sublabel: "순매수",
    format: (s) => fmtCompact(s.investedAmount),
    higherIsBetter: true,
  },
  {
    key: "finalValue",
    label: "평가금액",
    format: (s) => fmtCompact(s.finalValue),
    higherIsBetter: true,
  },
  {
    key: "gainLoss",
    label: "평가손익",
    format: (s) => (s.gainLoss >= 0 ? "+" : "") + fmtCompact(s.gainLoss),
    higherIsBetter: true,
    colorize: true,
  },
  {
    key: "totalReturn",
    label: "총 수익률",
    format: (s) => fmt(s.totalReturn),
    higherIsBetter: true,
    colorize: true,
  },
  {
    key: "cagr",
    label: "CAGR",
    sublabel: "연평균",
    format: (s) => fmt(s.cagr),
    higherIsBetter: true,
    colorize: true,
  },
  {
    key: "maxDrawdown",
    label: "MDD",
    sublabel: "최대낙폭",
    format: (s) => `-${s.maxDrawdown.toFixed(2)}%`,
    higherIsBetter: false,
    colorize: true,
  },
  {
    key: "volatility",
    label: "변동성",
    sublabel: "연간",
    format: (s) => `${s.volatility.toFixed(2)}%`,
    higherIsBetter: false,
    colorize: true,
  },
  {
    key: "totalDividends",
    label: "배당수령액",
    format: (s) => s.totalDividends > 0 ? fmtCompact(s.totalDividends) : "—",
    higherIsBetter: true,
  },
];

function SymbolRow({ symbol, expanded, onToggle }: { symbol: SymbolResult; expanded: boolean; onToggle: () => void }) {
  const pct = symbol.totalReturn;
  const isMDD = symbol.maxDrawdown;

  return (
    <>
      <tr
        className="border-b border-border/50 hover:bg-muted/20 transition-colors cursor-pointer"
        onClick={onToggle}
      >
        <td className="py-3 px-3 sticky left-0 bg-card z-10">
          <div className="flex items-center gap-1.5 min-w-[100px]">
            <div className="w-1.5 h-8 rounded-full shrink-0" style={{ backgroundColor: pct >= 0 ? "#22c55e" : "#ef4444" }} />
            <div>
              <p className="text-xs font-mono font-bold text-primary">{symbol.symbol}</p>
              <p className="text-[10px] text-muted-foreground truncate max-w-[80px]">{symbol.name}</p>
            </div>
            <span className="ml-1 text-muted-foreground">
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </span>
          </div>
        </td>
        {METRIC_COLS.map((col) => {
          const formatted = col.format(symbol);
          const rawVal = symbol[col.key] as number;
          let colorClass = "";
          if (col.colorize) {
            if (col.key === "maxDrawdown" || col.key === "volatility") {
              colorClass = "text-red-500 dark:text-red-400";
            } else {
              colorClass = rawVal >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400";
            }
          } else {
            colorClass = "text-foreground";
          }

          return (
            <td key={col.key} className="py-3 px-3 text-right">
              <span className={cn("text-xs font-mono font-semibold", colorClass)}>
                {formatted}
              </span>
            </td>
          );
        })}
      </tr>
      {expanded && (
        <tr className="border-b border-border bg-muted/10">
          <td colSpan={METRIC_COLS.length + 1} className="px-3 py-3">
            <div className="flex flex-col gap-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                {symbol.symbol} — 연도별 수익률
              </p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(symbol.annualReturns)
                  .sort(([a], [b]) => parseInt(a) - parseInt(b))
                  .map(([year, ret]) => (
                    <div
                      key={year}
                      className={cn(
                        "flex flex-col items-center justify-center rounded-lg w-14 h-10 text-center transition-all",
                        heatColor(ret)
                      )}
                    >
                      <span className="text-[9px] font-semibold opacity-80">{year}</span>
                      <span className="text-[10px] font-mono font-bold leading-none">
                        {ret >= 0 ? "+" : ""}{ret.toFixed(1)}%
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function AnnualHeatmap({ symbols, years }: { symbols: SymbolResult[]; years: number[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse min-w-[500px]">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground w-28 sticky left-0 bg-card">종목</th>
            {years.map((y) => (
              <th key={y} className="text-center py-2 px-1 text-xs font-mono font-semibold text-muted-foreground min-w-[52px]">
                {y}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {symbols.map((s) => (
            <tr key={s.symbol} className="border-b border-border/30">
              <td className="py-2 px-3 sticky left-0 bg-card">
                <p className="font-mono font-bold text-primary text-[11px]">{s.symbol}</p>
                <p className="text-[9px] text-muted-foreground truncate max-w-[90px]">{s.name}</p>
              </td>
              {years.map((y) => {
                const ret = s.annualReturns[y];
                if (ret === undefined) {
                  return (
                    <td key={y} className="py-1 px-1 text-center">
                      <span className="text-[10px] text-muted-foreground">—</span>
                    </td>
                  );
                }
                return (
                  <td key={y} className="py-1 px-1 text-center">
                    <div className={cn("rounded-md px-1 py-1.5 text-center mx-0.5", heatColor(ret))}>
                      <span className="text-[10px] font-mono font-semibold leading-none">
                        {ret >= 0 ? "+" : ""}{ret.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SymbolBreakdown({ results }: Props) {
  const [selectedId, setSelectedId] = useState<string>(() => results[0]?.portfolioId ?? "");
  const [expandedSymbols, setExpandedSymbols] = useState<Set<string>>(new Set());
  const [annualView, setAnnualView] = useState<"heatmap" | "chart">("heatmap");

  if (results.length === 0) return null;

  const selected = results.find((r) => r.portfolioId === selectedId) ?? results[0];
  const symbols = selected?.symbolResults ?? [];

  if (symbols.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        종목 데이터가 없습니다.
      </div>
    );
  }

  const allYears = new Set<number>();
  symbols.forEach((s) => Object.keys(s.annualReturns).forEach((y) => allYears.add(parseInt(y))));
  const sortedYears = [...allYears].sort((a, b) => a - b);

  function toggleSymbol(sym: string) {
    setExpandedSymbols((prev) => {
      const next = new Set(prev);
      if (next.has(sym)) next.delete(sym);
      else next.add(sym);
      return next;
    });
  }

  // Best values for highlighting
  const bestReturn = Math.max(...symbols.map((s) => s.totalReturn));
  const bestCagr = Math.max(...symbols.map((s) => s.cagr));
  const bestMDD = Math.min(...symbols.map((s) => s.maxDrawdown));

  return (
    <div className="flex flex-col gap-5">
      {/* Portfolio selector */}
      {results.length > 1 && (
        <div className="flex gap-1.5 flex-wrap">
          {results.map((r) => (
            <button
              key={r.portfolioId}
              onClick={() => setSelectedId(r.portfolioId)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border",
                selectedId === r.portfolioId
                  ? "border-current text-white shadow-sm"
                  : "border-border text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
              style={selectedId === r.portfolioId ? { backgroundColor: r.color, borderColor: r.color } : {}}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: r.color }} />
              {r.label}
            </button>
          ))}
        </div>
      )}

      {/* Summary info banner */}
      <div className="flex flex-wrap gap-3">
        <div className="bg-muted/50 rounded-lg px-3 py-2 flex items-center gap-2">
          <TrendingUp className="w-3.5 h-3.5 text-green-500 shrink-0" />
          <div>
            <p className="text-[10px] text-muted-foreground">포트폴리오 총 투자금</p>
            <p className="text-xs font-mono font-bold text-foreground">{fmtCompact(selected.totalContributions)}</p>
          </div>
        </div>
        <div className="bg-muted/50 rounded-lg px-3 py-2 flex items-center gap-2">
          <TrendingUp className="w-3.5 h-3.5 text-primary shrink-0" />
          <div>
            <p className="text-[10px] text-muted-foreground">최종 자산</p>
            <p className="text-xs font-mono font-bold text-foreground">{fmtCompact(selected.finalValue)}</p>
          </div>
        </div>
        <div className="bg-muted/50 rounded-lg px-3 py-2 flex items-center gap-2">
          {selected.totalReturn >= 0
            ? <TrendingUp className="w-3.5 h-3.5 text-green-500 shrink-0" />
            : <TrendingDown className="w-3.5 h-3.5 text-red-500 shrink-0" />}
          <div>
            <p className="text-[10px] text-muted-foreground">총 수익률</p>
            <p className={cn("text-xs font-mono font-bold", selected.totalReturn >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500")}>
              {fmt(selected.totalReturn)}
            </p>
          </div>
        </div>
        <div className="bg-muted/50 rounded-lg px-3 py-2 flex items-center gap-2">
          <Info className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <p className="text-[10px] text-muted-foreground">종목 클릭 시 연도별 수익률 표시</p>
        </div>
      </div>

      {/* ── Per-symbol overview table ── */}
      <div>
        <p className="text-xs font-semibold text-foreground mb-2">종목별 상세 성과</p>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-xs border-collapse min-w-[700px]">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground sticky left-0 bg-muted/50 z-10">
                  종목
                </th>
                {METRIC_COLS.map((col) => (
                  <th key={col.key} className="text-right py-2.5 px-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">
                    {col.label}
                    {col.sublabel && (
                      <span className="block text-[9px] font-normal opacity-70">{col.sublabel}</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {symbols.map((s) => (
                <SymbolRow
                  key={s.symbol}
                  symbol={s}
                  expanded={expandedSymbols.has(s.symbol)}
                  onToggle={() => toggleSymbol(s.symbol)}
                />
              ))}
              {/* Total row */}
              <tr className="border-t-2 border-border bg-muted/30">
                <td className="py-2.5 px-3 sticky left-0 bg-muted/30 z-10">
                  <p className="text-xs font-bold text-foreground">합계 / 포트폴리오</p>
                </td>
                <td className="py-2.5 px-3 text-right">
                  <span className="text-xs font-mono font-bold text-foreground">100%</span>
                </td>
                <td className="py-2.5 px-3 text-right">
                  <span className="text-xs font-mono font-semibold text-foreground">{fmtCompact(selected.totalContributions)}</span>
                </td>
                <td className="py-2.5 px-3 text-right">
                  <span className="text-xs font-mono font-semibold text-foreground">{fmtCompact(selected.finalValue)}</span>
                </td>
                <td className="py-2.5 px-3 text-right">
                  <span className={cn("text-xs font-mono font-bold", selected.finalValue - selected.totalContributions >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500")}>
                    {(selected.finalValue - selected.totalContributions) >= 0 ? "+" : ""}
                    {fmtCompact(selected.finalValue - selected.totalContributions)}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-right">
                  <span className={cn("text-xs font-mono font-bold", selected.totalReturn >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500")}>
                    {fmt(selected.totalReturn)}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-right">
                  <span className={cn("text-xs font-mono font-bold", selected.cagr >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500")}>
                    {fmt(selected.cagr)}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-right">
                  <span className="text-xs font-mono font-bold text-red-500">-{selected.maxDrawdown.toFixed(2)}%</span>
                </td>
                <td className="py-2.5 px-3 text-right">
                  <span className="text-xs font-mono font-semibold text-foreground">{selected.volatility.toFixed(2)}%</span>
                </td>
                <td className="py-2.5 px-3 text-right">
                  <span className="text-xs font-mono font-semibold text-foreground">
                    {selected.totalDividends > 0 ? fmtCompact(selected.totalDividends) : "—"}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        {symbols.length > 1 && (
          <div className="flex flex-wrap gap-3 mt-2 px-1">
            {[
              { label: "수익률 최고", symbol: symbols.find((s) => s.totalReturn === bestReturn)?.symbol },
              { label: "CAGR 최고", symbol: symbols.find((s) => s.cagr === bestCagr)?.symbol },
              { label: "MDD 최저", symbol: symbols.find((s) => s.maxDrawdown === bestMDD)?.symbol },
            ].map((item) => item.symbol && (
              <div key={item.label} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <span className="text-yellow-500">★</span>
                <span>{item.label}:</span>
                <span className="font-mono font-semibold text-foreground">{item.symbol}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Annual returns heatmap ── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-foreground">종목별 연도별 수익률</p>
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="flex gap-0.5">
                {[-30, -15, 0, 15, 30].map((v) => (
                  <div key={v} className={cn("w-4 h-3 rounded-sm", heatColor(v))} />
                ))}
              </div>
              <span>낮음 → 높음</span>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-border overflow-hidden">
          <AnnualHeatmap symbols={symbols} years={sortedYears} />
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5 px-1">
          * 연도별 수익률은 해당 연도 첫 데이터 대비 마지막 데이터 기준입니다. DCA·리밸런싱 효과가 포함됩니다.
        </p>
      </div>

      {/* ── Additional indicators ── */}
      {symbols.length > 1 && (
        <div>
          <p className="text-xs font-semibold text-foreground mb-2">종목별 기여도 분석</p>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground">종목</th>
                  <th className="text-right py-2.5 px-3 text-xs font-semibold text-muted-foreground">목표 비중</th>
                  <th className="text-right py-2.5 px-3 text-xs font-semibold text-muted-foreground">실제 비중</th>
                  <th className="text-right py-2.5 px-3 text-xs font-semibold text-muted-foreground">평가금액 기여</th>
                  <th className="text-right py-2.5 px-3 text-xs font-semibold text-muted-foreground">비중 드리프트</th>
                  <th className="py-2.5 px-3 text-xs font-semibold text-muted-foreground">비중 바</th>
                </tr>
              </thead>
              <tbody>
                {symbols.map((s) => {
                  const actualPct = selected.finalValue > 0 ? (s.finalValue / selected.finalValue) * 100 : 0;
                  const drift = actualPct - s.weight;
                  const barWidth = Math.min(100, actualPct);

                  return (
                    <tr key={s.symbol} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="py-2.5 px-3">
                        <p className="font-mono font-bold text-primary">{s.symbol}</p>
                        <p className="text-[10px] text-muted-foreground truncate max-w-[100px]">{s.name}</p>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">{s.weight.toFixed(1)}%</td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-foreground">{actualPct.toFixed(1)}%</td>
                      <td className="py-2.5 px-3 text-right font-mono text-foreground">{fmtCompact(s.finalValue)}</td>
                      <td className={cn(
                        "py-2.5 px-3 text-right font-mono font-semibold",
                        Math.abs(drift) < 1 ? "text-muted-foreground" : drift > 0 ? "text-green-600 dark:text-green-400" : "text-red-500"
                      )}>
                        {drift >= 0 ? "+" : ""}{drift.toFixed(1)}%p
                      </td>
                      <td className="py-2.5 px-3 w-24">
                        <div className="flex items-center gap-1.5">
                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${barWidth}%`, backgroundColor: selected.color }}
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5 px-1">
            * 실제 비중은 최종 시점 기준입니다. 리밸런싱 설정에 따라 목표 비중과 차이가 날 수 있습니다.
          </p>
        </div>
      )}
    </div>
  );
}
