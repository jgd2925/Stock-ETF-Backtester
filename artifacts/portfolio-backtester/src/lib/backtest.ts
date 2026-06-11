import type { HistoricalData, DividendData } from "./api";

export interface Holding {
  symbol: string;
  name: string;
  weight: number;
}

export interface BacktestOptions {
  startDate: Date;
  endDate: Date;
  initialAmount: number;
  monthlyContribution: number;
  reinvestDividends: boolean;
  rebalancePeriod: "monthly" | "quarterly" | "annually" | "never";
  contributionDay: number;
}

export interface MonthlyPoint {
  date: number;
  value: number;
  invested: number;
  dividendsReceived: number;
  contributions: number;
}

export interface SymbolSeriesPoint {
  date: number;
  value: number;
}

export interface SymbolResult {
  symbol: string;
  name: string;
  weight: number;
  investedAmount: number;
  finalValue: number;
  gainLoss: number;
  totalReturn: number;
  cagr: number;
  maxDrawdown: number;
  volatility: number;
  totalDividends: number;
  annualReturns: Record<number, number>;
  series: SymbolSeriesPoint[];
}

export interface BacktestResult {
  portfolioId: string;
  label: string;
  color: string;
  series: MonthlyPoint[];
  totalReturn: number;
  cagr: number;
  maxDrawdown: number;
  sharpeRatio: number;
  volatility: number;
  winRate: number;
  totalDividends: number;
  totalContributions: number;
  finalValue: number;
  symbolResults: SymbolResult[];
}

interface AssetData {
  symbol: string;
  prices: HistoricalData[];
  dividends: DividendData[];
}

function alignDates(assetsData: AssetData[]): number[] {
  if (assetsData.length === 0) return [];
  const sets = assetsData.map((a) => new Set(a.prices.map((p) => p.date)));
  let common = [...sets[0]];
  for (let i = 1; i < sets.length; i++) {
    common = common.filter((d) => sets[i].has(d));
  }
  return common.sort((a, b) => a - b);
}

function findClosestPrice(prices: HistoricalData[], date: number): number {
  if (prices.length === 0) return 0;
  let closest = prices[0];
  for (const p of prices) {
    if (Math.abs(p.date - date) < Math.abs(closest.date - date)) closest = p;
  }
  return closest.adjClose;
}

function getDividendsInPeriod(dividends: DividendData[], from: number, to: number): number {
  return dividends.filter((d) => d.date > from && d.date <= to).reduce((sum, d) => sum + d.amount, 0);
}

function getMonthKey(date: number): string {
  const d = new Date(date);
  return `${d.getFullYear()}-${d.getMonth()}`;
}

function getQuarterKey(date: number): string {
  const d = new Date(date);
  const q = Math.floor(d.getMonth() / 3);
  return `${d.getFullYear()}-Q${q}`;
}

function getYearKey(date: number): string {
  return `${new Date(date).getFullYear()}`;
}

