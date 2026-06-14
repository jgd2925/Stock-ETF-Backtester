import { useState } from "react";
import {
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import type { BacktestResult } from "@/lib/backtest";
import { formatCurrency, formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface Props {
  results: BacktestResult[];
}

type ChartMode = "value" | "return" | "drawdown";

const MODE_OPTIONS: { value: ChartMode; label: string; desc: string }[] = [
  { value: "value",    label: "포트폴리오 가치", desc: "총 자산 추이" },
  { value: "return",   label: "수익률",          desc: "투자 대비 %" },
  { value: "drawdown", label: "낙폭",            desc: "고점 대비 하락" },
];

export function ResultsChart({ results }: Props) {
  const [mode, setMode] = useState<ChartMode>("value");

  if (results.length === 0 || results.every((r) => r.series.length === 0)) return null;

  const allDates = new Set<number>();
  results.forEach((r) => r.series.forEach((p) => allDates.add(p.date)));
  const sortedDates = [...allDates].sort((a, b) => a - b);

  const peakValues: Record<string, number> = {};
  results.forEach((r) => { peakValues[r.portfolioId] = 0; });

  const chartData = sortedDates.map((date) => {
    const point: Record<string, string | number> = { date: formatDate(date) };
    results.forEach((r) => {
      const match = r.series.find((p) => p.date === date);
      if (match) {
        if (mode === "value") {
          point[r.portfolioId] = Math.round(match.value);
        } else if (mode === "return") {
          const invested = match.invested;
          point[r.portfolioId] = invested > 0 ? parseFloat(((match.value - invested) / invested * 100).toFixed(2)) : 0;
        } else {
          if (match.value > (peakValues[r.portfolioId] ?? 0)) peakValues[r.portfolioId] = match.value;
          const peak = peakValues[r.portfolioId] ?? 0;
          point[r.portfolioId] = peak > 0 ? parseFloat((-((peak - match.value) / peak) * 100).toFixed(2)) : 0;
        }
      }
    });
    return point;
  });

  function formatYAxis(value: number): string {
    if (mode === "value") {
      if (Math.abs(value) >= 1_000_000_000_000) return `${(value / 1_000_000_000_000).toFixed(0)}조`;
      if (Math.abs(value) >= 100_000_000) return `${(value / 100_000_000).toFixed(0)}억`;
      if (Math.abs(value) >= 10_000) return `${(value / 10_000).toFixed(0)}만`;
      return `${Math.round(value)}`;
    }
    return `${value > 0 ? "+" : ""}${value.toFixed(0)}%`;
  }

  function TooltipContent({
    active, payload, label,
  }: {
    active?: boolean;
    payload?: Array<{ color: string; name: string; value: number }>;
    label?: string;
  }) {
    if (!active || !payload || payload.length === 0) return null;
    const sorted = [...payload].sort((a, b) => b.value - a.value);
    return (
      <div className="bg-popover border border-popover-border rounded-xl shadow-xl p-3 text-sm min-w-52">
        <p className="text-muted-foreground text-[10px] mb-2 font-medium">{label}</p>
        {sorted.map((entry) => {
          const label2 = results.find((r) => r.portfolioId === entry.name)?.label ?? entry.name;
          const isPos = entry.value >= 0;
          return (
            <div key={entry.name} className="flex items-center justify-between gap-3 py-0.5">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                <span className="text-foreground text-xs">{label2}</span>
              </div>
              <span className={cn("font-mono font-semibold text-xs tabular-nums", mode !== "value" ? (isPos ? "text-green-600 dark:text-green-400" : "text-red-500") : "text-foreground")}>
                {mode === "value"
                  ? formatCurrency(entry.value, true)
                  : `${isPos ? "+" : ""}${entry.value.toFixed(2)}%`}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  const isDrawdown = mode === "drawdown";

  return (
    <div className="flex flex-col gap-3">
      {/* Mode selector */}
      <div className="flex items-center gap-1 bg-muted rounded-lg p-1 w-fit">
        {MODE_OPTIONS.map((m) => (
          <button
            key={m.value}
            data-testid={`button-chart-mode-${m.value}`}
            onClick={() => setMode(m.value)}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-medium transition-all",
              mode === m.value
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Gradient defs + chart */}
      <div data-testid="chart-results" className="h-96 sm:h-[420px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 4, bottom: 4 }}>
            <defs>
              {results.map((r) => (
                <linearGradient key={r.portfolioId} id={`grad-${r.portfolioId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={r.color} stopOpacity={isDrawdown ? 0.25 : 0.18} />
                  <stop offset="85%" stopColor={r.color} stopOpacity={0.02} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              minTickGap={60}
            />
            <YAxis
              tickFormatter={formatYAxis}
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={false}
              width={54}
            />
            <Tooltip content={<TooltipContent />} />
            <Legend
              formatter={(value) => {
                const r = results.find((r) => r.portfolioId === value);
                return <span style={{ fontSize: 11, color: "hsl(var(--foreground))" }}>{r?.label ?? value}</span>;
              }}
              wrapperStyle={{ paddingTop: 8 }}
            />
            {isDrawdown && <ReferenceLine y={0} stroke="hsl(var(--border))" strokeDasharray="4 2" />}
            {results.map((r) => (
              <Area
                key={r.portfolioId}
                type="monotone"
                dataKey={r.portfolioId}
                stroke={r.color}
                strokeWidth={2}
                fill={`url(#grad-${r.portfolioId})`}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
