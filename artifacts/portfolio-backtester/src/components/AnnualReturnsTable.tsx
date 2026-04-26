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
  if (results.length === 0 || results.every((r) => r.series.length === 0)) return null;

  const allYears = new Set<number>();
  results.forEach((r) => {
    Object.keys(getAnnualReturns(r.series)).forEach((y) => allYears.add(parseInt(y)));
  });
  const sortedYears = [...allYears].sort((a, b) => b - a);

  const annualByResult: Record<string, Record<number, number>> = {};
  results.forEach((r) => {
    annualByResult[r.portfolioId] = getAnnualReturns(r.series);
  });

  return (
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
          {sortedYears.map((year) => {
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
  );
}
