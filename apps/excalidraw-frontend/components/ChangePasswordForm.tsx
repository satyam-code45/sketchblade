"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import axios from "axios";
import { Eye, EyeOff, CheckCircle } from "lucide-react";
import { HTTP_BACKEND } from "@/config";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import AuthCard from "./AuthCard";

export default function ChangePasswordForm() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("Please fill in all fields.");
      return;
    }
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }
    if (currentPassword === newPassword) {
      setError("New password must be different from your current password.");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/sign-in");
      return;
    }

    setError("");
    setLoading(true);
    try {
      await axios.post(
        `${HTTP_BACKEND}/change-password`,
        { currentPassword, newPassword },
        { headers: { authorization: token } }
      );
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
        title="Password updated!"
        subtitle="Your password has been changed successfully"
      >
        <div className="space-y-5 text-center">
          <div className="flex justify-center">
            <CheckCircle className="size-12 text-emerald-500" />
          </div>
          <p className="text-sm text-muted-foreground">
            Your new password is active. You&apos;re still signed in.
          </p>
          <Button
            className="w-full border-0 bg-violet-600 text-white hover:bg-violet-700"
            onClick={() => router.push("/")}
          >
            Back to Home
          </Button>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Change your password"
      subtitle="Update your password to keep your account secure"
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Current Password</label>
          <div className="relative">
            <Input
              type={showCurrent ? "text" : "password"}
              placeholder="Enter current password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowCurrent(!showCurrent)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={showCurrent ? "Hide password" : "Show password"}
            >
              {showCurrent ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
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
              placeholder="Re-enter new password"
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
          {loading ? "Updating…" : "Update Password"}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          <Link
            href="/"
            className="font-medium text-violet-600 hover:underline dark:text-violet-400"
          >
            Cancel
          </Link>
        </p>
      </div>
    </AuthCard>
  );
}
