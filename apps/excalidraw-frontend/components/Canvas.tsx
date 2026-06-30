"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  Check,
  Circle,
  Copy,
  Diamond,
  Eraser,
  Hand,
  Maximize2,
  Minus,
  MousePointer2,
  Pencil,
  RotateCcw,
  Square,
  Type,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Game, Tool, Shape } from "@/draw";
import ThemeToggle from "./ThemeToggle";
import React from "react";

export type { Tool };

interface OnlineUser {
  userId: string;
  name: string;
}

export interface RoomInfo {
  id: number;
  slug: string;
  name: string | null;
}

const USER_COLORS = ["#7c3aed", "#0284c7", "#059669", "#d97706", "#dc2626", "#db2777", "#6d28d9", "#0891b2"];

function userColor(userId: string) {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = userId.charCodeAt(i) + ((h << 5) - h);
  return USER_COLORS[Math.abs(h) % USER_COLORS.length];
}

const TOOL_GROUPS: { id: Tool; icon: React.ReactNode; shortcut: string; label: string }[][] = [
  [
    { id: "select", icon: <MousePointer2 className="size-[18px]" />, shortcut: "V", label: "Select" },
    { id: "hand",   icon: <Hand          className="size-[18px]" />, shortcut: "H", label: "Hand" },
  ],
  [
    { id: "rect",    icon: <Square       className="size-[18px]" />, shortcut: "R", label: "Rectangle" },
    { id: "diamond", icon: <Diamond      className="size-[18px]" />, shortcut: "D", label: "Diamond" },
    { id: "ellipse", icon: <Circle       className="size-[18px]" />, shortcut: "E", label: "Ellipse" },
    { id: "arrow",   icon: <ArrowRight   className="size-[18px]" />, shortcut: "A", label: "Arrow" },
    { id: "line",    icon: <Minus        className="size-[18px]" />, shortcut: "L", label: "Line" },
  ],
  [
    { id: "pencil", icon: <Pencil className="size-[18px]" />, shortcut: "P", label: "Draw" },
    { id: "text",   icon: <Type   className="size-[18px]" />, shortcut: "T", label: "Text" },
  ],
  [
    { id: "eraser", icon: <Eraser className="size-[18px]" />, shortcut: "X", label: "Eraser" },
  ],
];

