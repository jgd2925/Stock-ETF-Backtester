import { useState } from "react";
import { Plus, Trash2, AlertCircle, Equal } from "lucide-react";
import { SymbolSearch } from "./SymbolSearch";
import type { SearchResult } from "@/lib/api";
import type { Holding } from "@/lib/backtest";
import { cn } from "@/lib/utils";

interface Portfolio {
  id: string;
  label: string;
  color: string;
  holdings: Holding[];
}

interface Props {
  portfolios: Portfolio[];
  onChange: (portfolios: Portfolio[]) => void;
}

const COLORS = [
  "#3B82F6", "#22C55E", "#F59E0B", "#EF4444", "#A855F7",
  "#06B6D4", "#F97316", "#10B981", "#8B5CF6", "#EC4899",
];

const POPULAR_US = [
  { symbol: "SPY",  name: "S&P 500" },
  { symbol: "QQQ",  name: "나스닥 100" },
  { symbol: "SCHD", name: "슈드 배당" },
  { symbol: "TQQQ", name: "나스닥 3배" },
  { symbol: "GLD",  name: "금 ETF" },
  { symbol: "TLT",  name: "장기 국채" },
];
const POPULAR_KR = [
  { symbol: "005930.KS", name: "삼성전자" },
  { symbol: "069500.KS", name: "KODEX 200" },
  { symbol: "379800.KS", name: "KODEX S&P500" },
];

