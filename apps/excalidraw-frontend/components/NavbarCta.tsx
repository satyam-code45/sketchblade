"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "./ui/button";

export function NavbarCta() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    setIsLoggedIn(!!localStorage.getItem("token"));
  }, []);

  if (isLoggedIn) {
    return (
      <Button
        size="sm"
        className="border-0 bg-violet-600 text-white hover:bg-violet-700"
        asChild
      >
        <Link href="/dashboard">Dashboard</Link>
      </Button>
    );
  }

  return (
    <>
      <Button variant="ghost" size="sm" asChild>
        <Link href="/sign-in">Sign In</Link>
      </Button>
      <Button
        size="sm"
        className="border-0 bg-violet-600 text-white hover:bg-violet-700"
        asChild
      >
        <Link href="/sign-up">Get Started</Link>
      </Button>
    </>
  );
}
