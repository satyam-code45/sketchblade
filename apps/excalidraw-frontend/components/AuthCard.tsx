import Link from "next/link";
import ThemeToggle from "./ThemeToggle";

const LogoIcon = () => (
  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600 text-white">
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M2 14L5.5 10.5L10.5 5.5L12.5 7.5L7.5 12.5L2 14Z"
        stroke="white"
        strokeWidth="1.5"
        strokeLinejoin="round"
        fill="rgba(255,255,255,0.2)"
      />
      <path
        d="M10.5 5.5L12.5 3.5L14.5 5.5L12.5 7.5L10.5 5.5Z"
        stroke="white"
        strokeWidth="1.5"
        strokeLinejoin="round"
        fill="rgba(255,255,255,0.2)"
      />
    </svg>
  </div>
);

export default function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen bg-background">
      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-0 h-[300px] w-[500px] -translate-x-1/2 rounded-full bg-violet-500/10 blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative flex items-center justify-between p-6">
        <Link href="/" className="inline-flex items-center gap-2.5 font-semibold text-base">
          <LogoIcon />
          <span>SketchBlade</span>
        </Link>
        <ThemeToggle />
      </header>

      {/* Centered form */}
      <main className="relative flex min-h-[calc(100vh-88px)] items-center justify-center px-4 pb-16">
        <div className="w-full max-w-sm">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold">{title}</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
