import { useState } from "react";
import { Plus, Trash2, AlertCircle } from "lucide-react";
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

const POPULAR_TICKERS = [
  { symbol: "SPY", name: "S&P 500" },
  { symbol: "QQQ", name: "나스닥 100" },
  { symbol: "VTI", name: "미국 전체주식" },
  { symbol: "IEF", name: "미국 중기채권" },
  { symbol: "GLD", name: "금 ETF" },
  { symbol: "SCHD", name: "배당주 ETF" },
  { symbol: "005930.KS", name: "삼성전자" },
  { symbol: "069500.KS", name: "KODEX 200" },
  { symbol: "360750.KS", name: "TIGER 미국S&P500" },
];

export function PortfolioBuilder({ portfolios, onChange }: Props) {
  const [activeTab, setActiveTab] = useState(portfolios[0]?.id ?? "");

  function addPortfolio() {
    const id = `p${Date.now()}`;
    const newPortfolios = [
      ...portfolios,
      {
        id,
        label: `포트폴리오 ${portfolios.length + 1}`,
        color: COLORS[portfolios.length % COLORS.length],
        holdings: [],
      },
    ];
    onChange(newPortfolios);
    setActiveTab(id);
  }

  function removePortfolio(id: string) {
    const filtered = portfolios.filter((p) => p.id !== id);
    onChange(filtered);
    if (activeTab === id) setActiveTab(filtered[0]?.id ?? "");
  }

  function updatePortfolioLabel(id: string, label: string) {
    onChange(portfolios.map((p) => (p.id === id ? { ...p, label } : p)));
  }

  function addHolding(portfolioId: string, result: SearchResult) {
    onChange(
      portfolios.map((p) => {
        if (p.id !== portfolioId) return p;
        const existing = p.holdings.find((h) => h.symbol === result.symbol);
        if (existing) return p;
        const newHolding: Holding = {
          symbol: result.symbol,
          name: result.shortName || result.longName || result.symbol,
          weight: 0,
        };
        const holdings = [...p.holdings, newHolding];
        return { ...p, holdings: autoBalance(holdings) };
      })
    );
  }

  function removeHolding(portfolioId: string, symbol: string) {
    onChange(
      portfolios.map((p) => {
        if (p.id !== portfolioId) return p;
        const holdings = p.holdings.filter((h) => h.symbol !== symbol);
        return { ...p, holdings: autoBalance(holdings) };
      })
    );
  }

  function updateWeight(portfolioId: string, symbol: string, weight: number) {
    onChange(
      portfolios.map((p) => {
        if (p.id !== portfolioId) return p;
        return {
          ...p,
          holdings: p.holdings.map((h) => (h.symbol === symbol ? { ...h, weight } : h)),
        };
      })
    );
  }

  function autoBalance(holdings: Holding[]): Holding[] {
    if (holdings.length === 0) return holdings;
    const equal = Math.floor(100 / holdings.length);
    const remainder = 100 - equal * holdings.length;
    return holdings.map((h, i) => ({
      ...h,
      weight: i === 0 ? equal + remainder : equal,
    }));
  }

  function equalWeightAll(portfolioId: string) {
    onChange(
      portfolios.map((p) => {
        if (p.id !== portfolioId) return p;
        return { ...p, holdings: autoBalance(p.holdings) };
      })
    );
  }

  const activePortfolio = portfolios.find((p) => p.id === activeTab);
  const totalWeight = activePortfolio?.holdings.reduce((s, h) => s + h.weight, 0) ?? 0;
  const weightError = Math.abs(totalWeight - 100) > 0.5 && activePortfolio && activePortfolio.holdings.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {portfolios.map((p) => (
          <button
            key={p.id}
            data-testid={`tab-portfolio-${p.id}`}
            onClick={() => setActiveTab(p.id)}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap",
              activeTab === p.id
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: p.color }}
            />
            {p.label}
          </button>
        ))}
        {portfolios.length < 5 && (
          <button
            data-testid="button-add-portfolio"
            onClick={addPortfolio}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            포트폴리오 추가
          </button>
        )}
      </div>

      {activePortfolio && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: activePortfolio.color }}
            />
            <input
              data-testid="input-portfolio-label"
              type="text"
              value={activePortfolio.label}
              onChange={(e) => updatePortfolioLabel(activePortfolio.id, e.target.value)}
              className="flex-1 bg-transparent border-0 border-b border-dashed border-border text-sm font-medium outline-none focus:border-primary transition-colors py-0.5"
              placeholder="포트폴리오 이름"
            />
            {portfolios.length > 1 && (
              <button
                data-testid={`button-remove-portfolio-${activePortfolio.id}`}
                onClick={() => removePortfolio(activePortfolio.id)}
                className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>

          <SymbolSearch
            onSelect={(r) => addHolding(activePortfolio.id, r)}
            placeholder="종목 검색하여 추가 (예: 005930.KS, SPY, QQQ...)"
          />

          <div className="flex flex-col gap-1.5">
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide px-0.5">인기 종목 빠른 추가</p>
            <div className="grid grid-cols-3 gap-1.5">
              {POPULAR_TICKERS.map((t) => {
                const alreadyAdded = activePortfolio.holdings.some((h) => h.symbol === t.symbol);
                return (
                  <button
                    key={t.symbol}
                    data-testid={`button-quick-add-${t.symbol}`}
                    disabled={alreadyAdded}
                    onClick={() =>
                      addHolding(activePortfolio.id, {
                        symbol: t.symbol,
                        shortName: t.name,
                        longName: t.name,
                        exchange: "",
                        quoteType: "ETF",
                      })
                    }
                    className={cn(
                      "flex flex-col items-start px-2 py-1.5 rounded-md border text-left transition-all",
                      alreadyAdded
                        ? "border-border bg-muted opacity-50 cursor-not-allowed"
                        : "border-border bg-card hover:border-primary/50 hover:bg-primary/5 cursor-pointer"
                    )}
                  >
                    <span className="font-mono text-[10px] font-bold text-primary leading-tight">{t.symbol}</span>
                    <span className="text-[9px] text-muted-foreground leading-tight mt-0.5 truncate w-full">{t.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {activePortfolio.holdings.length > 0 ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                <span>종목</span>
                <div className="flex items-center gap-3">
                  <button
                    data-testid="button-equal-weight"
                    onClick={() => equalWeightAll(activePortfolio.id)}
                    className="text-primary hover:underline font-medium"
                  >
                    균등 배분
                  </button>
                  <span className={cn("font-mono font-semibold", weightError ? "text-destructive" : "text-foreground")}>
                    합계: {totalWeight.toFixed(1)}%
                  </span>
                </div>
              </div>

              {activePortfolio.holdings.map((holding) => (
                <div
                  key={holding.symbol}
                  data-testid={`card-holding-${holding.symbol}`}
                  className="flex items-center gap-3 p-3 bg-card border border-card-border rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-primary">{holding.symbol}</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{holding.name}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      data-testid={`input-weight-${holding.symbol}`}
                      type="number"
                      min={0}
                      max={100}
                      step={0.1}
                      value={holding.weight}
                      onChange={(e) => updateWeight(activePortfolio.id, holding.symbol, parseFloat(e.target.value) || 0)}
                      className="w-16 text-right border border-border rounded px-2 py-1 text-sm font-mono bg-background outline-none focus:ring-1 focus:ring-primary/50"
                    />
                    <span className="text-sm text-muted-foreground w-4">%</span>
                    <button
                      data-testid={`button-remove-holding-${holding.symbol}`}
                      onClick={() => removeHolding(activePortfolio.id, holding.symbol)}
                      className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}

              {weightError && (
                <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  비중의 합이 100%가 아닙니다. 균등 배분 버튼을 누르거나 직접 조정하세요.
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center border-2 border-dashed border-border rounded-lg">
              <p className="text-sm text-muted-foreground">위에서 종목을 검색하여 추가하세요</p>
              <p className="text-xs text-muted-foreground mt-1">한국(KS, KQ)과 미국 종목 모두 지원합니다</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function X({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
