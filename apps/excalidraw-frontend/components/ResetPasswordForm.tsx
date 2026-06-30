"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import axios from "axios";
import { Eye, EyeOff, CheckCircle } from "lucide-react";
import { HTTP_BACKEND } from "@/config";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import AuthCard from "./AuthCard";

export default function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [token, setToken] = useState(searchParams.get("token") ?? "");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    if (!token || !newPassword || !confirmPassword) {
      setError("Please fill in all fields.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await axios.post(`${HTTP_BACKEND}/reset-password`, { token, newPassword });
      setSuccess(true);
    } catch (err: unknown) {
      setError(
        axios.isAxiosError(err) && err.response?.data?.message
          ? err.response.data.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <AuthCard
        title="Password reset!"
        subtitle="Your password has been updated successfully"
      >
        <div className="space-y-5 text-center">
          <div className="flex justify-center">
            <CheckCircle className="size-12 text-emerald-500" />
          </div>
          <p className="text-sm text-muted-foreground">
            You can now sign in with your new password.
          </p>
          <Button
            className="w-full border-0 bg-violet-600 text-white hover:bg-violet-700"
            onClick={() => router.push("/sign-in")}
          >
            Go to Sign In
          </Button>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Reset your password"
      subtitle="Enter your reset token and choose a new password"
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Reset Token</label>
          <Input
            type="text"
            placeholder="Paste your reset token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="font-mono text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">New Password</label>
          <div className="relative">
            <Input
              type={showNew ? "text" : "password"}
              placeholder="At least 6 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowNew(!showNew)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={showNew ? "Hide password" : "Show password"}
            >
              {showNew ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Confirm New Password</label>
          <div className="relative">
            <Input
              type={showConfirm ? "text" : "password"}
              placeholder="Re-enter your new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={showConfirm ? "Hide password" : "Show password"}
            >
              {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button
          className="w-full border-0 bg-violet-600 text-white hover:bg-violet-700"
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? "Resetting…" : "Reset Password"}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Need a new token?{" "}
          <Link
            href="/forgot-password"
            className="font-medium text-violet-600 hover:underline dark:text-violet-400"
          >
            Request one
          </Link>
        </p>
      </div>
    </AuthCard>
  );
}
