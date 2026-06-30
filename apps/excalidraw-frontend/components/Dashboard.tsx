"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import axios from "axios";
import {
  ArrowRight,
  Check,
  Copy,
  Eye,
  EyeOff,
  Lock,
  LogOut,
  Pencil,
  Plus,
  Users,
} from "lucide-react";
import { HTTP_BACKEND } from "@/config";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import ThemeToggle from "./ThemeToggle";

interface Room {
  id: number;
  slug: string;
  name: string | null;
  adminId: string;
  password: string | null;
  createdAt: string;
}

const LogoIcon = () => (
  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600 text-white">
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M2 14L5.5 10.5L10.5 5.5L12.5 7.5L7.5 12.5L2 14Z"
        stroke="white" strokeWidth="1.5" strokeLinejoin="round" fill="rgba(255,255,255,0.2)"
      />
      <path
        d="M10.5 5.5L12.5 3.5L14.5 5.5L12.5 7.5L10.5 5.5Z"
        stroke="white" strokeWidth="1.5" strokeLinejoin="round" fill="rgba(255,255,255,0.2)"
      />
    </svg>
  </div>
);

export default function Dashboard() {
  const router = useRouter();
  const [userName, setUserName] = useState("");
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);

  // Create room state
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomPassword, setNewRoomPassword] = useState("");
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);
  const [createdRoom, setCreatedRoom] = useState<{ id: number; slug: string; name: string; password: string | null } | null>(null);
  const [showCreatedPassword, setShowCreatedPassword] = useState(false);

  // Join room state
  const [joinSlug, setJoinSlug] = useState("");
  const [joinPassword, setJoinPassword] = useState("");
  const [showJoinPassword, setShowJoinPassword] = useState(false);
  const [joinError, setJoinError] = useState("");
  const [joining, setJoining] = useState(false);

  const [copiedId, setCopiedId] = useState<number | string | null>(null);
  const [revealedPasswords, setRevealedPasswords] = useState<Set<number>>(new Set());

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/sign-in");
      return;
    }
    setUserName(localStorage.getItem("userName") ?? "");
    fetchRooms(token);
  }, [router]);

  const fetchRooms = async (token: string) => {
    try {
      const res = await axios.get(`${HTTP_BACKEND}/my-rooms`, {
        headers: { authorization: token },
      });
      setRooms(res.data.rooms ?? []);
    } catch {
      // silently fail — rooms section will show empty state
    } finally {
      setLoadingRooms(false);
    }
  };

  const createRoom = async () => {
    const trimmed = newRoomName.trim();
    if (!trimmed) { setCreateError("Room name is required."); return; }
    if (trimmed.length > 50) { setCreateError("Room name cannot exceed 50 characters."); return; }
    const token = localStorage.getItem("token")!;
    setCreateError("");
    setCreating(true);
    try {
      const body: { name: string; password?: string } = { name: trimmed };
      if (newRoomPassword.trim()) body.password = newRoomPassword.trim();
      const res = await axios.post(
        `${HTTP_BACKEND}/create-room`,
        body,
        { headers: { authorization: token } }
      );
      const { roomId, slug, password } = res.data;
      setCreatedRoom({ id: roomId, slug, name: trimmed, password: password ?? null });
      setNewRoomName("");
      setNewRoomPassword("");
      // Refresh room list in background
      fetchRooms(token);
    } catch (err: unknown) {
      setCreateError(
        axios.isAxiosError(err) && err.response?.data?.message
          ? err.response.data.message
          : "Could not create room. Please try again."
      );
    } finally {
      setCreating(false);
    }
  };

  const joinRoom = async () => {
    const trimmed = joinSlug.trim();
    if (!trimmed) { setJoinError("Please enter a room code."); return; }
    setJoinError("");
    setJoining(true);
    try {
      const body: { password?: string } = {};
      if (joinPassword.trim()) body.password = joinPassword.trim();
      const res = await axios.post(`${HTTP_BACKEND}/room/${trimmed}/join`, body);
      router.push(`/canvas/${res.data.roomId}`);
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        setJoinError(err.response.data.message);
      } else {
        setJoinError("Room not found. Check the code and try again.");
      }
      setJoining(false);
    }
  };

  const copyCode = async (slug: string) => {
    await navigator.clipboard.writeText(slug);
    setCopiedId(slug);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const copyRoomId = async (room: Room) => {
    await navigator.clipboard.writeText(room.slug);
    setCopiedId(room.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const signOut = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("userName");
    localStorage.removeItem("userId");
    router.push("/");
  };

  const firstName = userName.split(" ")[0];

  return (
    <div className="min-h-screen bg-background">
      {/* ── Header ── */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5 font-semibold">
            <LogoIcon />
            <span>SketchBlade</span>
          </Link>

          <div className="flex items-center gap-2">
            {userName && (
              <span className="hidden text-sm text-muted-foreground sm:block">
                {userName}
              </span>
            )}
            <ThemeToggle />
            <Button
              variant="ghost"
              size="sm"
              onClick={signOut}
              className="gap-1.5"
            >
              <LogOut className="size-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">

        {/* Greeting */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold">
            {firstName ? `Welcome back, ${firstName}!` : "Dashboard"}
          </h1>
          <p className="mt-1 text-muted-foreground">
            Create a new room or jump back into an existing one.
          </p>
        </div>

        {/* ── Quick Actions ── */}
        <div className="mb-12 grid gap-6 sm:grid-cols-2">

          {/* Create Room */}
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10">
                <Plus className="size-5 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <h2 className="font-semibold">Create a Room</h2>
                <p className="text-xs text-muted-foreground">
                  Start a new collaborative session
                </p>
              </div>
            </div>

            {createdRoom ? (
              /* Success state — show the room code */
              <div className="space-y-3">
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-3">
                  <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                    Room &quot;{createdRoom.name}&quot; created!
                  </p>
                  <div>
                    <p className="mb-1.5 text-xs text-muted-foreground">Room code</p>
                    <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm">
                      <span className="flex-1 tracking-widest">{createdRoom.slug}</span>
                      <button
                        onClick={() => copyCode(createdRoom.slug)}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {copiedId === createdRoom.slug
                          ? <Check className="size-4 text-emerald-500" />
                          : <Copy className="size-4" />}
                      </button>
                    </div>
                  </div>
                  {createdRoom.password && (
                    <div>
                      <p className="mb-1.5 text-xs text-muted-foreground">Password</p>
                      <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm">
                        <span className="flex-1">
                          {showCreatedPassword ? createdRoom.password : "••••••••"}
                        </span>
                        <button
                          onClick={() => setShowCreatedPassword((v) => !v)}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {showCreatedPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    className="flex-1 border-0 bg-violet-600 text-white hover:bg-violet-700"
                    onClick={() => router.push(`/canvas/${createdRoom.id}`)}
                  >
                    Open Room <ArrowRight className="ml-1.5 size-4" />
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setCreatedRoom(null)}
                  >
                    New Room
                  </Button>
                </div>
              </div>
            ) : (
              /* Create form */
              <div className="space-y-3">
                <div>
                  <Input
                    placeholder="Room name (e.g. Design Review)"
                    value={newRoomName}
                    maxLength={50}
                    onChange={(e) => {
                      setNewRoomName(e.target.value);
                      setCreateError("");
                    }}
                    onKeyDown={(e) => e.key === "Enter" && createRoom()}
                  />
                </div>
                <div className="relative">
                  <Input
                    type={showCreatePassword ? "text" : "password"}
                    placeholder="Password (optional)"
                    value={newRoomPassword}
                    onChange={(e) => setNewRoomPassword(e.target.value)}
                    className="pr-9"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCreatePassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showCreatePassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                {createError && (
                  <p className="text-xs text-destructive">{createError}</p>
                )}
                <Button
                  className="w-full gap-2 border-0 bg-violet-600 text-white hover:bg-violet-700"
                  onClick={createRoom}
                  disabled={creating}
                >
                  {creating ? "Creating…" : (
                    <>Create Room <ArrowRight className="size-4" /></>
                  )}
                </Button>
              </div>
            )}
          </div>

          {/* Join Room */}
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10">
                <Users className="size-5 text-sky-600 dark:text-sky-400" />
              </div>
              <div>
                <h2 className="font-semibold">Join a Room</h2>
                <p className="text-xs text-muted-foreground">
                  Enter the room code shared with you
                </p>
              </div>
            </div>
            <div className="space-y-3">
              <Input
                placeholder="Room code (e.g. abc12345)"
                value={joinSlug}
                onChange={(e) => {
                  setJoinSlug(e.target.value);
                  setJoinError("");
                }}
                onKeyDown={(e) => e.key === "Enter" && joinRoom()}
              />
              <div className="relative">
                <Input
                  type={showJoinPassword ? "text" : "password"}
                  placeholder="Password (if required)"
                  value={joinPassword}
                  onChange={(e) => {
                    setJoinPassword(e.target.value);
                    setJoinError("");
                  }}
                  onKeyDown={(e) => e.key === "Enter" && joinRoom()}
                  className="pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowJoinPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showJoinPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {joinError && (
                <p className="text-xs text-destructive">{joinError}</p>
              )}
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={joinRoom}
                disabled={joining}
              >
                {joining ? "Joining…" : (
                  <>Join Room <ArrowRight className="size-4" /></>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* ── My Rooms ── */}
        <div>
          <h2 className="mb-5 text-xl font-semibold">My Rooms</h2>

          {loadingRooms ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-32 animate-pulse rounded-2xl border border-border bg-card"
                />
              ))}
            </div>
          ) : rooms.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16 text-center">
              <Pencil className="mb-3 size-10 text-muted-foreground/40" />
              <p className="font-medium">No rooms yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Create your first room above to get started.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rooms.map((room) => (
                <div
                  key={room.id}
                  className="rounded-2xl border border-border bg-card p-5 transition-all hover:border-violet-500/30 hover:shadow-md"
                >
                  <div className="mb-4">
                    <div className="flex items-start gap-2.5">
                      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-500/10">
                        <Pencil className="size-4 text-violet-600 dark:text-violet-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{room.name ?? room.slug}</p>
                        <span className="font-mono text-xs text-muted-foreground tracking-wide">
                          {room.slug}
                        </span>
                        <p className="mt-0.5 text-xs text-muted-foreground/70">
                          {new Date(room.createdAt).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                      </div>
                    </div>
                    {room.password && (
                      <div className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-1.5">
                        <Lock className="size-3 shrink-0 text-muted-foreground" />
                        <span className="flex-1 font-mono text-xs">
                          {revealedPasswords.has(room.id) ? room.password : "••••••••"}
                        </span>
                        <button
                          onClick={() =>
                            setRevealedPasswords((prev) => {
                              const next = new Set(prev);
                              next.has(room.id) ? next.delete(room.id) : next.add(room.id);
                              return next;
                            })
                          }
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {revealedPasswords.has(room.id)
                            ? <EyeOff className="size-3.5" />
                            : <Eye className="size-3.5" />}
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1 border-0 bg-violet-600 text-white hover:bg-violet-700"
                      onClick={() => router.push(`/canvas/${room.id}`)}
                    >
                      Open
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 gap-1.5"
                      onClick={() => copyRoomId(room)}
                    >
                      {copiedId === room.id ? (
                        <>
                          <Check className="size-3 text-emerald-500" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="size-3" />
                          Share Code
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
