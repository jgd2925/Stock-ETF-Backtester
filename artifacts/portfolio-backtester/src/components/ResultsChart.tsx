import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { BacktestResult } from "@/lib/backtest";
import { formatCurrency, formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface Props {
  results: BacktestResult[];
}

type ChartMode = "value" | "return" | "drawdown";

const MODE_OPTIONS: { value: ChartMode; label: string }[] = [
  { value: "value", label: "포트폴리오 가치" },
  { value: "return", label: "수익률 (%)" },
  { value: "drawdown", label: "최대 낙폭" },
];

export function ResultsChart({ results }: Props) {
  const [mode, setMode] = useState<ChartMode>("value");

  if (results.length === 0 || results.every((r) => r.series.length === 0)) {
    return null;
  }

  const allDates = new Set<number>();
  results.forEach((r) => r.series.forEach((p) => allDates.add(p.date)));
  const sortedDates = [...allDates].sort((a, b) => a - b);

  const peakValues: Record<string, number> = {};
  results.forEach((r) => {
    peakValues[r.portfolioId] = 0;
  });

  const chartData = sortedDates.map((date) => {
    const point: Record<string, string | number> = { date: formatDate(date) };
    results.forEach((r) => {
      const match = r.series.find((p) => p.date === date);
      if (match) {
        if (mode === "value") {
          point[r.portfolioId] = Math.round(match.value);
          point[`${r.portfolioId}_invested`] = Math.round(match.invested);
        } else if (mode === "return") {
          // 총 투자금 대비 수익률: 초기금 0원 적립식도 올바르게 처리
          const invested = match.invested;
          point[r.portfolioId] = invested > 0 ? ((match.value - invested) / invested) * 100 : 0;
        } else if (mode === "drawdown") {
          if (match.value > (peakValues[r.portfolioId] ?? 0)) {
            peakValues[r.portfolioId] = match.value;
          }
          const peak = peakValues[r.portfolioId] ?? 0;
          point[r.portfolioId] = peak > 0 ? -((peak - match.value) / peak) * 100 : 0;
        }
      }
    });
    return point;
  });

  function formatYAxis(value: number): string {
    if (mode === "value") {
      if (Math.abs(value) >= 1_000_000_000_000) return `${(value / 1_000_000_000_000).toFixed(1)}조`;
      if (Math.abs(value) >= 100_000_000) return `${(value / 100_000_000).toFixed(0)}억`;
      if (Math.abs(value) >= 10_000) return `${(value / 10_000).toFixed(0)}만`;
      return `${Math.round(value)}`;
    }
    return `${value.toFixed(1)}%`;
  }

  function TooltipContent({ active, payload, label }: { active?: boolean; payload?: Array<{ color: string; name: string; value: number }>; label?: string }) {
    if (!active || !payload || payload.length === 0) return null;
    return (
      <div className="bg-popover border border-popover-border rounded-lg shadow-lg p-3 text-sm min-w-48">
        <p className="text-muted-foreground text-xs mb-2">{label}</p>
        {payload.map((entry) => (
          <div key={entry.name} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-foreground text-xs">
                {results.find((r) => r.portfolioId === entry.name)?.label ?? entry.name}
              </span>
            </div>
            <span className="font-mono font-semibold text-foreground text-xs">
              {mode === "value"
                ? formatCurrency(entry.value, true)
                : `${entry.value >= 0 ? "+" : ""}${entry.value.toFixed(2)}%`}
            </span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        {MODE_OPTIONS.map((m) => (
          <button
            key={m.value}
            data-testid={`button-chart-mode-${m.value}`}
            onClick={() => setMode(m.value)}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-medium transition-all",
              mode === m.value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div data-testid="chart-results" className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tickFormatter={formatYAxis}
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={false}
              width={60}
            />
            <Tooltip content={<TooltipContent />} />
            <Legend
              formatter={(value) => {
                const r = results.find((r) => r.portfolioId === value);
                return <span style={{ fontSize: 12, color: "hsl(var(--foreground))" }}>{r?.label ?? value}</span>;
              }}
            />
            {mode === "drawdown" && <ReferenceLine y={0} stroke="hsl(var(--border))" strokeDasharray="4 2" />}
            {results.map((r) => (
              <Line
                key={r.portfolioId}
                type="monotone"
                dataKey={r.portfolioId}
                stroke={r.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
