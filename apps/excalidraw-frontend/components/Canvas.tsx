"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  Ban,
  Check,
  Circle,
  Copy,
  Diamond,
  Download,
  Eraser,
  Hand,
  Highlighter,
  ImagePlus,
  Loader2,
  Lock,
  Maximize2,
  Minus,
  MinusCircle,
  MousePointer2,
  Palette,
  Pencil,
  PlusCircle,
  RotateCcw,
  RotateCw,
  Sparkles,
  Square,
  Type,
  Unlock,
  Video,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Game, Tool, Shape, SelectionInfo } from "@/draw";
import AIPanel from "@/components/ai/AIPanel";
import ChatPanel from "@/components/chat/ChatPanel";
import FloatingToolbar from "@/components/FloatingToolbar";
import StickerPicker from "@/components/StickerPicker";
import { uploadToCloudinary, cloudinaryVideoPoster } from "@/lib/cloudinary";
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
    { id: "pencil",      icon: <Pencil      className="size-[18px]" />, shortcut: "P", label: "Draw" },
    { id: "highlighter", icon: <Highlighter className="size-[18px]" />, shortcut: "G", label: "Highlighter" },
    { id: "text",        icon: <Type        className="size-[18px]" />, shortcut: "T", label: "Text" },
  ],
  [
    { id: "eraser", icon: <Eraser className="size-[18px]" />, shortcut: "X", label: "Eraser" },
  ],
];

const DRAW_COLOR_SWATCHES = [
  "#7c3aed", "#dc2626", "#d97706", "#059669",
  "#0284c7", "#db2777", "#000000", "#ffffff",
];

const FILL_COLOR_SWATCHES = [
  "#ede9fe", "#fee2e2", "#fef3c7", "#dcfce7",
  "#dbeafe", "#fce7f3", "#f1f5f9", "#7c3aed",
];

const BG_COLOR_SWATCHES = [
  "#ffffff", "#f8f9fa", "#f4f1ea", "#eef2ff",
  "#0f172a", "#1e1e2e", "#111827", "#052e16",
];

const STROKE_WIDTH_OPTIONS = [
  { label: "Thin", value: 1.5 },
  { label: "Medium", value: 3 },
  { label: "Thick", value: 6 },
];

const SHAPE_TOOLS: Tool[] = ["rect", "diamond", "ellipse", "arrow", "line", "pencil", "highlighter", "text"];
const FILL_TOOLS: Tool[] = ["rect", "diamond", "ellipse"];
const STROKE_WIDTH_TOOLS: Tool[] = ["rect", "diamond", "ellipse", "arrow", "line", "pencil"];

const EMPTY_SELECTION: SelectionInfo = { count: 0, hasFillable: false, hasStrokable: false, hasText: false, allLocked: false };

const HEX_RE = /^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/;

