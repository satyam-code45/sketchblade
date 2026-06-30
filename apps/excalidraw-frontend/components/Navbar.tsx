import Link from "next/link";
import Image from "next/image";
import ThemeToggle from "./ThemeToggle";
import { NavbarCta } from "./NavbarCta";

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 font-semibold text-lg">
            <Image src="/logo.png" alt="SketchBlade" width={40} height={40} className="rounded-xl" />
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
