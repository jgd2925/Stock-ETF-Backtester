import { useState, useEffect, useRef, useCallback } from "react";
import { Search, X, Loader2 } from "lucide-react";
import { searchSymbol, type SearchResult } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Props {
  onSelect: (result: SearchResult) => void;
  placeholder?: string;
  className?: string;
}

const EXCHANGE_LABELS: Record<string, string> = {
  KSC: "KOSPI",
  KOE: "KOSDAQ",
  NYQ: "NYSE",
  NMS: "NASDAQ",
  PCX: "NYSE Arca",
  ASE: "AMEX",
  TOR: "TSX",
};

const QUOTE_TYPE_LABELS: Record<string, string> = {
  EQUITY: "주식",
  ETF: "ETF",
  MUTUALFUND: "펀드",
  INDEX: "지수",
  CRYPTOCURRENCY: "암호화폐",
};

export function SymbolSearch({ onSelect, placeholder = "종목 검색 (예: 삼성전자, SPY, QQQ...)", className }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 1) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    const res = await searchSymbol(q);
    setResults(res);
    setOpen(true);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => doSearch(query), 350);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query, doSearch]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSelect(result: SearchResult) {
    onSelect(result);
    setQuery("");
    setResults([]);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="flex items-center gap-2 border border-border bg-background rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary transition-all">
        {loading ? (
          <Loader2 className="w-4 h-4 text-muted-foreground animate-spin shrink-0" />
        ) : (
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
        )}
        <input
          data-testid="input-symbol-search"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
          onFocus={() => results.length > 0 && setOpen(true)}
        />
        {query && (
          <button onClick={() => { setQuery(""); setResults([]); setOpen(false); }}>
            <X className="w-4 h-4 text-muted-foreground hover:text-foreground transition-colors" />
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-50 top-full mt-1 w-full bg-popover border border-popover-border rounded-lg shadow-lg overflow-hidden max-h-80 overflow-y-auto">
          {results.map((r) => (
            <button
              key={r.symbol}
              data-testid={`option-symbol-${r.symbol}`}
              className="w-full text-left px-4 py-2.5 hover:bg-accent transition-colors flex items-center justify-between gap-3"
              onClick={() => handleSelect(r)}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-mono text-sm font-semibold text-primary shrink-0">{r.symbol}</span>
                <span className="text-sm text-foreground truncate">{r.shortName || r.longName}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {r.quoteType && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-accent text-accent-foreground font-medium">
                    {QUOTE_TYPE_LABELS[r.quoteType] ?? r.quoteType}
                  </span>
                )}
                {r.exchange && (
                  <span className="text-xs text-muted-foreground">
                    {EXCHANGE_LABELS[r.exchange] ?? r.exchange}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {open && !loading && results.length === 0 && query.length >= 1 && (
        <div className="absolute z-50 top-full mt-1 w-full bg-popover border border-popover-border rounded-lg shadow-lg px-4 py-3 text-sm text-muted-foreground">
          "{query}"에 대한 검색 결과가 없습니다
        </div>
      )}
    </div>
  );
}