// A typed hex code, so picking a precise color doesn't always require opening
// the browser's native (visually jarring, out-of-theme) color picker dialog.
function HexColorInput({ value, onCommit }: { value: string; onCommit: (hex: string) => void }) {
  const [text, setText] = useState(value.replace(/^#/, ""));
  useEffect(() => setText(value.replace(/^#/, "")), [value]);

  const commit = () => {
    const trimmed = text.trim();
    if (HEX_RE.test(trimmed)) onCommit(`#${trimmed}`);
    else setText(value.replace(/^#/, "")); // invalid — revert
  };

  return (
    <div className="flex h-6 flex-1 items-center gap-1 rounded-md border border-border/60 bg-background px-1.5">
      <span className="text-[11px] text-muted-foreground">#</span>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
        placeholder="7c3aed"
        maxLength={6}
        className="w-full min-w-0 bg-transparent font-mono text-[11px] text-foreground outline-none placeholder:text-muted-foreground/50"
      />
    </div>
  );
}

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

  // Style: stroke/fill/text color + stroke width + font size (null = follow theme default)
  const [color, setColor]             = useState<string | null>(null);
  const [fillColor, setFillColor]     = useState<string | null>(null);
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [fontSize, setFontSize]       = useState(20);

  // Canvas background — separate from shape style, lives in its own small popover
  const [canvasColor, setCanvasColor]     = useState<string | null>(null);
  const [canvasColorOpen, setCanvasColorOpen] = useState(false);
  const canvasColorRef                    = useRef<HTMLDivElement>(null);

  // Image / video insert via Cloudinary
  const imageInputRef             = useRef<HTMLInputElement>(null);
  const videoInputRef             = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<"image" | "video" | null>(null);
  const [uploadError, setUploadError] = useState("");
  const [videoModal, setVideoModal]   = useState<{ url: string } | null>(null);

  // Selection (select tool): move/resize existing shapes, multi-select
  const [selection, setSelection] = useState<SelectionInfo>(EMPTY_SELECTION);
  const [aiOpen, setAiOpen]       = useState(false);
  const [aiBusyBy, setAiBusyBy]   = useState<string | null>(null);

  // ── Bootstrap game ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;

    const game = new Game(
      canvas, roomId, socket,
      (sx, sy, cx, cy) => { setTextInput({ sx, sy, cx, cy }); setTextValue(""); },
      (z) => setZoom(Math.round(z * 100)),
      (shape) => setVideoModal({ url: shape.url }),
      (info) => setSelection(info)
    );
    gameRef.current = game;
    game.onAIActivity = setAiBusyBy;

    // Resize (not just re-set canvas.width/height directly) so the backing buffer
    // stays scaled to devicePixelRatio — otherwise strokes/text render blurry on
    // high-DPI screens.
    const onResize = () => game.resize(window.innerWidth, window.innerHeight);
    window.addEventListener("resize", onResize);

    return () => {
      game.destory();
      window.removeEventListener("resize", onResize);
      gameRef.current = null;
    };
  }, [roomId, socket]);

  // Sync tool/style into game
  useEffect(() => { gameRef.current?.setTool(selectedTool); }, [selectedTool]);
  useEffect(() => { gameRef.current?.setColor(color); }, [color]);
  useEffect(() => { gameRef.current?.setFillColor(fillColor); }, [fillColor]);
  useEffect(() => { gameRef.current?.setStrokeWidth(strokeWidth); }, [strokeWidth]);
  useEffect(() => { gameRef.current?.setFontSize(fontSize); }, [fontSize]);
  useEffect(() => { gameRef.current?.setCanvasColor(canvasColor); }, [canvasColor]);

  // Theme change → redraw (so canvas background updates)
  useEffect(() => {
    const observer = new MutationObserver(() => gameRef.current?.clearCanvas());
    observer.observe(document.documentElement, { attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  // ── Text commit / dismiss ────────────────────────────────────────────────
  // commit=true saves non-empty text; either way the overlay closes. Used by Enter,
  // blur, Escape, and switching tools — a stray empty box should never linger on screen.
  const closeTextInput = useCallback((commit: boolean) => {
    const game = gameRef.current;
    if (commit && textInput && textValue.trim() && game) {
      game.addShape({
        type: "text",
        x: textInput.cx,
        y: textInput.cy,
        text: textValue.trim(),
        fontSize,
        color: color ?? undefined,
      } as Shape);
    }
    setTextInput(null);
    setTextValue("");
  }, [textInput, textValue, fontSize, color]);

  const closeTextInputRef = useRef(closeTextInput);
  closeTextInputRef.current = closeTextInput;

  // Switching tools (including via a toolbar click) always dismisses any pending text box.
  useEffect(() => {
    if (selectedTool !== "text") closeTextInputRef.current(true);
  }, [selectedTool]);

  // ── Keyboard shortcuts ──────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (textInput) return;
      const game = gameRef.current;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) game?.redo();
        else game?.undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        game?.redo();
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (game && game.getSelectedCount() > 0) {
          e.preventDefault();
          game.deleteSelected();
        }
        return;
      }
      if (e.key === "Escape") {
        // On any drawing tool, Escape backs out to Select (matches "Esc = pointer mode").
        // Already on Select — Escape just clears whatever's selected.
        if (selectedTool !== "select") setSelectedTool("select");
        else game?.clearSelection();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const map: Record<string, Tool> = {
        v: "select", h: "hand",   r: "rect", d: "diamond",
        e: "ellipse", a: "arrow", l: "line", p: "pencil",
        g: "highlighter",
        t: "text",   x: "eraser",
      };
      if (map[e.key.toLowerCase()]) setSelectedTool(map[e.key.toLowerCase()]);
      if (e.key === "=" || e.key === "+") game?.zoomIn();
      if (e.key === "-") game?.zoomOut();
      if (e.key === "0") game?.resetView();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [textInput, selectedTool]);

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

  // ── Canvas background popover: close on outside click ───────────────────
  useEffect(() => {
    if (!canvasColorOpen) return;
    const handler = (e: MouseEvent) => {
      if (canvasColorRef.current && !canvasColorRef.current.contains(e.target as Node)) {
        setCanvasColorOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [canvasColorOpen]);

  // ── Image / video insert (Cloudinary) ───────────────────────────────────
  const handleImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const game = gameRef.current;
    if (!game) return;

    setUploading("image");
    setUploadError("");
    try {
      const { secure_url, width, height } = await uploadToCloudinary(file, "image");
      const ratio  = width && height ? width / height : 1;
      const maxDim = 320;
      const w = ratio >= 1 ? maxDim : maxDim * ratio;
      const h = ratio >= 1 ? maxDim / ratio : maxDim;
      const center = game.getViewportCenter();
      game.addShape({
        type: "image", x: center.x - w / 2, y: center.y - h / 2, width: w, height: h, url: secure_url,
      } as Shape);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Image upload failed");
    } finally {
      setUploading(null);
    }
  };

  const handleVideoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const game = gameRef.current;
    if (!game) return;

    setUploading("video");
    setUploadError("");
    try {
      const { secure_url, width, height } = await uploadToCloudinary(file, "video");
      const ratio  = width && height ? width / height : 16 / 9;
      const maxDim = 360;
      const w = ratio >= 1 ? maxDim : maxDim * ratio;
      const h = ratio >= 1 ? maxDim / ratio : maxDim;
      const center = game.getViewportCenter();
      game.addShape({
        type: "video", x: center.x - w / 2, y: center.y - h / 2, width: w, height: h,
        url: secure_url, poster: cloudinaryVideoPoster(secure_url),
      } as Shape);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Video upload failed");
    } finally {
      setUploading(null);
    }
  };

  // ── Share code ──────────────────────────────────────────────────────────
  const copyCode = async () => {
    if (!roomInfo?.slug) return;
    await navigator.clipboard.writeText(roomInfo.slug);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Contextual style panel visibility (which sections make sense right now) ──
  const isSelecting     = selectedTool === "select" && selection.count > 0;
  const showStylePanel  = SHAPE_TOOLS.includes(selectedTool) || isSelecting;
  const showFill        = FILL_TOOLS.includes(selectedTool) || (isSelecting && selection.hasFillable);
  const showStrokeWidth = STROKE_WIDTH_TOOLS.includes(selectedTool) || (isSelecting && selection.hasStrokable);
  const showFontSize    = selectedTool === "text" || (isSelecting && selection.hasText);

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

      {/* ── Left: contextual style panel (Excalidraw-style) ── */}
      {showStylePanel && (
        <div className="absolute left-4 top-24 z-20 w-52 max-h-[calc(100vh-7rem)] overflow-y-auto rounded-xl border border-border/60 bg-background/90 p-3 shadow-lg backdrop-blur-md">
          {/* Stroke color */}
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Stroke</p>
          <div className="grid grid-cols-8 gap-1.5">
            {DRAW_COLOR_SWATCHES.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                title={c}
                className={[
                  "size-5 rounded-full border shadow-sm transition-transform hover:scale-110",
                  color === c ? "border-violet-500 ring-2 ring-violet-500/50" : "border-border/60",
                ].join(" ")}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            <input
              type="color"
              value={color ?? "#7c3aed"}
              onChange={(e) => setColor(e.target.value)}
              className="h-6 w-6 shrink-0 cursor-pointer rounded-md border border-border/60 bg-transparent p-0"
              title="Custom color"
            />
            <HexColorInput value={color ?? "#7c3aed"} onCommit={setColor} />
          </div>
          <button
            onClick={() => setColor(null)}
            className={[
              "mt-1.5 w-full rounded-md px-2 py-1 text-[11px] transition-colors",
              color === null ? "bg-violet-600/10 text-violet-500" : "text-muted-foreground hover:bg-accent hover:text-foreground",
            ].join(" ")}
          >
            Auto (theme)
          </button>

          {/* Fill (background) — only for closed shapes */}
          {showFill && (
            <>
              <div className="my-3 h-px bg-border/40" />
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Fill</p>
              <div className="grid grid-cols-8 gap-1.5">
                <button
                  onClick={() => setFillColor(null)}
                  title="Transparent"
                  className={[
                    "flex size-5 items-center justify-center rounded-full border shadow-sm transition-transform hover:scale-110",
                    fillColor === null ? "border-violet-500 ring-2 ring-violet-500/50" : "border-border/60",
                  ].join(" ")}
                >
                  <Ban className="size-3 text-muted-foreground" />
                </button>
                {FILL_COLOR_SWATCHES.map((c) => (
                  <button
                    key={c}
                    onClick={() => setFillColor(c)}
                    title={c}
                    className={[
                      "size-5 rounded-full border shadow-sm transition-transform hover:scale-110",
                      fillColor === c ? "border-violet-500 ring-2 ring-violet-500/50" : "border-border/60",
                    ].join(" ")}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                <input
                  type="color"
                  value={fillColor ?? "#7c3aed"}
                  onChange={(e) => setFillColor(e.target.value)}
                  className="h-6 w-6 shrink-0 cursor-pointer rounded-md border border-border/60 bg-transparent p-0"
                  title="Custom fill"
                />
                <HexColorInput value={fillColor ?? "#7c3aed"} onCommit={setFillColor} />
              </div>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                {fillColor ? "Filled" : "Transparent"}
              </p>
            </>
          )}

          {/* Stroke width */}
          {showStrokeWidth && (
            <>
              <div className="my-3 h-px bg-border/40" />
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Stroke width</p>
              <div className="flex gap-1.5">
                {STROKE_WIDTH_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setStrokeWidth(opt.value)}
                    title={opt.label}
                    className={[
                      "flex h-8 flex-1 items-center justify-center rounded-lg border transition-colors",
                      strokeWidth === opt.value
                        ? "border-violet-500 bg-violet-600/10"
                        : "border-border/60 hover:bg-accent",
                    ].join(" ")}
                  >
                    <span
                      className="block w-6 rounded-full bg-foreground"
                      style={{ height: opt.value }}
                    />
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Font size — only for text */}
          {showFontSize && (
            <>
              <div className="my-3 h-px bg-border/40" />
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Font size</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setFontSize((f) => Math.max(10, f - 4))}
                  aria-label="Decrease font size"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                >
                  <MinusCircle className="size-[18px]" />
                </button>
                <span className="min-w-[24px] flex-1 text-center font-mono text-xs text-muted-foreground">{fontSize}</span>
                <button
                  onClick={() => setFontSize((f) => Math.min(96, f + 4))}
                  aria-label="Increase font size"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                >
                  <PlusCircle className="size-[18px]" />
                </button>
              </div>
            </>
          )}
        </div>
      )}

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
                  aria-label={`${tool.label} (${tool.shortcut})`}
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

          {/* Canvas background — independent of tool/selection */}
          <div className="mx-1 h-6 w-px bg-border/60" />
          <div ref={canvasColorRef} className="relative">
            <button
              onClick={() => setCanvasColorOpen((v) => !v)}
              aria-label="Canvas background"
              className="group relative flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              {canvasColor ? (
                <span className="size-[16px] rounded-full border border-border/60 shadow-sm" style={{ backgroundColor: canvasColor }} />
              ) : (
                <Palette className="size-[18px]" />
              )}
              <span className="pointer-events-none absolute -bottom-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-border/60 bg-background/95 px-2 py-1 text-[11px] text-foreground shadow-md opacity-0 transition-opacity group-hover:opacity-100 backdrop-blur-sm">
                Canvas background
              </span>
            </button>
            {canvasColorOpen && (
              <div className="absolute left-1/2 top-full mt-2 w-56 -translate-x-1/2 rounded-xl border border-border/60 bg-background/95 p-3 shadow-xl backdrop-blur-md">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Canvas background
                </p>
                <div className="grid grid-cols-8 gap-1.5">
                  {BG_COLOR_SWATCHES.map((c) => (
                    <button
                      key={c}
                      onClick={() => setCanvasColor(c)}
                      title={c}
                      className={[
                        "size-6 rounded-full border shadow-sm transition-transform hover:scale-110",
                        canvasColor === c ? "border-violet-500 ring-2 ring-violet-500/50" : "border-border/60",
                      ].join(" ")}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <div className="mt-2.5 flex items-center gap-1.5">
                  <input
                    type="color"
                    value={canvasColor ?? "#f8f9fa"}
                    onChange={(e) => setCanvasColor(e.target.value)}
                    className="h-7 w-7 shrink-0 cursor-pointer rounded-md border border-border/60 bg-transparent p-0"
                    title="Custom background"
                  />
                  <HexColorInput value={canvasColor ?? "#f8f9fa"} onCommit={setCanvasColor} />
                </div>
                <button
                  onClick={() => setCanvasColor(null)}
                  className={[
                    "mt-2 w-full rounded-md px-2 py-1 text-[11px] transition-colors",
                    canvasColor === null
                      ? "bg-violet-600/10 text-violet-500"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  ].join(" ")}
                >
                  Auto (theme)
                </button>
              </div>
            )}
          </div>

          {/* Insert: image / video (uploaded to Cloudinary) */}
          <div className="mx-1 h-6 w-px bg-border/60" />
          <button
            onClick={() => imageInputRef.current?.click()}
            disabled={uploading !== null}
            aria-label="Insert image"
            className="group relative flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
          >
            {uploading === "image" ? <Loader2 className="size-[18px] animate-spin" /> : <ImagePlus className="size-[18px]" />}
            <span className="pointer-events-none absolute -bottom-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-border/60 bg-background/95 px-2 py-1 text-[11px] text-foreground shadow-md opacity-0 transition-opacity group-hover:opacity-100 backdrop-blur-sm">
              Insert image
            </span>
          </button>
          <button
            onClick={() => videoInputRef.current?.click()}
            disabled={uploading !== null}
            aria-label="Insert video"
            className="group relative flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
          >
            {uploading === "video" ? <Loader2 className="size-[18px] animate-spin" /> : <Video className="size-[18px]" />}
            <span className="pointer-events-none absolute -bottom-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-border/60 bg-background/95 px-2 py-1 text-[11px] text-foreground shadow-md opacity-0 transition-opacity group-hover:opacity-100 backdrop-blur-sm">
              Insert video
            </span>
          </button>

          {/* Undo */}
          <div className="mx-1 h-6 w-px bg-border/60" />
          <button
            onClick={() => gameRef.current?.undo()}
            aria-label="Undo"
            className="group relative flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <RotateCcw className="size-[18px]" />
            <span className="pointer-events-none absolute -bottom-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-border/60 bg-background/95 px-2 py-1 text-[11px] text-foreground shadow-md opacity-0 transition-opacity group-hover:opacity-100 backdrop-blur-sm">
              Undo <kbd className="ml-1 font-mono text-muted-foreground">⌘Z</kbd>
            </span>
          </button>
          <button
            onClick={() => gameRef.current?.redo()}
            aria-label="Redo"
            className="group relative flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <RotateCw className="size-[18px]" />
            <span className="pointer-events-none absolute -bottom-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-border/60 bg-background/95 px-2 py-1 text-[11px] text-foreground shadow-md opacity-0 transition-opacity group-hover:opacity-100 backdrop-blur-sm">
              Redo <kbd className="ml-1 font-mono text-muted-foreground">⌘⇧Z</kbd>
            </span>
          </button>
        </div>
      </div>

      {/* Hidden file inputs for Cloudinary uploads */}
      <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageFile} />
      <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={handleVideoFile} />

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
          {/* Explicit theme toggle wins over a manually-picked canvas background —
              switch back to "Auto" so the whiteboard always matches light/dark mode. */}
          <ThemeToggle onToggle={() => setCanvasColor(null)} />
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

      {/* ── Selection status (select tool) ── */}
      {selection.count > 0 && (
        <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-border/60 bg-background/90 px-3 py-2 shadow-lg backdrop-blur-md">
          <p className="text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground">
              {selection.count === 1 ? "1 shape" : `${selection.count} shapes`} selected
            </span>
            {selection.allLocked ? (
              " — locked"
            ) : (
              <>
                {" — drag to move"}
                {selection.count === 1 && ", handles to resize"}
              </>
            )}
            {" · "}<kbd className="font-mono">Del</kbd> to remove · <kbd className="font-mono">Esc</kbd> to deselect
          </p>
          <div className="h-4 w-px bg-border/60" />
          <button
            onClick={() => gameRef.current?.toggleLockSelected()}
            title={selection.allLocked ? "Unlock" : "Lock"}
            className={[
              "flex h-6 w-6 items-center justify-center rounded-md transition-colors",
              selection.allLocked
                ? "bg-violet-600/10 text-violet-500"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            ].join(" ")}
          >
            {selection.allLocked ? <Lock className="size-3.5" /> : <Unlock className="size-3.5" />}
          </button>
        </div>
      )}

      {/* ── Text input overlay ── */}
      {textInput && (
        <textarea
          ref={textareaRef}
          style={{
            left: textInput.sx, top: textInput.sy - 12, position: "absolute",
            fontSize: `${fontSize}px`, color: color ?? undefined,
          }}
          className="z-30 min-h-[36px] min-w-[140px] resize-none rounded-lg border-2 border-violet-500 bg-background px-3 py-2 text-foreground outline-none shadow-xl"
          rows={1}
          placeholder="Type here…"
          value={textValue}
          onChange={(e) => setTextValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); closeTextInput(true); }
            if (e.key === "Escape") closeTextInput(false);
          }}
          onBlur={() => closeTextInput(true)}
        />
      )}

      {/* ── Upload error toast ── */}
      {uploadError && (
        <div className="absolute bottom-20 left-1/2 z-30 -translate-x-1/2 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-500 shadow-lg backdrop-blur-md">
          {uploadError}
          <button onClick={() => setUploadError("")} className="ml-2 underline underline-offset-2">
            Dismiss
          </button>
        </div>
      )}

      {aiBusyBy && (
        <div className="absolute bottom-16 right-4 z-30 rounded-lg border border-border/60 bg-background/90 px-3 py-1.5 text-xs text-muted-foreground shadow-lg backdrop-blur-md">
          {aiBusyBy} is generating…
        </div>
      )}

      <FloatingToolbar game={gameRef.current} selection={selection} />
      <StickerPicker game={gameRef.current} />
      <ChatPanel game={gameRef.current} roomId={roomId} />

      {/* ── AI diagram generation ── */}
      <button
        onClick={async () => {
          const blob = await gameRef.current?.exportPNG({ selectionOnly: selection.count > 0 });
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `sketchblade-${roomId}.png`;
          a.click();
          URL.revokeObjectURL(url);
        }}
        title={selection.count > 0 ? "Export selection as PNG" : "Export board as PNG"}
        className="absolute bottom-4 right-52 z-30 flex h-10 items-center gap-2 rounded-xl border border-border/60 bg-background/90 px-3 text-sm font-medium shadow-lg backdrop-blur-md hover:bg-accent"
      >
        <Download className="size-4" /> Export
      </button>

      <button
        onClick={() => setAiOpen((v) => !v)}
        title="Generate with AI"
        className={`absolute bottom-4 right-4 z-30 flex h-10 items-center gap-2 rounded-xl border border-border/60 px-3 text-sm font-medium shadow-lg backdrop-blur-md transition-colors ${
          aiOpen ? "bg-primary text-primary-foreground" : "bg-background/90 hover:bg-accent"
        }`}
      >
        <Sparkles className="size-4" /> AI
      </button>
      {aiOpen && <AIPanel game={gameRef.current} onClose={() => setAiOpen(false)} />}

      {/* ── Video playback modal ── */}
      {videoModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setVideoModal(null)}
        >
          <video
            src={videoModal.url}
            controls
            autoPlay
            className="max-h-[85vh] max-w-[85vw] rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setVideoModal(null)}
            title="Close"
            className="absolute right-6 top-6 flex h-9 w-9 items-center justify-center rounded-full bg-background/20 text-white transition-colors hover:bg-background/30"
          >
            <X className="size-5" />
          </button>
        </div>
      )}
    </div>
  );
}
