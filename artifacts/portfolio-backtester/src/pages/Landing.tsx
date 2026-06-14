import { useState } from "react";
import { useLocation } from "wouter";
import {
  BarChart3, TrendingUp, Bot, Sun, Moon,
  ArrowRight, ChevronRight, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

const SERVICES = [
  {
    id: "backtester",
    href: "/backtester",
    icon: BarChart3,
    color: "#3B82F6",
    bg: "bg-blue-500/10 dark:bg-blue-500/15",
    badge: null,
    title: "포트폴리오 백테스터",
    desc: "과거 데이터로 투자 전략을 검증하세요. 한국·미국 주식/ETF 비교, 적립식 투자, 배당 재투자까지.",
    features: ["한국/미국 종목 동시 지원", "복수 포트폴리오 비교", "적립식 DCA · 배당 재투자"],
    cta: "백테스팅 시작",
    available: true,
  },
  {
    id: "paper-trading",
    href: "/paper-trading",
    icon: TrendingUp,
    color: "#22C55E",
    bg: "bg-green-500/10 dark:bg-green-500/15",
    badge: null,
    title: "모의투자",
    desc: "실제 시세로 가상 투자를 경험하세요. 포트폴리오 리밸런싱까지 전략 훈련에 최적화.",
    features: ["실시간 야후 파이낸스 시세", "포트폴리오 자동 리밸런싱", "거래 내역 로컬 저장"],
    cta: "모의투자 시작",
    available: true,
  },
  {
    id: "ai-agent",
    href: "#",
    icon: Bot,
    color: "#A855F7",
    bg: "bg-purple-500/10 dark:bg-purple-500/15",
    badge: "출시 예정",
    title: "무제한 AI 에이전트",
    desc: "금융 데이터 분석, 투자 아이디어 발굴, 포트폴리오 최적화를 AI와 함께. 무제한으로.",
    features: ["GPT 기반 금융 분석", "포트폴리오 AI 추천", "실시간 시장 인사이트"],
    cta: "곧 출시",
    available: false,
  },
];

export default function Landing() {
  const [, navigate] = useLocation();
  const [isDark, setIsDark] = useState(() =>
    typeof window !== "undefined" ? document.documentElement.classList.contains("dark") : false
  );

  function toggleDark() {
    document.documentElement.classList.toggle("dark");
    setIsDark((d) => !d);
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* ── Top nav ── */}
      <header className="border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shadow-sm">
              <span className="text-primary-foreground font-black text-xs tracking-tight">JG</span>
            </div>
            <span className="font-bold text-base text-foreground tracking-tight">JGD LAB</span>
          </div>
          <button
            onClick={toggleDark}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
            aria-label="테마 전환"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        {/* Background gradient blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -left-40 w-96 h-96 bg-primary/8 rounded-full blur-3xl" />
          <div className="absolute -top-20 right-0 w-80 h-80 bg-purple-500/6 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-40 bg-green-500/5 rounded-full blur-3xl" />
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-16 pb-14 sm:pt-24 sm:pb-20 relative text-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-semibold mb-6 border border-primary/20">
            <Sparkles className="w-3.5 h-3.5" />
            JGD LAB 금융 플랫폼
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-foreground leading-tight tracking-tight mb-5">
            더 스마트한<br />
            <span className="text-primary">투자 분석</span>
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed mb-8">
            백테스팅부터 모의투자까지 — 데이터 기반으로 투자 전략을 검증하고 훈련하세요.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => navigate("/backtester")}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:opacity-90 transition-all shadow-md shadow-primary/20 active:scale-[0.98]"
            >
              <BarChart3 className="w-4 h-4" />
              백테스팅 시작
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => navigate("/paper-trading")}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-card border border-border text-foreground rounded-xl font-semibold text-sm hover:bg-muted transition-all active:scale-[0.98]"
            >
              <TrendingUp className="w-4 h-4" />
              모의투자 체험
            </button>
          </div>
        </div>
      </section>

      {/* ── Services ── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-20">
        <div className="mb-8 text-center">
          <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-2">서비스</h2>
          <p className="text-sm text-muted-foreground">원하는 서비스를 선택하세요</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
          {SERVICES.map((svc) => {
            const Icon = svc.icon;
            return (
              <div
                key={svc.id}
                onClick={() => svc.available && navigate(svc.href)}
                className={cn(
                  "group relative bg-card border border-card-border rounded-2xl p-6 flex flex-col gap-4 transition-all duration-200",
                  svc.available
                    ? "cursor-pointer hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5"
                    : "opacity-70 cursor-default"
                )}
              >
                {svc.badge && (
                  <span className="absolute top-4 right-4 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                    {svc.badge}
                  </span>
                )}

                <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center", svc.bg)}>
                  <Icon className="w-6 h-6" style={{ color: svc.color }} />
                </div>

                <div className="flex-1">
                  <h3 className="text-base font-bold text-foreground mb-1.5">{svc.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{svc.desc}</p>
                </div>

                <ul className="flex flex-col gap-1.5">
                  {svc.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="w-1 h-1 rounded-full shrink-0" style={{ backgroundColor: svc.color }} />
                      {f}
                    </li>
                  ))}
                </ul>

                <div
                  className={cn(
                    "flex items-center justify-between pt-3 border-t border-border text-xs font-semibold transition-colors",
                    svc.available
                      ? "text-primary group-hover:gap-2"
                      : "text-muted-foreground"
                  )}
                >
                  <span>{svc.cta}</span>
                  {svc.available && <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="mt-auto border-t border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">JGD LAB</span>
          <span>데이터 제공: Yahoo Finance · 과거 성과는 미래 수익을 보장하지 않습니다</span>
        </div>
      </footer>
    </div>
  );
}
