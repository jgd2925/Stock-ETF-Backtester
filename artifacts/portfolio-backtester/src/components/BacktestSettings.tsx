import { Calendar, DollarSign, TrendingUp, RefreshCw } from "lucide-react";
import type { BacktestOptions } from "@/lib/backtest";
import { cn } from "@/lib/utils";

interface Props {
  options: BacktestOptions;
  onChange: (opts: BacktestOptions) => void;
}

const PRESET_PERIODS = [
  { label: "1년", years: 1 },
  { label: "3년", years: 3 },
  { label: "5년", years: 5 },
  { label: "10년", years: 10 },
  { label: "20년", years: 20 },
];

const REBALANCE_OPTIONS = [
  { value: "monthly", label: "매월" },
  { value: "quarterly", label: "분기별" },
  { value: "annually", label: "매년" },
  { value: "never", label: "리밸런싱 없음" },
] as const;

export function BacktestSettings({ options, onChange }: Props) {
  function setPresetPeriod(years: number) {
    const end = new Date();
    end.setDate(1);
    const start = new Date(end);
    start.setFullYear(start.getFullYear() - years);
    onChange({ ...options, startDate: start, endDate: end });
  }

  const currentYears = Math.round(
    (options.endDate.getTime() - options.startDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25)
  );

  function toInputDate(d: Date): string {
    return d.toISOString().slice(0, 7);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Calendar className="w-4 h-4 text-primary" />
          <span>백테스팅 기간</span>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {PRESET_PERIODS.map((p) => (
            <button
              key={p.years}
              data-testid={`button-preset-${p.years}y`}
              onClick={() => setPresetPeriod(p.years)}
              className={cn(
                "px-3 py-1 rounded-md text-xs font-medium transition-all border",
                currentYears === p.years
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:border-primary hover:text-primary"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">시작일</label>
            <input
              data-testid="input-start-date"
              type="month"
              value={toInputDate(options.startDate)}
              max={toInputDate(options.endDate)}
              onChange={(e) => {
                const [y, m] = e.target.value.split("-").map(Number);
                if (!y || !m) return;
                onChange({ ...options, startDate: new Date(y, m - 1, 1) });
              }}
              className="border border-border bg-background rounded-md px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary transition-all"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">종료일</label>
            <input
              data-testid="input-end-date"
              type="month"
              value={toInputDate(options.endDate)}
              min={toInputDate(options.startDate)}
              onChange={(e) => {
                const [y, m] = e.target.value.split("-").map(Number);
                if (!y || !m) return;
                onChange({ ...options, endDate: new Date(y, m - 1, 1) });
              }}
              className="border border-border bg-background rounded-md px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary transition-all"
            />
          </div>
        </div>
      </div>

      <div className="h-px bg-border" />

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <DollarSign className="w-4 h-4 text-primary" />
          <span>투자 설정</span>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">초기 투자금</label>
          <div className="flex items-center gap-2 border border-border bg-background rounded-md px-3 py-1.5 focus-within:ring-1 focus-within:ring-primary/50 focus-within:border-primary transition-all">
            <input
              data-testid="input-initial-amount"
              type="number"
              min={0}
              step={100000}
              value={options.initialAmount}
              onChange={(e) => onChange({ ...options, initialAmount: parseFloat(e.target.value) || 0 })}
              className="flex-1 bg-transparent outline-none text-sm font-mono"
            />
            <span className="text-xs text-muted-foreground shrink-0">원/USD</span>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">월 적립식 추가 투자 (0 = 없음)</label>
          <div className="flex items-center gap-2 border border-border bg-background rounded-md px-3 py-1.5 focus-within:ring-1 focus-within:ring-primary/50 focus-within:border-primary transition-all">
            <input
              data-testid="input-monthly-contribution"
              type="number"
              min={0}
              step={10000}
              value={options.monthlyContribution}
              onChange={(e) => onChange({ ...options, monthlyContribution: parseFloat(e.target.value) || 0 })}
              className="flex-1 bg-transparent outline-none text-sm font-mono"
            />
            <span className="text-xs text-muted-foreground shrink-0">원/USD / 월</span>
          </div>
        </div>
      </div>

      <div className="h-px bg-border" />

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <TrendingUp className="w-4 h-4 text-primary" />
          <span>배당 설정</span>
        </div>
        <label
          data-testid="toggle-reinvest-dividends"
          className="flex items-center justify-between cursor-pointer"
        >
          <div>
            <p className="text-sm font-medium">배당 재투자</p>
            <p className="text-xs text-muted-foreground">수령한 배당금을 같은 종목에 자동 재투자</p>
          </div>
          <div
            className={cn(
              "w-10 h-6 rounded-full transition-all relative",
              options.reinvestDividends ? "bg-primary" : "bg-muted"
            )}
            onClick={() => onChange({ ...options, reinvestDividends: !options.reinvestDividends })}
          >
            <span
              className={cn(
                "absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all",
                options.reinvestDividends ? "left-5" : "left-1"
              )}
            />
          </div>
        </label>
      </div>

      <div className="h-px bg-border" />

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <RefreshCw className="w-4 h-4 text-primary" />
          <span>리밸런싱</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {REBALANCE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              data-testid={`button-rebalance-${opt.value}`}
              onClick={() => onChange({ ...options, rebalancePeriod: opt.value })}
              className={cn(
                "px-3 py-2 rounded-lg text-xs font-medium transition-all border text-center",
                options.rebalancePeriod === opt.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:border-primary hover:text-primary"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
