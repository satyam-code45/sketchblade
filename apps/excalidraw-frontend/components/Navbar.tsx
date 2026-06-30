import Link from "next/link";
import ThemeToggle from "./ThemeToggle";
import { NavbarCta } from "./NavbarCta";

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 font-semibold text-lg">
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
            <span>SketchBlade</span>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">
              Features
            </a>
            <a href="#how-it-works" className="hover:text-foreground transition-colors">
              How it works
            </a>
          </nav>

          <div className="flex items-center gap-1">
            <ThemeToggle />
            <NavbarCta />
          </div>
        </div>
      </div>
    </header>
  );
}
