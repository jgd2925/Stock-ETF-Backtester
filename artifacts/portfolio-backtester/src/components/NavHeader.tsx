import { useState } from "react";
import { Link, useLocation } from "wouter";
import { BarChart3, Sun, Moon, LogIn, LogOut, TrendingUp, ChevronDown } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { AuthModal } from "@/components/AuthModal";
import { cn } from "@/lib/utils";

interface Props {
  isDark: boolean;
  onToggleDark: () => void;
}

export function NavHeader({ isDark, onToggleDark }: Props) {
  const { user, signOut } = useAuth();
  const [location] = useLocation();
  const [authOpen, setAuthOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const NAV_ITEMS = [
    { href: "/", label: "백테스팅" },
    { href: "/paper-trading", label: "모의투자" },
  ];

  return (
    <>
      <header className="border-b border-border bg-card sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <BarChart3 className="w-4.5 h-4.5 text-primary-foreground" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-sm font-bold text-foreground leading-none">
                포트폴리오 백테스터
              </h1>
              <p className="text-xs text-muted-foreground">한국 · 미국 주식/ETF</p>
            </div>
          </div>

          <nav className="flex items-center gap-1 ml-2">
            {NAV_ITEMS.map((item) => (
              <Link key={item.href} href={item.href}>
                <a
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                    location === item.href
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  {item.href === "/paper-trading" && <TrendingUp className="w-3.5 h-3.5" />}
                  {item.label}
                </a>
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={onToggleDark}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {user ? (
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen((v) => !v)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-foreground hover:bg-muted transition-all border border-border"
                >
                  <span className="max-w-[120px] truncate text-xs">{user.email}</span>
                  <ChevronDown className="w-3 h-3 text-muted-foreground" />
                </button>
                {userMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} />
                    <div className="absolute right-0 mt-1 w-40 bg-popover border border-border rounded-lg shadow-lg z-20 overflow-hidden">
                      <button
                        onClick={() => { signOut(); setUserMenuOpen(false); }}
                        className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        로그아웃
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <button
                onClick={() => setAuthOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 transition-all"
              >
                <LogIn className="w-3.5 h-3.5" />
                로그인
              </button>
            )}
          </div>
        </div>
      </header>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </>
  );
}
