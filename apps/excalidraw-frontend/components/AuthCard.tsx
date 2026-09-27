import Link from "next/link";
import ThemeToggle from "./ThemeToggle";

const LogoIcon = () => (
  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
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
        <div className="absolute left-1/2 top-[-10%] h-[420px] w-[620px] -translate-x-1/2 rounded-full bg-primary/12 blur-[100px]" />
        <div className="absolute bottom-[-15%] right-[-5%] h-[360px] w-[420px] rounded-full bg-primary/[0.07] blur-[100px]" />
      </div>

      {/* Header */}
      <header className="relative flex items-center justify-between p-6">
        <Link href="/" className="inline-flex items-center gap-2.5 text-[15px] font-semibold tracking-tight transition-opacity hover:opacity-80">
          <LogoIcon />
          <span>SketchBlade</span>
        </Link>
        <ThemeToggle />
      </header>

      {/* Centered form */}
      <main id="main" className="relative flex min-h-[calc(100vh-88px)] items-center justify-center px-4 pb-16">
        <div className="w-full max-w-sm">
          <div className="mb-7 text-center">
            <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.02em]">{title}</h1>
            <p className="mx-auto mt-2 max-w-[34ch] text-[13px] leading-relaxed text-muted-foreground">{subtitle}</p>
          </div>

          {/* Tinted shadow rather than black, so it sits in the palette */}
          <div className="rounded-2xl border border-border/70 bg-card/80 p-8 shadow-[0_1px_0_0_oklch(1_0_0/0.04)_inset,0_16px_40px_-20px_oklch(0.15_0.04_293/0.5)] backdrop-blur-sm">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
