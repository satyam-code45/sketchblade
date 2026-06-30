import Link from "next/link";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { HeroCta } from "@/components/HeroCta";
import { ArrowRight, Lock, Pencil, Users, Zap } from "lucide-react";

const features = [
  {
    icon: Zap,
    title: "Real-time Collaboration",
    description:
      "Every stroke syncs instantly. Draw with your team and see changes the moment they happen — no refresh, no lag.",
    color: "text-yellow-500",
    bg: "bg-yellow-500/10",
  },
  {
    icon: Pencil,
    title: "Multiple Drawing Tools",
    description:
      "Freehand pencil, rectangles, and circles to sketch wireframes, diagrams, or anything your team needs.",
    color: "text-violet-500",
    bg: "bg-violet-500/10",
  },
  {
    icon: Users,
    title: "Room-based Sessions",
    description:
      "Create a private room in one click, share the link, and your whole team is drawing together instantly.",
    color: "text-sky-500",
    bg: "bg-sky-500/10",
  },
  {
    icon: Lock,
    title: "Secure & Authenticated",
    description:
      "JWT-based auth keeps your rooms private. Only invited collaborators can access your canvas.",
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
  },
];

const steps = [
  {
    number: "01",
    title: "Create Your Account",
    description: "Sign up with your email in seconds. No credit card required.",
  },
  {
    number: "02",
    title: "Open a Room",
    description:
      "Create a drawing room with a unique link you can share with your team.",
  },
  {
    number: "03",
    title: "Draw Together",
    description:
      "Collaborate in real-time on a shared canvas. See every stroke as it happens.",
  },
];

