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
  { label: "30년", years: 30 },
];

const AMOUNT_PRESETS = [
  { label: "100만", value: 1_000_000 },
  { label: "500만", value: 5_000_000 },
  { label: "1천만", value: 10_000_000 },
  { label: "3천만", value: 30_000_000 },
  { label: "1억", value: 100_000_000 },
];

const DCA_PRESETS = [
  { label: "없음", value: 0 },
  { label: "10만", value: 100_000 },
  { label: "30만", value: 300_000 },
  { label: "50만", value: 500_000 },
  { label: "100만", value: 1_000_000 },
];

const REBALANCE_OPTIONS = [
  { value: "never",     label: "안함" },
  { value: "monthly",   label: "매월" },
  { value: "quarterly", label: "분기" },
  { value: "annually",  label: "매년" },
] as const;

function fmtAmount(v: number): string {
  if (v >= 100_000_000) return `${(v / 100_000_000).toFixed(v % 100_000_000 === 0 ? 0 : 1)}억`;
  if (v >= 10_000) return `${(v / 10_000).toFixed(v % 10_000 === 0 ? 0 : 1)}만`;
  return String(v);
}

export function BacktestSettings({ options, onChange }: Props) {
  const today = new Date();
  today.setDate(1);
  const maxDate = today;

  function setPresetPeriod(years: number) {
    const end = options.endDate > maxDate ? maxDate : options.endDate;
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
    <div className="flex flex-col gap-4">

      {/* ─ Period ─ */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
          <Calendar className="w-3.5 h-3.5 text-primary" />
          백테스팅 기간
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {PRESET_PERIODS.map((p) => (
            <button
              key={p.years}
              data-testid={`button-preset-${p.years}y`}
              onClick={() => setPresetPeriod(p.years)}
              className={cn(
                "px-2.5 py-1 rounded-md text-xs font-medium transition-all border",
                currentYears === p.years
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-primary"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-muted-foreground font-medium">시작일</label>
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
              className="border border-border bg-background rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary transition-all"
            />
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className="text-[10px] text-muted-foreground font-medium">종료일</label>
              <button type="button" onClick={() => onChange({ ...options, endDate: maxDate })} className="text-[10px] text-primary hover:underline">
                현재까지
              </button>
            </div>
            <input
              data-testid="input-end-date"
              type="month"
              value={toInputDate(options.endDate)}
              min={toInputDate(options.startDate)}
              max={toInputDate(maxDate)}
              onChange={(e) => {
                const [y, m] = e.target.value.split("-").map(Number);
                if (!y || !m) return;
                onChange({ ...options, endDate: new Date(y, m - 1, 1) });
              }}
              className="border border-border bg-background rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary transition-all"
            />
          </div>
        </div>
      </div>

      <div className="h-px bg-border" />

      {/* ─ Amount ─ */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
          <DollarSign className="w-3.5 h-3.5 text-primary" />
          투자 설정
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-muted-foreground font-medium">초기 투자금</label>
          <div className="flex gap-1 flex-wrap mb-1">
            {AMOUNT_PRESETS.map((p) => (
              <button
                key={p.value}
                onClick={() => onChange({ ...options, initialAmount: p.value })}
                className={cn(
                  "px-2 py-0.5 rounded text-[10px] font-medium border transition-all",
                  options.initialAmount === p.value
                    ? "bg-primary/15 text-primary border-primary/40"
                    : "bg-background text-muted-foreground border-border hover:border-primary/40 hover:text-primary"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 border border-border bg-background rounded-lg px-3 py-2 focus-within:ring-1 focus-within:ring-primary/50 focus-within:border-primary transition-all">
            <input
              data-testid="input-initial-amount"
              type="number" min={0} step={100000}
              value={options.initialAmount}
              onChange={(e) => onChange({ ...options, initialAmount: parseFloat(e.target.value) || 0 })}
              className="flex-1 bg-transparent outline-none text-sm font-mono tabular-nums"
            />
            <span className="text-[10px] text-muted-foreground shrink-0">{fmtAmount(options.initialAmount)}</span>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-muted-foreground font-medium">월 적립 투자</label>
          <div className="flex gap-1 flex-wrap mb-1">
            {DCA_PRESETS.map((p) => (
              <button
                key={p.value}
                onClick={() => onChange({ ...options, monthlyContribution: p.value })}
                className={cn(
                  "px-2 py-0.5 rounded text-[10px] font-medium border transition-all",
                  options.monthlyContribution === p.value
                    ? "bg-primary/15 text-primary border-primary/40"
                    : "bg-background text-muted-foreground border-border hover:border-primary/40 hover:text-primary"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 border border-border bg-background rounded-lg px-3 py-2 focus-within:ring-1 focus-within:ring-primary/50 focus-within:border-primary transition-all">
            <input
              data-testid="input-monthly-contribution"
              type="number" min={0} step={10000}
              value={options.monthlyContribution}
              onChange={(e) => onChange({ ...options, monthlyContribution: parseFloat(e.target.value) || 0 })}
              className="flex-1 bg-transparent outline-none text-sm font-mono tabular-nums"
            />
            <span className="text-[10px] text-muted-foreground shrink-0">
              {options.monthlyContribution > 0 ? `${fmtAmount(options.monthlyContribution)}/월` : "없음"}
            </span>
          </div>
        </div>
      </div>

      <div className="h-px bg-border" />

      {/* ─ Dividend + Rebalancing in one row ─ */}
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <TrendingUp className="w-3.5 h-3.5 text-primary" />
            배당 재투자
          </div>
          <label
            data-testid="toggle-reinvest-dividends"
            className="flex items-center justify-between cursor-pointer"
          >
            <p className="text-xs text-muted-foreground">자동 재투자</p>
            <div
              className={cn("w-9 h-5 rounded-full transition-all relative shrink-0", options.reinvestDividends ? "bg-primary" : "bg-muted")}
              onClick={() => onChange({ ...options, reinvestDividends: !options.reinvestDividends })}
            >
              <span className={cn("absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all", options.reinvestDividends ? "left-4" : "left-0.5")} />
            </div>
          </label>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <RefreshCw className="w-3.5 h-3.5 text-primary" />
            리밸런싱
          </div>
          <div className="grid grid-cols-2 gap-1">
            {REBALANCE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                data-testid={`button-rebalance-${opt.value}`}
                onClick={() => onChange({ ...options, rebalancePeriod: opt.value })}
                className={cn(
                  "py-1 rounded-md text-[10px] font-medium transition-all border text-center",
                  options.rebalancePeriod === opt.value
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-background text-muted-foreground border-border hover:border-primary/40 hover:text-primary"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
