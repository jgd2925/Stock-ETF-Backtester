import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number, compact = false): string {
  if (compact) {
    if (Math.abs(value) >= 1_000_000_000_000) return `${(value / 1_000_000_000_000).toFixed(2)}조`;
    if (Math.abs(value) >= 100_000_000) return `${(value / 100_000_000).toFixed(2)}억`;
    if (Math.abs(value) >= 10_000) return `${(value / 10_000).toFixed(2)}만`;
  }
  return new Intl.NumberFormat("ko-KR").format(Math.round(value));
}

export function formatPercent(value: number, decimals = 2): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(decimals)}%`;
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("ko-KR", { year: "numeric", month: "short" });
}
