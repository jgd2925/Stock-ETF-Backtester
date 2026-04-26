import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
      <h1 className="text-4xl font-bold text-foreground">404</h1>
      <p className="text-muted-foreground">페이지를 찾을 수 없습니다</p>
      <Link href="/" className="text-primary hover:underline text-sm">홈으로 돌아가기</Link>
    </div>
  );
}
