import { useLocation } from "wouter";
import { BarChart3, Sun, Moon, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  isDark: boolean;
  onToggleDark: () => void;
}

export function NavHeader({ isDark, onToggleDark }: Props) {
  const [location, navigate] = useLocation();

  const NAV_ITEMS = [
    { href: "/", label: "백테스팅", icon: null },
    { href: "/paper-trading", label: "모의투자", icon: TrendingUp },
  ];

  return (
    <header className="border-b border-border bg-card sticky top-0 z-40 shadow-sm">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-13 sm:h-14 flex items-center gap-2 sm:gap-4">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 sm:gap-3 shrink-0 hover:opacity-80 transition-opacity"
        >
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-primary flex items-center justify-center">
            <BarChart3 className="w-4 h-4 text-primary-foreground" />
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-bold text-foreground leading-none">포트폴리오 백테스터</p>
            <p className="text-xs text-muted-foreground">한국 · 미국 주식/ETF</p>
          </div>
          <p className="sm:hidden text-sm font-bold text-foreground">백테스터</p>
        </button>

        <nav className="flex items-center gap-0.5 sm:gap-1 ml-1 sm:ml-2">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.href}
                onClick={() => navigate(item.href)}
                className={cn(
                  "flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all",
                  location === item.href
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                {Icon && <Icon className="w-3.5 h-3.5" />}
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="ml-auto">
          <button
            onClick={onToggleDark}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
            aria-label="테마 전환"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </header>
  );
}
