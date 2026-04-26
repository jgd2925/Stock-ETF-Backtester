import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import type { BacktestResult, MonthlyPoint } from "@/lib/backtest";
import { cn } from "@/lib/utils";

interface Props {
  results: BacktestResult[];
}

function getAnnualReturns(series: MonthlyPoint[]): Record<number, number> {
  const byYear: Record<number, MonthlyPoint[]> = {};
  series.forEach((p) => {
    const y = new Date(p.date).getFullYear();
    if (!byYear[y]) byYear[y] = [];
    byYear[y].push(p);
  });

  const annual: Record<number, number> = {};
  Object.entries(byYear).forEach(([yearStr, points]) => {
    const year = parseInt(yearStr);
    const first = points[0].value;
    const last = points[points.length - 1].value;
    annual[year] = first > 0 ? ((last - first) / first) * 100 : 0;
  });
  return annual;
}

export function AnnualReturnsTable({ results }: Props) {
  const [viewMode, setViewMode] = useState<"table" | "chart">("chart");

  if (results.length === 0 || results.every((r) => r.series.length === 0)) return null;

  const allYears = new Set<number>();
  results.forEach((r) => {
    Object.keys(getAnnualReturns(r.series)).forEach((y) => allYears.add(parseInt(y)));
  });
  const sortedYears = [...allYears].sort((a, b) => a - b);

  const annualByResult: Record<string, Record<number, number>> = {};
  results.forEach((r) => {
    annualByResult[r.portfolioId] = getAnnualReturns(r.series);
  });

  const chartData = sortedYears.map((year) => {
    const point: Record<string, number | string> = { year: String(year) };
    results.forEach((r) => {
      const val = annualByResult[r.portfolioId]?.[year];
      if (val !== undefined) point[r.portfolioId] = parseFloat(val.toFixed(2));
    });
    return point;
  });

  function TooltipContent({ active, payload, label }: { active?: boolean; payload?: Array<{ color: string; name: string; value: number }>; label?: string }) {
    if (!active || !payload || payload.length === 0) return null;
    return (
      <div className="bg-popover border border-popover-border rounded-lg shadow-lg p-3 text-sm min-w-40">
        <p className="text-muted-foreground text-xs mb-2">{label}년</p>
        {payload.map((entry) => (
          <div key={entry.name} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-foreground text-xs">
                {results.find((r) => r.portfolioId === entry.name)?.label ?? entry.name}
              </span>
            </div>
            <span className={cn("font-mono font-semibold text-xs", entry.value >= 0 ? "text-green-600 dark:text-green-400" : "text-destructive")}>
              {entry.value >= 0 ? "+" : ""}{entry.value.toFixed(2)}%
            </span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-end gap-1">
        <button
          onClick={() => setViewMode("chart")}
          className={cn(
            "px-3 py-1.5 rounded-md text-xs font-medium transition-all",
            viewMode === "chart" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"
          )}
        >
          차트
        </button>
        <button
          onClick={() => setViewMode("table")}
          className={cn(
            "px-3 py-1.5 rounded-md text-xs font-medium transition-all",
            viewMode === "table" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"
          )}
        >
          표
        </button>
      </div>

      {viewMode === "chart" ? (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} vertical={false} />
              <XAxis
                dataKey="year"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tickFormatter={(v) => `${v > 0 ? "+" : ""}${v.toFixed(0)}%`}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
                width={52}
              />
              <Tooltip content={<TooltipContent />} />
              <Legend
                formatter={(value) => {
                  const r = results.find((r) => r.portfolioId === value);
                  return <span style={{ fontSize: 12, color: "hsl(var(--foreground))" }}>{r?.label ?? value}</span>;
                }}
              />
              <ReferenceLine y={0} stroke="hsl(var(--border))" />
              {results.map((r) => (
                <Bar
                  key={r.portfolioId}
                  dataKey={r.portfolioId}
                  fill={r.color}
                  radius={[2, 2, 0, 0]}
                  maxBarSize={40}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse" data-testid="table-annual-returns">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground w-16">연도</th>
                {results.map((r) => (
                  <th key={r.portfolioId} className="text-right py-2 px-3 text-xs font-semibold" style={{ color: r.color }}>
                    {r.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...sortedYears].reverse().map((year) => {
                const values = results.map((r) => annualByResult[r.portfolioId]?.[year]);
                const validValues = values.filter((v) => v !== undefined) as number[];
                const best = validValues.length > 1 ? Math.max(...validValues) : undefined;

                return (
                  <tr key={year} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="py-2 px-3 text-xs font-mono font-semibold text-muted-foreground">{year}</td>
                    {results.map((r, idx) => {
                      const val = values[idx];
                      if (val === undefined) {
                        return <td key={r.portfolioId} className="text-right py-2 px-3 text-xs text-muted-foreground">-</td>;
                      }
                      const isBest = best !== undefined && val === best && validValues.length > 1;
                      return (
                        <td
                          key={r.portfolioId}
                          data-testid={`cell-annual-${year}-${r.portfolioId}`}
                          className={cn(
                            "text-right py-2 px-3 font-mono text-xs font-semibold",
                            isBest
                              ? "text-green-600 dark:text-green-400"
                              : val >= 0
                              ? "text-foreground"
                              : "text-destructive"
                          )}
                        >
                          {isBest && <span className="text-green-500 text-[10px] mr-0.5">★</span>}
                          {val >= 0 ? "+" : ""}{val.toFixed(2)}%
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
