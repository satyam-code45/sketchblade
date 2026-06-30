"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "./ui/button";

export function HeroCta() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userName, setUserName] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");
    setIsLoggedIn(!!token);
    setUserName(localStorage.getItem("userName") ?? "");
  }, []);

  const avatarColors = ["bg-orange-400", "bg-sky-400", "bg-violet-400"];

  return (
    <>
      <div className="flex flex-wrap gap-3">
        {isLoggedIn ? (
          <Button
            size="lg"
            className="gap-2 border-0 bg-violet-600 text-white hover:bg-violet-700"
            asChild
          >
            <Link href="/dashboard">
              {userName ? `Back to Dashboard` : "Go to Dashboard"}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        ) : (
          <>
            <Button
              size="lg"
              className="gap-2 border-0 bg-violet-600 text-white hover:bg-violet-700"
              asChild
            >
              <Link href="/sign-up">
                Start Drawing Free
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link href="/sign-in">Sign In</Link>
            </Button>
          </>
        )}
      </div>

      <div className="mt-8 flex items-center gap-3 text-sm text-muted-foreground">
        <div className="flex -space-x-2">
          {["A", "B", "C"].map((letter, i) => (
            <div
              key={letter}
              className={`flex h-7 w-7 items-center justify-center rounded-full border-2 border-background text-xs font-bold text-white ${avatarColors[i]}`}
            >
              {letter}
            </div>
          ))}
        </div>
        <span>Join teams already drawing together</span>
      </div>
    </>
  );
}