export function PortfolioBuilder({ portfolios, onChange }: Props) {
  const [activeTab, setActiveTab] = useState(portfolios[0]?.id ?? "");
  const [krOpen, setKrOpen] = useState(false);

  function addPortfolio() {
    const id = `p${Date.now()}`;
    const newPortfolios = [
      ...portfolios,
      { id, label: `포트폴리오 ${portfolios.length + 1}`, color: COLORS[portfolios.length % COLORS.length], holdings: [] },
    ];
    onChange(newPortfolios);
    setActiveTab(id);
  }

  function removePortfolio(id: string) {
    const filtered = portfolios.filter((p) => p.id !== id);
    onChange(filtered);
    if (activeTab === id) setActiveTab(filtered[0]?.id ?? "");
  }

  function updateLabel(id: string, label: string) {
    onChange(portfolios.map((p) => (p.id === id ? { ...p, label } : p)));
  }

  function addHolding(portfolioId: string, result: SearchResult) {
    onChange(portfolios.map((p) => {
      if (p.id !== portfolioId) return p;
      if (p.holdings.some((h) => h.symbol === result.symbol)) return p;
      const holdings = [...p.holdings, { symbol: result.symbol, name: result.shortName || result.longName || result.symbol, weight: 0 }];
      return { ...p, holdings: autoBalance(holdings) };
    }));
  }

  function removeHolding(portfolioId: string, symbol: string) {
    onChange(portfolios.map((p) => {
      if (p.id !== portfolioId) return p;
      return { ...p, holdings: autoBalance(p.holdings.filter((h) => h.symbol !== symbol)) };
    }));
  }

  function updateWeight(portfolioId: string, symbol: string, weight: number) {
    onChange(portfolios.map((p) => {
      if (p.id !== portfolioId) return p;
      return { ...p, holdings: p.holdings.map((h) => h.symbol === symbol ? { ...h, weight } : h) };
    }));
  }

  function adjustWeight(portfolioId: string, symbol: string, delta: number) {
    const p = portfolios.find((x) => x.id === portfolioId);
    if (!p) return;
    const h = p.holdings.find((h) => h.symbol === symbol);
    if (!h) return;
    const newW = Math.max(0, Math.min(100, Math.round((h.weight + delta) * 10) / 10));
    updateWeight(portfolioId, symbol, newW);
  }

  function autoBalance(holdings: Holding[]): Holding[] {
    if (holdings.length === 0) return holdings;
    const equal = Math.floor(100 / holdings.length);
    const remainder = 100 - equal * holdings.length;
    return holdings.map((h, i) => ({ ...h, weight: i === 0 ? equal + remainder : equal }));
  }

  function equalWeightAll(portfolioId: string) {
    onChange(portfolios.map((p) => p.id === portfolioId ? { ...p, holdings: autoBalance(p.holdings) } : p));
  }

  const active = portfolios.find((p) => p.id === activeTab);
  const totalWeight = active?.holdings.reduce((s, h) => s + h.weight, 0) ?? 0;
  const weightOk = Math.abs(totalWeight - 100) <= 0.5;
  const weightError = !weightOk && (active?.holdings.length ?? 0) > 0;

  return (
    <div className="flex flex-col gap-3">
      {/* Portfolio tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
        {portfolios.map((p) => {
          const tw = p.holdings.reduce((s, h) => s + h.weight, 0);
          const ok = Math.abs(tw - 100) <= 0.5 && p.holdings.length > 0;
          return (
            <button
              key={p.id}
              data-testid={`tab-portfolio-${p.id}`}
              onClick={() => setActiveTab(p.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap shrink-0 border",
                activeTab === p.id
                  ? "text-white shadow-sm border-transparent"
                  : "text-muted-foreground hover:text-foreground bg-background border-border hover:border-primary/30",
              )}
              style={activeTab === p.id ? { backgroundColor: p.color, borderColor: p.color } : {}}
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: activeTab === p.id ? "rgba(255,255,255,0.7)" : p.color }} />
              <span className="max-w-[80px] truncate">{p.label}</span>
              {ok && <span className="text-[9px] opacity-70">✓</span>}
            </button>
          );
        })}
        {portfolios.length < 5 && (
          <button
            data-testid="button-add-portfolio"
            onClick={addPortfolio}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-primary hover:bg-primary/5 border border-dashed border-border hover:border-primary/40 transition-all whitespace-nowrap shrink-0"
          >
            <Plus className="w-3 h-3" />
            추가
          </button>
        )}
      </div>

      {active && (
        <div className="flex flex-col gap-3">
          {/* Portfolio name + delete */}
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: active.color }} />
            <input
              data-testid="input-portfolio-label"
              type="text"
              value={active.label}
              onChange={(e) => updateLabel(active.id, e.target.value)}
              className="flex-1 bg-transparent border-0 border-b border-dashed border-border text-sm font-medium outline-none focus:border-primary transition-colors py-0.5"
              placeholder="포트폴리오 이름"
            />
            {portfolios.length > 1 && (
              <button
                data-testid={`button-remove-portfolio-${active.id}`}
                onClick={() => removePortfolio(active.id)}
                className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Symbol search */}
          <SymbolSearch onSelect={(r) => addHolding(active.id, r)} placeholder="종목 검색 (예: 삼성전자, SPY, QQQ...)" />

          {/* Quick add - US */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">🇺🇸 미국 인기 ETF</p>
              <button
                onClick={() => setKrOpen((v) => !v)}
                className="text-[10px] text-primary hover:underline"
              >
                {krOpen ? "▲ 한국 숨기기" : "▼ 🇰🇷 한국 종목"}
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1">
              {POPULAR_US.map((t) => {
                const added = active.holdings.some((h) => h.symbol === t.symbol);
                return (
                  <button
                    key={t.symbol}
                    data-testid={`button-quick-add-${t.symbol}`}
                    disabled={added}
                    onClick={() => addHolding(active.id, { symbol: t.symbol, shortName: t.name, longName: t.name, exchange: "", quoteType: "ETF", market: "" })}
                    className={cn(
                      "flex flex-col items-start px-2 py-1.5 rounded-md border text-left transition-all",
                      added ? "border-border bg-muted/50 opacity-50 cursor-not-allowed" : "border-border bg-card hover:border-primary/40 hover:bg-primary/5 cursor-pointer"
                    )}
                  >
                    <span className="font-mono text-[10px] font-bold text-primary leading-tight">{t.symbol}</span>
                    <span className="text-[9px] text-muted-foreground leading-tight mt-0.5 truncate w-full">{t.name}</span>
                  </button>
                );
              })}
            </div>
            {krOpen && (
              <div className="grid grid-cols-3 gap-1">
                {POPULAR_KR.map((t) => {
                  const added = active.holdings.some((h) => h.symbol === t.symbol);
                  return (
                    <button
                      key={t.symbol}
                      data-testid={`button-quick-add-${t.symbol}`}
                      disabled={added}
                      onClick={() => addHolding(active.id, { symbol: t.symbol, shortName: t.name, longName: t.name, exchange: "KSC", quoteType: "EQUITY", market: "" })}
                      className={cn(
                        "flex flex-col items-start px-2 py-1.5 rounded-md border text-left transition-all",
                        added ? "border-border bg-muted/50 opacity-50 cursor-not-allowed" : "border-border bg-card hover:border-primary/40 hover:bg-primary/5 cursor-pointer"
                      )}
                    >
                      <span className="font-mono text-[10px] font-bold text-primary leading-tight">{t.symbol.replace(".KS", "").replace(".KQ", "")}</span>
                      <span className="text-[9px] text-muted-foreground leading-tight mt-0.5 truncate w-full">{t.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Holdings */}
          {active.holdings.length > 0 ? (
            <div className="flex flex-col gap-2">
              {/* Weight total bar */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <button
                    data-testid="button-equal-weight"
                    onClick={() => equalWeightAll(active.id)}
                    className="flex items-center gap-1 text-[11px] text-primary hover:text-primary/80 font-medium transition-colors"
                  >
                    <Equal className="w-3 h-3" />
                    균등 배분
                  </button>
                  <span className={cn("text-xs font-mono font-semibold tabular-nums", weightError ? "text-destructive" : weightOk ? "text-green-600 dark:text-green-400" : "text-muted-foreground")}>
                    {totalWeight.toFixed(1)}% / 100%
                  </span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all duration-300", totalWeight > 100 ? "bg-destructive" : weightOk ? "bg-green-500" : "bg-primary")}
                    style={{ width: `${Math.min(100, totalWeight)}%` }}
                  />
                </div>
              </div>

              {active.holdings.map((h) => (
                <div
                  key={h.symbol}
                  data-testid={`card-holding-${h.symbol}`}
                  className="flex flex-col gap-1.5 p-3 bg-background border border-border rounded-xl hover:border-primary/30 transition-all"
                >
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] font-bold text-primary">{h.symbol}</span>
                        <span className="text-[10px] text-muted-foreground truncate">{h.name}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => adjustWeight(active.id, h.symbol, -5)} className="w-6 h-6 rounded-md bg-muted hover:bg-muted-foreground/20 flex items-center justify-center text-xs font-bold transition-colors">−</button>
                      <input
                        data-testid={`input-weight-${h.symbol}`}
                        type="number"
                        min={0} max={100} step={1}
                        value={h.weight}
                        onChange={(e) => updateWeight(active.id, h.symbol, parseFloat(e.target.value) || 0)}
                        className="w-12 text-center border border-border rounded-md px-1 py-1 text-xs font-mono bg-background outline-none focus:ring-1 focus:ring-primary/50 tabular-nums"
                      />
                      <button onClick={() => adjustWeight(active.id, h.symbol, 5)} className="w-6 h-6 rounded-md bg-muted hover:bg-muted-foreground/20 flex items-center justify-center text-xs font-bold transition-colors">+</button>
                      <span className="text-xs text-muted-foreground w-4">%</span>
                      <button
                        data-testid={`button-remove-holding-${h.symbol}`}
                        onClick={() => removeHolding(active.id, h.symbol)}
                        className="w-6 h-6 text-muted-foreground hover:text-destructive transition-colors rounded-md hover:bg-destructive/10 flex items-center justify-center ml-0.5"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M18 6 6 18M6 6l12 12" /></svg>
                      </button>
                    </div>
                  </div>
                  {/* Weight bar */}
                  <div className="h-1 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, h.weight)}%`, backgroundColor: active.color, opacity: 0.8 }}
                    />
                  </div>
                </div>
              ))}

              {weightError && (
                <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/8 border border-destructive/20 px-3 py-2 rounded-lg">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  합계가 100%가 아닙니다.
                  <button onClick={() => equalWeightAll(active.id)} className="underline font-medium ml-auto shrink-0">균등 배분</button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center border-2 border-dashed border-border rounded-xl bg-muted/20">
              <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center mb-2">
                <Plus className="w-5 h-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">종목을 추가하세요</p>
              <p className="text-xs text-muted-foreground mt-1">위 검색창 또는 인기 종목 버튼 사용</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