function computeSymbolMetrics(
  h: Holding,
  series: SymbolSeriesPoint[],
  investedAmount: number,
  totalDividends: number,
  dates: number[]
): SymbolResult {
  const finalVal = series[series.length - 1]?.value ?? 0;
  const gainLoss = finalVal - investedAmount;
  const totalReturn = investedAmount > 0 ? (gainLoss / investedAmount) * 100 : 0;

  const years = dates.length > 1
    ? (dates[dates.length - 1] - dates[0]) / (1000 * 60 * 60 * 24 * 365.25)
    : 0;
  const cagr =
    years > 0 && investedAmount > 0 && finalVal > 0
      ? (Math.pow(finalVal / investedAmount, 1 / years) - 1) * 100
      : 0;

  let maxDrawdown = 0;
  let peak = series[0]?.value ?? 0;
  for (const p of series) {
    if (p.value > peak) peak = p.value;
    const dd = peak > 0 ? ((peak - p.value) / peak) * 100 : 0;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  // Monthly returns → volatility
  const monthlyReturns: number[] = [];
  for (let i = 1; i < series.length; i++) {
    const prev = series[i - 1].value;
    const curr = series[i].value;
    if (prev > 0) monthlyReturns.push((curr - prev) / prev);
  }
  const avgR = monthlyReturns.reduce((a, b) => a + b, 0) / (monthlyReturns.length || 1);
  const variance = monthlyReturns.reduce((s, r) => s + Math.pow(r - avgR, 2), 0) / (monthlyReturns.length || 1);
  const volatility = Math.sqrt(variance) * Math.sqrt(12) * 100;

  // Annual returns per symbol
  const byYear: Record<number, SymbolSeriesPoint[]> = {};
  series.forEach((p) => {
    const y = new Date(p.date).getFullYear();
    if (!byYear[y]) byYear[y] = [];
    byYear[y].push(p);
  });
  const annualReturns: Record<number, number> = {};
  Object.entries(byYear).forEach(([yearStr, pts]) => {
    const first = pts[0].value;
    const last = pts[pts.length - 1].value;
    annualReturns[parseInt(yearStr)] = first > 0 ? ((last - first) / first) * 100 : 0;
  });

  return {
    symbol: h.symbol,
    name: h.name,
    weight: h.weight,
    investedAmount,
    finalValue: finalVal,
    gainLoss,
    totalReturn,
    cagr,
    maxDrawdown,
    volatility,
    totalDividends,
    annualReturns,
    series,
  };
}

export function runBacktest(
  holdings: Holding[],
  assetsData: AssetData[],
  options: BacktestOptions,
  portfolioId: string,
  label: string,
  color: string
): BacktestResult {
  const dates = alignDates(assetsData);
  if (dates.length < 2) return emptyResult(portfolioId, label, color);

  const weightMap: Record<string, number> = {};
  holdings.forEach((h) => (weightMap[h.symbol] = h.weight / 100));

  const priceMap: Record<string, HistoricalData[]> = {};
  const divMap: Record<string, DividendData[]> = {};
  assetsData.forEach((a) => {
    priceMap[a.symbol] = a.prices;
    divMap[a.symbol] = a.dividends;
  });

  const initialPrices: Record<string, number> = {};
  holdings.forEach((h) => {
    initialPrices[h.symbol] = findClosestPrice(priceMap[h.symbol] ?? [], dates[0]);
  });

  let shares: Record<string, number> = {};
  let totalInvested = options.initialAmount;
  let totalDividends = 0;
  let totalContributions = options.initialAmount;

  // Per-symbol tracking
  const symbolInvested: Record<string, number> = {};
  const symbolDividends: Record<string, number> = {};
  const symbolValueSeries: Record<string, SymbolSeriesPoint[]> = {};

  holdings.forEach((h) => {
    const alloc = options.initialAmount * weightMap[h.symbol];
    const price = initialPrices[h.symbol];
    shares[h.symbol] = price > 0 ? alloc / price : 0;
    symbolInvested[h.symbol] = alloc;
    symbolDividends[h.symbol] = 0;
    symbolValueSeries[h.symbol] = [];
  });

  const series: MonthlyPoint[] = [];
  let prevDate = dates[0];
  let prevRebalanceKey = "";

  function portfolioValue(date: number): number {
    return holdings.reduce((sum, h) => {
      const price = findClosestPrice(priceMap[h.symbol] ?? [], date);
      return sum + (shares[h.symbol] ?? 0) * price;
    }, 0);
  }

  function recordSymbolValues(date: number) {
    holdings.forEach((h) => {
      const price = findClosestPrice(priceMap[h.symbol] ?? [], date);
      symbolValueSeries[h.symbol].push({ date, value: (shares[h.symbol] ?? 0) * price });
    });
  }

  recordSymbolValues(dates[0]);
  series.push({
    date: dates[0],
    value: portfolioValue(dates[0]),
    invested: totalInvested,
    dividendsReceived: 0,
    contributions: options.initialAmount,
  });

  for (let i = 1; i < dates.length; i++) {
    const date = dates[i];
    let dividendsThisPeriod = 0;

    holdings.forEach((h) => {
      const divs = getDividendsInPeriod(divMap[h.symbol] ?? [], prevDate, date);
      if (divs > 0) {
        const divAmount = divs * (shares[h.symbol] ?? 0);
        dividendsThisPeriod += divAmount;
        totalDividends += divAmount;
        symbolDividends[h.symbol] = (symbolDividends[h.symbol] ?? 0) + divAmount;

        if (options.reinvestDividends) {
          const price = findClosestPrice(priceMap[h.symbol] ?? [], date);
          if (price > 0) {
            shares[h.symbol] = (shares[h.symbol] ?? 0) + divAmount / price;
          }
        }
      }
    });

    let contributionThisPeriod = 0;
    if (options.monthlyContribution > 0) {
      contributionThisPeriod = options.monthlyContribution;
      totalContributions += contributionThisPeriod;
      totalInvested += contributionThisPeriod;

      holdings.forEach((h) => {
        const alloc = contributionThisPeriod * weightMap[h.symbol];
        symbolInvested[h.symbol] = (symbolInvested[h.symbol] ?? 0) + alloc;
        const price = findClosestPrice(priceMap[h.symbol] ?? [], date);
        if (price > 0) shares[h.symbol] = (shares[h.symbol] ?? 0) + alloc / price;
      });
    }

    if (options.rebalancePeriod !== "never") {
      let rebalKey = "";
      if (options.rebalancePeriod === "monthly") rebalKey = getMonthKey(date);
      else if (options.rebalancePeriod === "quarterly") rebalKey = getQuarterKey(date);
      else if (options.rebalancePeriod === "annually") rebalKey = getYearKey(date);

      if (rebalKey !== prevRebalanceKey && prevRebalanceKey !== "") {
        const totalVal = portfolioValue(date);
        if (totalVal > 0) {
          holdings.forEach((h) => {
            const targetVal = totalVal * weightMap[h.symbol];
            const price = findClosestPrice(priceMap[h.symbol] ?? [], date);
            if (price > 0) shares[h.symbol] = targetVal / price;
          });
        }
      }
      prevRebalanceKey = rebalKey;
    }

    recordSymbolValues(date);
    series.push({
      date,
      value: portfolioValue(date),
      invested: totalInvested,
      dividendsReceived: dividendsThisPeriod,
      contributions: contributionThisPeriod,
    });

    prevDate = date;
  }

  const finalValue = series[series.length - 1]?.value ?? 0;
  const totalReturn = totalContributions > 0 ? ((finalValue - totalContributions) / totalContributions) * 100 : 0;

  const years = (dates[dates.length - 1] - dates[0]) / (1000 * 60 * 60 * 24 * 365.25);
  const cagr = years > 0 ? (Math.pow(finalValue / totalContributions, 1 / years) - 1) * 100 : 0;

  let maxDrawdown = 0;
  let peak = series[0]?.value ?? 0;
  for (const point of series) {
    if (point.value > peak) peak = point.value;
    const drawdown = peak > 0 ? ((peak - point.value) / peak) * 100 : 0;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }

  const returns: number[] = [];
  for (let i = 1; i < series.length; i++) {
    const prev = series[i - 1].value;
    const curr = series[i].value;
    if (prev > 0) returns.push((curr - prev) / prev);
  }

  const avgReturn = returns.reduce((a, b) => a + b, 0) / (returns.length || 1);
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / (returns.length || 1);
  const stdDev = Math.sqrt(variance);
  const riskFreeMonthly = 0.04 / 12;
  const sharpeRatio = stdDev > 0 ? ((avgReturn - riskFreeMonthly) / stdDev) * Math.sqrt(12) : 0;
  const volatility = stdDev * Math.sqrt(12) * 100;
  const positiveMonths = returns.filter((r) => r > 0).length;
  const winRate = returns.length > 0 ? (positiveMonths / returns.length) * 100 : 0;

  const symbolResults: SymbolResult[] = holdings.map((h) =>
    computeSymbolMetrics(
      h,
      symbolValueSeries[h.symbol] ?? [],
      symbolInvested[h.symbol] ?? 0,
      symbolDividends[h.symbol] ?? 0,
      dates
    )
  );

  return {
    portfolioId,
    label,
    color,
    series,
    totalReturn,
    cagr,
    maxDrawdown,
    sharpeRatio,
    volatility,
    winRate,
    totalDividends,
    totalContributions,
    finalValue,
    symbolResults,
  };
}

function emptyResult(portfolioId: string, label: string, color: string): BacktestResult {
  return {
    portfolioId,
    label,
    color,
    series: [],
    totalReturn: 0,
    cagr: 0,
    maxDrawdown: 0,
    sharpeRatio: 0,
    volatility: 0,
    winRate: 0,
    totalDividends: 0,
    totalContributions: 0,
    finalValue: 0,
    symbolResults: [],
  };
}