export default function Canvas({
  roomId,
  socket,
  onlineUsers,
  roomInfo,
}: {
  roomId: string;
  socket: WebSocket;
  onlineUsers: OnlineUser[];
  roomInfo: RoomInfo | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef   = useRef<Game | null>(null);

  const [selectedTool, setSelectedTool] = useState<Tool>("rect");
  const [zoom, setZoom]                 = useState(100);
  const [copied, setCopied]             = useState(false);
  const [presenceOpen, setPresenceOpen] = useState(false);
  const presenceRef                     = useRef<HTMLDivElement>(null);
  const textareaRef                     = useRef<HTMLTextAreaElement>(null);

  // Text input overlay
  const [textInput, setTextInput] = useState<{
    sx: number; sy: number; cx: number; cy: number;
  } | null>(null);
  const [textValue, setTextValue] = useState("");

  // ── Bootstrap game ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;

    const game = new Game(
      canvas, roomId, socket,
      (sx, sy, cx, cy) => { setTextInput({ sx, sy, cx, cy }); setTextValue(""); },
      (z) => setZoom(Math.round(z * 100))
    );
    gameRef.current = game;

    const onResize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
      game.clearCanvas();
    };
    window.addEventListener("resize", onResize);

    return () => {
      game.destory();
      window.removeEventListener("resize", onResize);
      gameRef.current = null;
    };
  }, [roomId, socket]);

  // Sync tool into game
  useEffect(() => { gameRef.current?.setTool(selectedTool); }, [selectedTool]);

  // Theme change → redraw (so canvas background updates)
  useEffect(() => {
    const observer = new MutationObserver(() => gameRef.current?.clearCanvas());
    observer.observe(document.documentElement, { attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  // ── Keyboard shortcuts ──────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (textInput) return;
      const game = gameRef.current;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        game?.undo();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const map: Record<string, Tool> = {
        v: "select", h: "hand",   r: "rect", d: "diamond",
        e: "ellipse", a: "arrow", l: "line", p: "pencil",
        t: "text",   x: "eraser",
      };
      if (map[e.key.toLowerCase()]) setSelectedTool(map[e.key.toLowerCase()]);
      if (e.key === "=" || e.key === "+") game?.zoomIn();
      if (e.key === "-") game?.zoomOut();
      if (e.key === "0") game?.resetView();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [textInput]);

  // ── Focus textarea when it appears ─────────────────────────────────────
  useEffect(() => {
    if (textInput) {
      // rAF ensures the element is in the DOM before we call focus
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  }, [textInput]);

  // ── Presence dropdown: close on outside click ───────────────────────────
  useEffect(() => {
    if (!presenceOpen) return;
    const handler = (e: MouseEvent) => {
      if (presenceRef.current && !presenceRef.current.contains(e.target as Node)) {
        setPresenceOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [presenceOpen]);

  // ── Text commit ─────────────────────────────────────────────────────────
  const commitText = useCallback(() => {
    const game = gameRef.current;
    if (textInput && textValue.trim() && game) {
      game.addShape({ type: "text", x: textInput.cx, y: textInput.cy, text: textValue.trim() } as Shape);
    }
    setTextInput(null);
    setTextValue("");
  }, [textInput, textValue]);

  // ── Share code ──────────────────────────────────────────────────────────
  const copyCode = async () => {
    if (!roomInfo?.slug) return;
    await navigator.clipboard.writeText(roomInfo.slug);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="relative h-screen w-screen overflow-hidden">
      {/* Canvas fills entire screen */}
      <canvas ref={canvasRef} className="absolute inset-0 touch-none" />

      {/* ── Top-left: logo + room info ── */}
      <div className="absolute left-4 top-4 z-20">
        <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-background/90 p-1.5 shadow-sm backdrop-blur-md">
          {/* SketchBlade logo mark — clicking goes back to dashboard */}
          <Link
            href="/dashboard"
            title="Back to Dashboard"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg overflow-hidden transition-opacity hover:opacity-80"
          >
            <Image src="/logo.png" alt="SketchBlade" width={36} height={36} className="rounded-lg" />
          </Link>

          {roomInfo ? (
            <>
              <div className="flex min-w-0 flex-col pr-0.5">
                <span className="max-w-[140px] truncate text-sm font-semibold leading-tight">
                  {roomInfo.name ?? "Untitled Room"}
                </span>
                <span className="text-[11px] leading-tight text-muted-foreground">SketchBlade</span>
              </div>
              <div className="h-4 w-px bg-border/60" />
              <button
                onClick={copyCode}
                className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                title="Copy room code"
              >
                <span className="font-mono tracking-wide">{roomInfo.slug}</span>
                {copied
                  ? <Check className="size-3 text-emerald-500" />
                  : <Copy className="size-3" />}
              </button>
            </>
          ) : (
            <span className="pr-2 text-sm font-semibold">SketchBlade</span>
          )}
        </div>
      </div>

      {/* ── Center: tool palette ── */}
      <div className="absolute left-1/2 top-4 z-20 -translate-x-1/2">
        <div className="flex items-center gap-0.5 rounded-xl border border-border/60 bg-background/90 p-1.5 shadow-lg backdrop-blur-md">
          {TOOL_GROUPS.map((group, gi) => (
            <React.Fragment key={gi}>
              {gi > 0 && <div className="mx-1 h-6 w-px bg-border/60" />}
              {group.map((tool) => (
                <button
                  key={tool.id}
                  onClick={() => setSelectedTool(tool.id)}
                  title={`${tool.label}  ${tool.shortcut}`}
                  className={[
                    "group relative flex h-8 w-8 items-center justify-center rounded-lg transition-all",
                    selectedTool === tool.id
                      ? "bg-violet-600 text-white shadow-sm"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  ].join(" ")}
                >
                  {tool.icon}
                  {/* Tooltip */}
                  <span className="pointer-events-none absolute -bottom-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-border/60 bg-background/95 px-2 py-1 text-[11px] text-foreground shadow-md opacity-0 transition-opacity group-hover:opacity-100 backdrop-blur-sm">
                    {tool.label}
                    <kbd className="ml-1.5 font-mono text-muted-foreground">{tool.shortcut}</kbd>
                  </span>
                </button>
              ))}
            </React.Fragment>
          ))}

          {/* Undo */}
          <div className="mx-1 h-6 w-px bg-border/60" />
          <button
            onClick={() => gameRef.current?.undo()}
            title="Undo  Ctrl+Z"
            className="group relative flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <RotateCcw className="size-[18px]" />
            <span className="pointer-events-none absolute -bottom-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-border/60 bg-background/95 px-2 py-1 text-[11px] text-foreground shadow-md opacity-0 transition-opacity group-hover:opacity-100 backdrop-blur-sm">
              Undo <kbd className="ml-1 font-mono text-muted-foreground">⌘Z</kbd>
            </span>
          </button>
        </div>
      </div>

      {/* ── Top-right: presence + theme ── */}
      <div className="absolute right-4 top-4 z-20 flex items-center gap-2">
        {/* Online users — clickable dropdown */}
        {onlineUsers.length > 0 && (
          <div ref={presenceRef} className="relative">
            <button
              onClick={() => setPresenceOpen((v) => !v)}
              className="flex items-center gap-2 rounded-xl border border-border/60 bg-background/80 px-3 py-1.5 shadow-sm backdrop-blur-md hover:bg-background/95 transition-colors"
            >
              {/* Stacked avatars */}
              <div className="flex -space-x-2">
                {onlineUsers.slice(0, 4).map((user) => (
                  <div
                    key={user.userId}
                    className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-background text-[11px] font-bold text-white shadow"
                    style={{ backgroundColor: userColor(user.userId) }}
                  >
                    {(user.name[0] ?? "?").toUpperCase()}
                  </div>
                ))}
                {onlineUsers.length > 4 && (
                  <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-muted text-[11px] font-semibold text-muted-foreground shadow">
                    +{onlineUsers.length - 4}
                  </div>
                )}
              </div>
              <span className="text-xs font-medium text-muted-foreground">
                {onlineUsers.length === 1 ? "1 online" : `${onlineUsers.length} online`}
              </span>
              {/* Chevron */}
              <svg
                className={`size-3 text-muted-foreground transition-transform ${presenceOpen ? "rotate-180" : ""}`}
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
              >
                <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {/* Dropdown */}
            {presenceOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-border/60 bg-background/95 shadow-xl backdrop-blur-md overflow-hidden">
                <div className="border-b border-border/40 px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Online now — {onlineUsers.length}
                  </p>
                </div>
                <ul className="py-1.5 max-h-64 overflow-y-auto">
                  {onlineUsers.map((user) => (
                    <li key={user.userId} className="flex items-center gap-3 px-3 py-2 hover:bg-accent/50 transition-colors">
                      <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white shadow-sm"
                        style={{ backgroundColor: userColor(user.userId) }}
                      >
                        {(user.name[0] ?? "?").toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{user.name}</p>
                        <div className="mt-0.5 flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          <span className="text-[11px] text-muted-foreground">Active</span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Theme toggle */}
        <div className="rounded-xl border border-border/60 bg-background/80 shadow-sm backdrop-blur-md">
          <ThemeToggle />
        </div>
      </div>

      {/* ── Bottom-left: zoom ── */}
      <div className="absolute bottom-4 left-4 z-20 flex items-center gap-0.5 rounded-xl border border-border/60 bg-background/90 p-1 shadow-lg backdrop-blur-md">
        <button
          onClick={() => gameRef.current?.zoomOut()}
          title="Zoom out  −"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <ZoomOut className="size-3.5" />
        </button>
        <button
          onClick={() => gameRef.current?.resetView()}
          title="Reset zoom  0"
          className="min-w-[52px] rounded-lg px-2 py-1 font-mono text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          {zoom}%
        </button>
        <button
          onClick={() => gameRef.current?.zoomIn()}
          title="Zoom in  +"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <ZoomIn className="size-3.5" />
        </button>
        <div className="mx-0.5 h-4 w-px bg-border/60" />
        <button
          onClick={() => gameRef.current?.resetView()}
          title="Fit to screen"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <Maximize2 className="size-3.5" />
        </button>
      </div>

      {/* ── Keyboard hint (bottom-right) ── */}
      <div className="absolute bottom-4 right-4 z-20 rounded-xl border border-border/60 bg-background/80 px-3 py-2 shadow-sm backdrop-blur-md">
        <p className="text-[11px] text-muted-foreground">
          <kbd className="font-mono">Ctrl+scroll</kbd> to zoom · <kbd className="font-mono">H</kbd> to pan
        </p>
      </div>

      {/* ── Text input overlay ── */}
      {textInput && (
        <textarea
          ref={textareaRef}
          style={{ left: textInput.sx, top: textInput.sy - 12, position: "absolute" }}
          className="z-30 min-h-[36px] min-w-[140px] resize-none rounded-lg border-2 border-violet-500 bg-background px-3 py-2 text-base text-foreground outline-none shadow-xl"
          rows={1}
          placeholder="Type here…"
          value={textValue}
          onChange={(e) => setTextValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); commitText(); }
            if (e.key === "Escape") { setTextInput(null); setTextValue(""); }
          }}
          onBlur={() => {
            // Only auto-commit on blur if the user has typed something
            if (textValue.trim()) commitText();
            // If empty, leave it open so the user can still type after clicking back
          }}
        />
      )}
    </div>
  );
}