export default function Page() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      <main>
        {/* ── Hero ── */}
        <section className="relative overflow-hidden pt-20 pb-24 px-4 sm:px-6 lg:px-8">
          {/* Ambient glow */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-1/2 top-0 h-[420px] w-[700px] -translate-x-1/2 rounded-full bg-violet-500/10 blur-3xl" />
          </div>

          <div className="relative mx-auto max-w-7xl">
            <div className="grid items-center gap-12 lg:grid-cols-2">

              {/* Left — copy */}
              <div>
                <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-sm font-medium text-violet-600 dark:text-violet-400">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-500" />
                  Real-time Collaborative Drawing
                </div>

                <h1 className="mb-6 text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
                  Sketch.{" "}
                  <span className="text-violet-600 dark:text-violet-400">
                    Collaborate.
                  </span>
                  <br />
                  Create Together.
                </h1>

                <p className="mb-8 max-w-lg text-lg leading-relaxed text-muted-foreground">
                  SketchBlade is a real-time collaborative canvas where teams
                  bring ideas to life. Create a room, share the link, and draw
                  simultaneously.
                </p>

                <HeroCta />
              </div>

              {/* Right — canvas illustration */}
              <div className="relative hidden lg:block">
                <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
                  {/* Window chrome */}
                  <div className="flex items-center border-b border-border bg-muted/50 px-4 py-3">
                    <div className="flex gap-1.5">
                      <div className="h-3 w-3 rounded-full bg-red-400" />
                      <div className="h-3 w-3 rounded-full bg-yellow-400" />
                      <div className="h-3 w-3 rounded-full bg-green-400" />
                    </div>
                    <span className="mx-auto text-xs text-muted-foreground">
                      SketchBlade — Team Canvas
                    </span>
                    <div className="flex items-center gap-1.5">
                      <div className="h-2 w-2 rounded-full bg-emerald-500" />
                      <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                        3 live
                      </span>
                    </div>
                  </div>

                  {/* Canvas */}
                  <div className="bg-background">
                    <svg viewBox="0 0 480 300" className="h-auto w-full">
                      <defs>
                        <pattern
                          id="grid-dots"
                          x="0"
                          y="0"
                          width="24"
                          height="24"
                          patternUnits="userSpaceOnUse"
                        >
                          <circle cx="2" cy="2" r="0.8" fill="currentColor" />
                        </pattern>
                      </defs>
                      <rect
                        width="480"
                        height="300"
                        fill="url(#grid-dots)"
                        opacity="0.12"
                      />

                      {/* Rectangle (violet) */}
                      <rect
                        x="50"
                        y="45"
                        width="150"
                        height="100"
                        rx="6"
                        stroke="#7c3aed"
                        strokeWidth="2"
                        fill="rgba(124,58,237,0.06)"
                      />

                      {/* Circle (sky) */}
                      <circle
                        cx="360"
                        cy="100"
                        r="68"
                        stroke="#0ea5e9"
                        strokeWidth="2"
                        fill="rgba(14,165,233,0.06)"
                      />

                      {/* Pencil stroke (emerald) */}
                      <path
                        d="M 70 215 Q 115 195 160 218 Q 205 240 255 210 Q 305 182 350 200 Q 385 213 415 200"
                        stroke="#10b981"
                        strokeWidth="2.5"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M 70 238 Q 135 258 195 238 Q 255 218 315 238"
                        stroke="#10b981"
                        strokeWidth="2"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        opacity="0.5"
                      />

                      {/* Cursor: Alice (orange) */}
                      <g transform="translate(170, 52)">
                        <polygon
                          points="0,0 0,18 4,14 7,22 10,21 7,13 13,13"
                          fill="#f97316"
                          stroke="white"
                          strokeWidth="0.8"
                        />
                        <rect x="15" y="7" width="44" height="17" rx="4" fill="#f97316" />
                        <text
                          x="37"
                          y="19.5"
                          textAnchor="middle"
                          fill="white"
                          fontSize="9"
                          fontFamily="system-ui,sans-serif"
                          fontWeight="600"
                        >
                          Alice
                        </text>
                      </g>

                      {/* Cursor: Bob (sky) */}
                      <g transform="translate(316, 152)">
                        <polygon
                          points="0,0 0,18 4,14 7,22 10,21 7,13 13,13"
                          fill="#0ea5e9"
                          stroke="white"
                          strokeWidth="0.8"
                        />
                        <rect x="15" y="7" width="38" height="17" rx="4" fill="#0ea5e9" />
                        <text
                          x="34"
                          y="19.5"
                          textAnchor="middle"
                          fill="white"
                          fontSize="9"
                          fontFamily="system-ui,sans-serif"
                          fontWeight="600"
                        >
                          Bob
                        </text>
                      </g>

                      {/* Cursor: You (violet) */}
                      <g transform="translate(242, 202)">
                        <polygon
                          points="0,0 0,18 4,14 7,22 10,21 7,13 13,13"
                          fill="#7c3aed"
                          stroke="white"
                          strokeWidth="0.8"
                        />
                        <rect x="15" y="7" width="32" height="17" rx="4" fill="#7c3aed" />
                        <text
                          x="31"
                          y="19.5"
                          textAnchor="middle"
                          fill="white"
                          fontSize="9"
                          fontFamily="system-ui,sans-serif"
                          fontWeight="600"
                        >
                          You
                        </text>
                      </g>
                    </svg>
                  </div>
                </div>

                {/* Floating badges */}
                <div className="absolute -bottom-5 -left-5 rounded-xl border border-border bg-card px-4 py-2.5 shadow-lg">
                  <p className="text-xs text-muted-foreground">Active now</p>
                  <p className="text-sm font-semibold">3 users drawing</p>
                </div>
                <div className="absolute -right-5 -top-5 rounded-xl bg-violet-600 px-4 py-2.5 text-white shadow-lg">
                  <p className="text-xs opacity-80">WebSocket sync</p>
                  <p className="text-sm font-semibold">Live updates</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Features ── */}
        <section
          id="features"
          className="border-t border-border/50 py-24 px-4 sm:px-6 lg:px-8"
        >
          <div className="mx-auto max-w-7xl">
            <div className="mb-16 text-center">
              <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-violet-600 dark:text-violet-400">
                Features
              </p>
              <h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl">
                Everything you need to create together
              </h2>
              <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
                SketchBlade gives your team the tools to collaborate visually —
                no plugins, no installs, just a browser.
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <div
                    key={feature.title}
                    className="rounded-2xl border border-border bg-card p-6 transition-all hover:border-violet-500/30 hover:shadow-lg"
                  >
                    <div
                      className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl ${feature.bg}`}
                    >
                      <Icon className={`size-5 ${feature.color}`} />
                    </div>
                    <h3 className="mb-2 text-base font-semibold">{feature.title}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {feature.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── How It Works ── */}
        <section
          id="how-it-works"
          className="bg-muted/30 py-24 px-4 sm:px-6 lg:px-8"
        >
          <div className="mx-auto max-w-7xl">
            <div className="mb-16 text-center">
              <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-violet-600 dark:text-violet-400">
                How it works
              </p>
              <h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl">
                Up and running in seconds
              </h2>
              <p className="mx-auto max-w-xl text-lg text-muted-foreground">
                No downloads, no setup. Create an account and start drawing
                with your team right away.
              </p>
            </div>

            <div className="grid gap-10 md:grid-cols-3">
              {steps.map((step) => (
                <div key={step.number} className="flex flex-col items-center text-center">
                  <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-violet-500/20 bg-violet-500/10">
                    <span className="font-mono text-2xl font-bold text-violet-600 dark:text-violet-400">
                      {step.number}
                    </span>
                  </div>
                  <h3 className="mb-3 text-xl font-semibold">{step.title}</h3>
                  <p className="leading-relaxed text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA Banner ── */}
        <section className="py-24 px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl">
            <div className="relative overflow-hidden rounded-3xl bg-violet-600 p-12 text-center text-white">
              {/* Dot pattern overlay */}
              <div className="pointer-events-none absolute inset-0 opacity-10">
                <svg width="100%" height="100%">
                  <defs>
                    <pattern
                      id="cta-dots"
                      x="0"
                      y="0"
                      width="32"
                      height="32"
                      patternUnits="userSpaceOnUse"
                    >
                      <circle cx="2" cy="2" r="1.5" fill="white" />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#cta-dots)" />
                </svg>
              </div>

              <div className="relative">
                <h2 className="mb-4 text-3xl font-bold sm:text-4xl">
                  Ready to draw together?
                </h2>
                <p className="mx-auto mb-8 max-w-md text-lg text-violet-100">
                  SketchBlade is free to use. Create your account and start
                  collaborating in seconds.
                </p>
                <div className="flex flex-wrap justify-center gap-3">
                  <Button
                    size="lg"
                    className="gap-2 border-0 bg-white font-semibold text-violet-700 hover:bg-violet-50"
                    asChild
                  >
                    <Link href="/sign-up">
                      Get Started Free
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                  <Button
                    size="lg"
                    className="gap-2 border border-white/40 bg-transparent text-white hover:bg-white/15 hover:text-white"
                    asChild
                  >
                    <a
                      href="https://github.com/satyam-code45/sketchblade"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <svg viewBox="0 0 24 24" className="size-4 fill-current" aria-hidden="true">
                        <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"/>
                      </svg>
                      View on GitHub
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-border py-10 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2.5 font-semibold">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-600 text-white">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
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
          </div>

          <nav className="flex gap-6 text-sm text-muted-foreground">
            <a href="#features" className="transition-colors hover:text-foreground">
              Features
            </a>
            <Link href="/sign-in" className="transition-colors hover:text-foreground">
              Sign In
            </Link>
            <Link href="/sign-up" className="transition-colors hover:text-foreground">
              Sign Up
            </Link>
          </nav>

          <p className="text-sm text-muted-foreground">
            © 2025 SketchBlade. Open source under MIT.
          </p>
        </div>
      </footer>
    </div>
  );
}
