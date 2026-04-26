import type { BacktestResult } from "@/lib/backtest";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, AlertTriangle, BarChart2, Gift } from "lucide-react";

interface Props {
  results: BacktestResult[];
}

interface MetricCard {
  icon: typeof TrendingUp;
  label: string;
  key: keyof BacktestResult;
  format: (v: number) => string;
  higherIsBetter: boolean;
}

const METRICS: MetricCard[] = [
  { icon: TrendingUp, label: "최종 자산", key: "finalValue", format: (v) => formatCurrency(v, true), higherIsBetter: true },
  { icon: TrendingUp, label: "총 수익률", key: "totalReturn", format: (v) => formatPercent(v), higherIsBetter: true },
  { icon: BarChart2, label: "연평균 수익률 (CAGR)", key: "cagr", format: (v) => formatPercent(v), higherIsBetter: true },
  { icon: AlertTriangle, label: "최대 낙폭 (MDD)", key: "maxDrawdown", format: (v) => `-${Math.abs(v).toFixed(2)}%`, higherIsBetter: false },
  { icon: BarChart2, label: "샤프 비율", key: "sharpeRatio", format: (v) => v.toFixed(3), higherIsBetter: true },
  { icon: BarChart2, label: "연간 변동성", key: "volatility", format: (v) => `${v.toFixed(2)}%`, higherIsBetter: false },
  { icon: TrendingUp, label: "월간 상승 비율", key: "winRate", format: (v) => `${v.toFixed(1)}%`, higherIsBetter: true },
  { icon: Gift, label: "총 배당금", key: "totalDividends", format: (v) => formatCurrency(v, true), higherIsBetter: true },
];

export function ResultsTable({ results }: Props) {
  if (results.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse" data-testid="table-results">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground w-40">지표</th>
              {results.map((r) => (
                <th key={r.portfolioId} className="text-right py-2 px-3 text-xs font-semibold" style={{ color: r.color }}>
                  {r.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {METRICS.map((metric) => {
              const values = results.map((r) => r[metric.key] as number);
              const best = metric.higherIsBetter ? Math.max(...values) : Math.min(...values);

              return (
                <tr key={metric.key} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2">
                      <metric.icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="text-xs text-muted-foreground">{metric.label}</span>
                    </div>
                  </td>
                  {results.map((r) => {
                    const val = r[metric.key] as number;
                    const isBest = values.length > 1 && val === best;
                    const isPositive = metric.higherIsBetter ? val > 0 : val < 0;

                    return (
                      <td
                        key={r.portfolioId}
                        data-testid={`cell-${metric.key}-${r.portfolioId}`}
                        className={cn(
                          "text-right py-2.5 px-3 font-mono text-xs font-semibold",
                          isBest
                            ? metric.higherIsBetter
                              ? "text-green-600 dark:text-green-400"
                              : "text-green-600 dark:text-green-400"
                            : isPositive
                            ? "text-foreground"
                            : "text-destructive"
                        )}
                      >
                        <span className="flex items-center justify-end gap-1">
                          {isBest && values.length > 1 && (
                            <span className="text-green-500 text-[10px]">★</span>
                          )}
                          {metric.format(val)}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            <tr className="border-b border-border/50 hover:bg-muted/30 transition-colors">
              <td className="py-2.5 px-3">
                <div className="flex items-center gap-2">
                  <TrendingDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs text-muted-foreground">총 투자금</span>
                </div>
              </td>
              {results.map((r) => (
                <td key={r.portfolioId} className="text-right py-2.5 px-3 font-mono text-xs text-muted-foreground">
                  {formatCurrency(r.totalContributions, true)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {results.some((r) => r.totalDividends > 0) && (
        <div className="bg-accent/50 rounded-lg px-4 py-3 text-xs text-accent-foreground flex items-center gap-2">
          <Gift className="w-3.5 h-3.5 shrink-0" />
          <span>배당금은 현지 통화 기준으로 표시됩니다. 혼합 포트폴리오의 경우 단순 합산 값입니다.</span>
        </div>
      )}
    </div>
  );
}
