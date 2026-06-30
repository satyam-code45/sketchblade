"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import axios from "axios";
import { Copy, Check } from "lucide-react";
import { HTTP_BACKEND } from "@/config";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import AuthCard from "./AuthCard";

export default function ForgotPasswordForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async () => {
    if (!email) {
      setError("Please enter your email address.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await axios.post(`${HTTP_BACKEND}/forgot-password`, { email });
      if (res.data.resetToken) {
        setResetToken(res.data.resetToken);
      } else {
        // Email not found — show generic success so we don't reveal account existence
        setResetToken("not-found");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const copyToken = async () => {
    await navigator.clipboard.writeText(resetToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (resetToken) {
    return (
      <AuthCard
        title="Check your email"
        subtitle="A reset token has been generated for your account"
      >
        {resetToken === "not-found" ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">
              If <span className="font-medium text-foreground">{email}</span> is
              registered, you&apos;ll receive a reset token.
            </p>
            <Link
              href="/sign-in"
              className="inline-block text-sm font-medium text-violet-600 hover:underline dark:text-violet-400"
            >
              Back to Sign In
            </Link>
          </div>
        ) : (
          <div className="space-y-5">
            <p className="text-sm text-muted-foreground">
              Copy your reset token below and use it to set a new password. It
              expires in <span className="font-medium text-foreground">1 hour</span>.
            </p>

            <div className="rounded-lg border border-border bg-muted/50 p-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Reset Token
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 break-all text-xs font-mono text-foreground">
                  {resetToken}
                </code>
                <button
                  onClick={copyToken}
                  className="flex-shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                  aria-label="Copy token"
                >
                  {copied ? <Check className="size-4 text-emerald-500" /> : <Copy className="size-4" />}
                </button>
              </div>
            </div>

            <p className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-700 dark:text-yellow-400">
              Demo mode — in production this token would be sent to your email.
            </p>

            <Button
              className="w-full border-0 bg-violet-600 text-white hover:bg-violet-700"
              onClick={() => router.push(`/reset-password?token=${resetToken}`)}
            >
              Reset Password Now
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              <Link
                href="/sign-in"
                className="font-medium text-violet-600 hover:underline dark:text-violet-400"
              >
                Back to Sign In
              </Link>
            </p>
          </div>
        )}
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Forgot your password?"
      subtitle="Enter your email and we'll generate a reset token"
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Email address</label>
          <Input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button
          className="w-full border-0 bg-violet-600 text-white hover:bg-violet-700"
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? "Sending…" : "Send Reset Token"}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Remembered it?{" "}
          <Link
            href="/sign-in"
            className="font-medium text-violet-600 hover:underline dark:text-violet-400"
          >
            Back to Sign In
          </Link>
        </p>
      </div>
    </AuthCard>
  );
}
