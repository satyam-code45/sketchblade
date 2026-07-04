import { getExistingShape } from "./route";

export type Tool =
  | "select"
  | "hand"
  | "rect"
  | "diamond"
  | "ellipse"
  | "arrow"
  | "line"
  | "pencil"
  | "highlighter"
  | "text"
  | "eraser";

// Every shape carries an id (so erases can be replayed from the DB) and an
// optional locked flag (locked shapes can't be moved or resized).
type BaseShape = { id?: string; locked?: boolean };

export type Shape =
  | (BaseShape & { type: "rect";        x: number; y: number; width: number; height: number; color?: string; fillColor?: string; strokeWidth?: number })
  | (BaseShape & { type: "ellipse";     centerX: number; centerY: number; rx: number; ry: number; color?: string; fillColor?: string; strokeWidth?: number })
  | (BaseShape & { type: "circle";      centerX: number; centerY: number; radius: number }) // legacy
  | (BaseShape & { type: "diamond";     x: number; y: number; width: number; height: number; color?: string; fillColor?: string; strokeWidth?: number })
  | (BaseShape & { type: "arrow";       startX: number; startY: number; endX: number; endY: number; color?: string; strokeWidth?: number })
  | (BaseShape & { type: "line";        startX: number; startY: number; endX: number; endY: number; color?: string; strokeWidth?: number })
  | (BaseShape & { type: "pencil";      points: { x: number; y: number }[]; color?: string; strokeWidth?: number })
  | (BaseShape & { type: "highlighter"; points: { x: number; y: number }[]; color?: string })
  | (BaseShape & { type: "text";        x: number; y: number; text: string; fontSize?: number; color?: string })
  | (BaseShape & { type: "image";       x: number; y: number; width: number; height: number; url: string })
  | (BaseShape & { type: "video";       x: number; y: number; width: number; height: number; url: string; poster?: string });

export type VideoShape = Extract<Shape, { type: "video" }>;

export interface SelectionInfo {
  count: number;
  hasFillable: boolean;
  hasStrokable: boolean;
  hasText: boolean;
  allLocked: boolean;
}

type Bounds = { minX: number; minY: number; maxX: number; maxY: number };
type HandleId = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

const OPPOSITE_HANDLE: Record<HandleId, HandleId> = {
  nw: "se", n: "s", ne: "sw", e: "w", se: "nw", s: "n", sw: "ne", w: "e",
};
// Which raw-shape edge moves for a given drag handle, per axis (undefined = that axis doesn't scale)
const MOVING_X: Partial<Record<HandleId, "min" | "max">> = { nw: "min", w: "min", sw: "min", ne: "max", e: "max", se: "max" };
const MOVING_Y: Partial<Record<HandleId, "min" | "max">> = { nw: "min", n: "min", ne: "min", sw: "max", s: "max", se: "max" };
const CURSOR_FOR_HANDLE: Record<HandleId, string> = {
  nw: "nwse-resize", se: "nwse-resize",
  ne: "nesw-resize", sw: "nesw-resize",
  n: "ns-resize", s: "ns-resize",
  e: "ew-resize", w: "ew-resize",
};

// Shape kinds that carry a stroke/text `color` field
const COLORABLE_TYPES = new Set<Shape["type"]>(["rect", "ellipse", "diamond", "arrow", "line", "pencil", "highlighter", "text"]);
// Closed shapes that can be filled with a background color
const FILLABLE_TYPES = new Set<Shape["type"]>(["rect", "ellipse", "diamond"]);
// Shapes with an adjustable stroke/border width
const STROKE_WIDTH_TYPES = new Set<Shape["type"]>(["rect", "ellipse", "diamond", "arrow", "line", "pencil"]);

const genId = () => Math.random().toString(36).slice(2, 10);

export class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  existingShapes: Shape[];
  private roomId: string;
  private socket: WebSocket;

  // Drawing state
  private clicked = false;
  private startX = 0;
  private startY = 0;
  private currentPencilPoints: { x: number; y: number }[] = [];

  // Eraser: accumulate erased shape ids during a drag, flush on mouseUp
  private pendingErasedIds: Set<string> = new Set();
  private pendingErasedShapes: Shape[] = [];

  // Selection / move / resize state (select tool)
  private selectedIds: Set<string> = new Set();
  private dragKind: "none" | "marquee" | "move" | "resize" = "none";
  private marqueeStart: { x: number; y: number } | null = null;
  private marqueeCurrent: { x: number; y: number } | null = null;
  private dragLastPoint: { x: number; y: number } | null = null;
  private moveSnapshots: Shape[] = [];
  private resizeHandle: HandleId | null = null;
  private resizeShapeId: string | null = null;
  private resizeOriginalShape: Shape | null = null;
  private resizeOriginalBounds: Bounds | null = null;

  // Undo history: each entry is an added shape id, a set of erased shapes, or pre-mutation snapshots
  private history: Array<
    | { type: "add"; shapeId: string }
    | { type: "erase"; shapes: Shape[] }
    | { type: "update"; before: Shape[] }
  > = [];

  // Zoom / pan
  private zoom = 1;
  private panX = 0;
  private panY = 0;
  private isPanning = false;
  private panStartX = 0;
  private panStartY = 0;

  // Device pixel ratio scaling — keeps strokes/text crisp on high-DPI screens
  private dpr = 1;
  private logicalWidth = 0;
  private logicalHeight = 0;

  selectedTool: Tool = "rect";

  // Style state applied to newly-created shapes
  private currentColor: string | null = null; // null = follow theme default
  private currentFillColor: string | null = null; // null = transparent
  private currentStrokeWidth = 2;
  private currentFontSize = 20;
  private canvasColor: string | null = null; // null = follow theme default background
  private imageCache: Map<string, HTMLImageElement> = new Map();

  private onTextRequest?: (sx: number, sy: number, cx: number, cy: number) => void;
  private onZoomChange?: (zoom: number) => void;
  private onVideoOpen?: (shape: VideoShape) => void;
  private onSelectionChange?: (info: SelectionInfo) => void;

  constructor(
    canvas: HTMLCanvasElement,
    roomId: string,
    socket: WebSocket,
    onTextRequest?: (sx: number, sy: number, cx: number, cy: number) => void,
    onZoomChange?: (zoom: number) => void,
    onVideoOpen?: (shape: VideoShape) => void,
    onSelectionChange?: (info: SelectionInfo) => void
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.existingShapes = [];
    this.socket = socket;
    this.roomId = roomId;
    this.onTextRequest = onTextRequest;
    this.onZoomChange = onZoomChange;
    this.onVideoOpen = onVideoOpen;
    this.onSelectionChange = onSelectionChange;
    this.resize(window.innerWidth, window.innerHeight);
    this.init();
    this.initSocketHandler();
    this.initMouseHandlers();
    this.canvas.addEventListener("wheel", this.wheelHandler, { passive: false });
  }

  // ── Theme ──────────────────────────────────────────────────────────────────
  private get isDark() { return document.documentElement.classList.contains("dark"); }
  private get bgColor() { return this.canvasColor ?? (this.isDark ? "#1e1e2e" : "#f8f9fa"); }
  // Default draw/text color adapts to whatever background is active (theme or custom)
  // so it never disappears against a light background picked while the site is dark, or vice versa.
  private get bgIsLight() {
    const [r, g, b] = hexToRgb(this.bgColor);
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return luminance > 0.5;
  }
  private get strokeColor() { return this.bgIsLight ? "rgba(20,20,20,0.88)" : "rgba(255,255,255,0.88)"; }

  // ── Coordinates ───────────────────────────────────────────────────────────
  private toCanvas(clientX: number, clientY: number) {
    const r = this.canvas.getBoundingClientRect();
    return {
      x: (clientX - r.left - this.panX) / this.zoom,
      y: (clientY - r.top  - this.panY) / this.zoom,
    };
  }

  // ── Public API ────────────────────────────────────────────────────────────
  setTool(tool: Tool) {
    if (tool !== "select") this.clearSelection();
    this.selectedTool = tool;
    this.canvas.style.cursor =
      tool === "hand"   ? "grab"       :
      tool === "select" ? "default"    :
      tool === "eraser" ? "cell"       :
      tool === "text"   ? "text"       :
      "crosshair";
  }

  // Resizes the backing canvas to match devicePixelRatio so strokes/text render crisp
  // on high-DPI screens instead of being upscaled from a lower-resolution buffer.
  resize(cssWidth: number, cssHeight: number) {
    this.dpr = window.devicePixelRatio || 1;
    this.logicalWidth = cssWidth;
    this.logicalHeight = cssHeight;
    this.canvas.width  = Math.max(1, Math.round(cssWidth * this.dpr));
    this.canvas.height = Math.max(1, Math.round(cssHeight * this.dpr));
    this.clearCanvas();
  }

  addShape(shape: Shape) {
    if (!shape.id) (shape as Shape & { id: string }).id = genId();
    this.existingShapes.push(shape);
    this.history.push({ type: "add", shapeId: shape.id! });
    // Auto-select what you just drew so style-panel tweaks (stroke width, color, fill…)
    // apply to it immediately, without switching to the select tool first. Stays selected
    // until you switch tools or draw the next shape (which takes over the selection).
    this.selectedIds = new Set([shape.id!]);
    this.emitSelectionChange();
    this.clearCanvas();
    this.broadcastShapeUpdate(shape);
  }

  undo() {
    if (this.history.length === 0) return;
    const last = this.history.pop()!;

    if (last.type === "add") {
      this.existingShapes = this.existingShapes.filter((s) => s.id !== last.shapeId);
      this.socket.send(JSON.stringify({
        type: "chat",
        roomId: Number(this.roomId),
        message: JSON.stringify({ erase: [last.shapeId] }),
      }));
    } else if (last.type === "erase") {
      last.shapes.forEach((s) => this.existingShapes.push(s));
      last.shapes.forEach((s) => this.broadcastShapeUpdate(s));
    } else if (last.type === "update") {
      last.before.forEach((prevShape) => {
        const idx = this.existingShapes.findIndex((s) => s.id === prevShape.id);
        if (idx >= 0) this.existingShapes[idx] = prevShape;
        else this.existingShapes.push(prevShape);
        this.broadcastShapeUpdate(prevShape);
      });
    }

    this.pruneSelection();
    this.clearCanvas();
  }

  getZoom() { return this.zoom; }
  zoomIn()  { this.applyZoom(this.zoom * 1.2); }
  zoomOut() { this.applyZoom(this.zoom / 1.2); }
  resetView() {
    this.zoom = 1; this.panX = 0; this.panY = 0;
    this.clearCanvas();
    this.onZoomChange?.(1);
  }

  // ── Style controls ──────────────────────────────────────────────────────
  // Applies a mutation to every currently-selected shape of an allowed type — used so
  // picking a style (color/fill/width/font size) affects an active selection immediately,
  // not just shapes drawn afterward. Pushes one undo entry and broadcasts each change.
  private applyStyleToSelection(allowedTypes: Set<Shape["type"]>, mutate: (s: Shape) => void) {
    if (this.selectedIds.size === 0) return;
    const before: Shape[] = [];
    this.existingShapes.forEach((s) => {
      if (s.id && this.selectedIds.has(s.id) && allowedTypes.has(s.type)) {
        before.push(structuredClone(s));
        mutate(s);
      }
    });
    if (before.length === 0) return;
    this.history.push({ type: "update", before });
    before.forEach((snap) => {
      const cur = this.existingShapes.find((s) => s.id === snap.id);
      if (cur) this.broadcastShapeUpdate(cur);
    });
    this.clearCanvas();
  }

  setColor(color: string | null) {
    this.currentColor = color;
    this.applyStyleToSelection(COLORABLE_TYPES, (s) => { (s as Shape & { color?: string }).color = color ?? undefined; });
  }
  getColor() { return this.currentColor; }

  setFillColor(color: string | null) {
    this.currentFillColor = color;
    this.applyStyleToSelection(FILLABLE_TYPES, (s) => { (s as Shape & { fillColor?: string }).fillColor = color ?? undefined; });
  }
  getFillColor() { return this.currentFillColor; }

  setStrokeWidth(width: number) {
    this.currentStrokeWidth = Math.min(20, Math.max(1, width));
    const w = this.currentStrokeWidth;
    this.applyStyleToSelection(STROKE_WIDTH_TYPES, (s) => { (s as Shape & { strokeWidth?: number }).strokeWidth = w; });
  }
  getStrokeWidth() { return this.currentStrokeWidth; }

  setFontSize(size: number) {
    this.currentFontSize = Math.min(96, Math.max(10, size));
    const fs = this.currentFontSize;
    this.applyStyleToSelection(new Set<Shape["type"]>(["text"]), (s) => { (s as Extract<Shape, { type: "text" }>).fontSize = fs; });
  }
  increaseFontSize() { this.setFontSize(this.currentFontSize + 4); }
  decreaseFontSize() { this.setFontSize(this.currentFontSize - 4); }
  getFontSize() { return this.currentFontSize; }

  setCanvasColor(color: string | null) { this.canvasColor = color; this.clearCanvas(); }
  getCanvasColor() { return this.canvasColor; }

  // ── Selection ─────────────────────────────────────────────────────────────
  getSelectedCount() { return this.selectedIds.size; }

  private emitSelectionChange() {
    if (!this.onSelectionChange) return;
    const shapes = this.existingShapes.filter((s) => s.id && this.selectedIds.has(s.id));
    this.onSelectionChange({
      count: this.selectedIds.size,
      hasFillable: shapes.some((s) => FILLABLE_TYPES.has(s.type)),
      hasStrokable: shapes.some((s) => STROKE_WIDTH_TYPES.has(s.type)),
      hasText: shapes.some((s) => s.type === "text"),
      allLocked: shapes.length > 0 && shapes.every((s) => s.locked),
    });
  }

  clearSelection() {
    if (this.selectedIds.size === 0 && this.dragKind === "none") return;
    this.selectedIds.clear();
    this.dragKind = "none";
    this.emitSelectionChange();
    this.clearCanvas();
  }

  deleteSelected() {
    if (this.selectedIds.size === 0) return;
    const removed = this.existingShapes.filter((s) => s.id && this.selectedIds.has(s.id));
    if (removed.length === 0) return;
    const ids = removed.map((s) => s.id!);
    this.existingShapes = this.existingShapes.filter((s) => !(s.id && this.selectedIds.has(s.id)));
    this.history.push({ type: "erase", shapes: removed });
    this.selectedIds.clear();
    this.emitSelectionChange();
    this.clearCanvas();
    this.socket.send(JSON.stringify({
      type: "chat",
      roomId: Number(this.roomId),
      message: JSON.stringify({ erase: ids }),
    }));
  }

  // Toggles lock on the current selection — a locked shape can still be selected/recolored
  // but can't be moved or resized. Toggling a mixed selection locks everything.
  toggleLockSelected() {
    if (this.selectedIds.size === 0) return;
    const shapes = this.existingShapes.filter((s) => s.id && this.selectedIds.has(s.id));
    if (shapes.length === 0) return;
    const shouldLock = !shapes.every((s) => s.locked);
    const before: Shape[] = [];
    shapes.forEach((s) => { before.push(structuredClone(s)); s.locked = shouldLock; });
    this.history.push({ type: "update", before });
    before.forEach((snap) => {
      const cur = this.existingShapes.find((s) => s.id === snap.id);
      if (cur) this.broadcastShapeUpdate(cur);
    });
    this.emitSelectionChange();
    this.clearCanvas();
  }

  private pruneSelection() {
    const existingIds = new Set(this.existingShapes.map((s) => s.id).filter(Boolean));
    let changed = false;
    this.selectedIds.forEach((id) => {
      if (!existingIds.has(id)) { this.selectedIds.delete(id); changed = true; }
    });
    if (changed) this.emitSelectionChange();
  }

  // Canvas-space point at the center of the current viewport (accounts for pan/zoom)
  getViewportCenter() {
    const rect = this.canvas.getBoundingClientRect();
    return this.toCanvas(rect.left + rect.width / 2, rect.top + rect.height / 2);
  }

  private applyZoom(z: number) {
    this.zoom = Math.min(Math.max(0.05, z), 20);
    this.clearCanvas();
    this.onZoomChange?.(this.zoom);
  }

  private broadcastShapeUpdate(shape: Shape) {
    this.socket.send(JSON.stringify({
      type: "chat",
      roomId: Number(this.roomId),
      message: JSON.stringify({ shape }),
    }));
  }

  destory() {
    this.canvas.removeEventListener("mousedown",  this.mouseDownHandler);
    this.canvas.removeEventListener("mouseup",    this.mouseUpHandler);
    this.canvas.removeEventListener("mousemove",  this.mouseMoveHandler);
    this.canvas.removeEventListener("dblclick",   this.dblClickHandler);
    this.canvas.removeEventListener("wheel",      this.wheelHandler);
    this.socket.removeEventListener("message",    this.socketMsgHandler);
  }

  // ── Rendering ─────────────────────────────────────────────────────────────
  clearCanvas() {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = this.bgColor;
    ctx.fillRect(0, 0, this.logicalWidth, this.logicalHeight);
    this.drawGrid();
    ctx.setTransform(this.zoom * this.dpr, 0, 0, this.zoom * this.dpr, this.panX * this.dpr, this.panY * this.dpr);
    ctx.strokeStyle = this.strokeColor;
    ctx.fillStyle   = this.strokeColor;
    ctx.lineWidth   = 2;
    ctx.lineCap     = "round";
    ctx.lineJoin    = "round";
    this.existingShapes.forEach((s) => this.drawShape(s));
    this.drawSelectionOverlay();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  private drawGrid() {
    const ctx = this.ctx;
    const dotColor = this.bgIsLight ? "rgba(0,0,0,0.07)" : "rgba(255,255,255,0.07)";
    const spacing  = 25 * this.zoom;
    const ox = ((this.panX % spacing) + spacing) % spacing;
    const oy = ((this.panY % spacing) + spacing) % spacing;
    const r  = Math.max(0.8, 0.8 * this.zoom);
    ctx.fillStyle = dotColor;
    for (let x = ox; x < this.logicalWidth;  x += spacing) {
      for (let y = oy; y < this.logicalHeight; y += spacing) {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private drawShape(shape: Shape) {
    const ctx = this.ctx;
    switch (shape.type) {
      case "rect":
        ctx.save();
        ctx.lineWidth = shape.strokeWidth ?? 2;
        if (shape.fillColor) { ctx.fillStyle = shape.fillColor; ctx.fillRect(shape.x, shape.y, shape.width, shape.height); }
        if (shape.color) ctx.strokeStyle = shape.color;
        ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
        ctx.restore();
        break;
      case "ellipse":
        ctx.save();
        ctx.lineWidth = shape.strokeWidth ?? 2;
        ctx.beginPath();
        ctx.ellipse(shape.centerX, shape.centerY, Math.abs(shape.rx), Math.abs(shape.ry), 0, 0, Math.PI * 2);
        if (shape.fillColor) { ctx.fillStyle = shape.fillColor; ctx.fill(); }
        if (shape.color) ctx.strokeStyle = shape.color;
        ctx.stroke();
        ctx.restore();
        break;
      case "circle": // legacy
        ctx.beginPath();
        ctx.arc(shape.centerX, shape.centerY, Math.abs(shape.radius), 0, Math.PI * 2);
        ctx.stroke();
        break;
      case "diamond": {
        ctx.save();
        ctx.lineWidth = shape.strokeWidth ?? 2;
        const cx = shape.x + shape.width  / 2;
        const cy = shape.y + shape.height / 2;
        ctx.beginPath();
        ctx.moveTo(cx,              shape.y);
        ctx.lineTo(shape.x + shape.width, cy);
        ctx.lineTo(cx,              shape.y + shape.height);
        ctx.lineTo(shape.x,        cy);
        ctx.closePath();
        if (shape.fillColor) { ctx.fillStyle = shape.fillColor; ctx.fill(); }
        if (shape.color) ctx.strokeStyle = shape.color;
        ctx.stroke();
        ctx.restore();
        break;
      }
      case "arrow": {
        ctx.save();
        ctx.lineWidth = shape.strokeWidth ?? 2;
        if (shape.color) ctx.strokeStyle = shape.color;
        const { startX, startY, endX, endY } = shape;
        const angle = Math.atan2(endY - startY, endX - startX);
        const hl = 14;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.moveTo(endX, endY);
        ctx.lineTo(endX - hl * Math.cos(angle - Math.PI / 6), endY - hl * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(endX, endY);
        ctx.lineTo(endX - hl * Math.cos(angle + Math.PI / 6), endY - hl * Math.sin(angle + Math.PI / 6));
        ctx.stroke();
        ctx.restore();
        break;
      }
      case "line":
        ctx.save();
        ctx.lineWidth = shape.strokeWidth ?? 2;
        if (shape.color) ctx.strokeStyle = shape.color;
        ctx.beginPath();
        ctx.moveTo(shape.startX, shape.startY);
        ctx.lineTo(shape.endX,   shape.endY);
        ctx.stroke();
        ctx.restore();
        break;
      case "pencil": {
        const pts = shape.points;
        if (pts.length < 2) break;
        ctx.save();
        ctx.lineWidth = shape.strokeWidth ?? 2;
        if (shape.color) ctx.strokeStyle = shape.color;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length - 1; i++) {
          const mx = (pts[i].x + pts[i + 1].x) / 2;
          const my = (pts[i].y + pts[i + 1].y) / 2;
          ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
        }
        ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
        ctx.stroke();
        ctx.restore();
        break;
      }
      case "highlighter": {
        const pts = shape.points;
        if (pts.length < 2) break;
        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.lineWidth   = 14;
        ctx.strokeStyle = shape.color ?? "#fbbf24";
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length - 1; i++) {
          const mx = (pts[i].x + pts[i + 1].x) / 2;
          const my = (pts[i].y + pts[i + 1].y) / 2;
          ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
        }
        ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
        ctx.stroke();
        ctx.restore();
        break;
      }
      case "text":
        ctx.save();
        ctx.font      = `${shape.fontSize ?? 18}px Inter, ui-sans-serif, sans-serif`;
        ctx.fillStyle = shape.color ?? this.strokeColor;
        ctx.fillText(shape.text, shape.x, shape.y);
        ctx.restore();
        break;
      case "image": {
        const img = this.getImage(shape.url);
        ctx.save();
        if (img.complete && img.naturalWidth > 0) {
          ctx.drawImage(img, shape.x, shape.y, shape.width, shape.height);
        } else {
          ctx.fillStyle = this.bgIsLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.06)";
          ctx.fillRect(shape.x, shape.y, shape.width, shape.height);
          ctx.strokeStyle = this.strokeColor;
          ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
          ctx.fillStyle = this.strokeColor;
          ctx.font = "13px Inter, ui-sans-serif, sans-serif";
          ctx.fillText("Loading image…", shape.x + 10, shape.y + shape.height / 2);
        }
        ctx.restore();
        break;
      }
      case "video": {
        const poster = shape.poster ? this.getImage(shape.poster) : null;
        ctx.save();
        if (poster && poster.complete && poster.naturalWidth > 0) {
          ctx.drawImage(poster, shape.x, shape.y, shape.width, shape.height);
          ctx.fillStyle = "rgba(0,0,0,0.35)";
          ctx.fillRect(shape.x, shape.y, shape.width, shape.height);
        } else {
          ctx.fillStyle = "#111827";
          ctx.fillRect(shape.x, shape.y, shape.width, shape.height);
        }
        ctx.strokeStyle = this.strokeColor;
        ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);

        const cx = shape.x + shape.width / 2;
        const cy = shape.y + shape.height / 2;
        const r  = Math.min(shape.width, shape.height) * 0.15;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(cx - r * 0.35, cy - r * 0.5);
        ctx.lineTo(cx - r * 0.35, cy + r * 0.5);
        ctx.lineTo(cx + r * 0.55, cy);
        ctx.closePath();
        ctx.fillStyle = "#111827";
        ctx.fill();
        ctx.restore();
        break;
      }
    }
  }

  // ── Selection overlay (marquee box, selection outline, resize handles) ─────
  private drawSelectionOverlay() {
    const ctx = this.ctx;

    // Marquee-drag box only ever exists while the select tool is active.
    if (this.selectedTool === "select" && this.dragKind === "marquee" && this.marqueeStart && this.marqueeCurrent) {
      const x = Math.min(this.marqueeStart.x, this.marqueeCurrent.x);
      const y = Math.min(this.marqueeStart.y, this.marqueeCurrent.y);
      const w = Math.abs(this.marqueeCurrent.x - this.marqueeStart.x);
      const h = Math.abs(this.marqueeCurrent.y - this.marqueeStart.y);
      ctx.save();
      ctx.fillStyle = "rgba(124,58,237,0.08)";
      ctx.strokeStyle = "#7c3aed";
      ctx.lineWidth = 1 / this.zoom;
      ctx.setLineDash([4 / this.zoom, 4 / this.zoom]);
      ctx.fillRect(x, y, w, h);
      ctx.strokeRect(x, y, w, h);
      ctx.restore();
    }

    // The selection outline itself renders regardless of active tool — a shape you
    // just drew stays visibly selected while you tweak its style, even before
    // switching to the select tool.
    if (this.selectedIds.size === 0) return;
    const selectedShapes = this.existingShapes.filter((s) => s.id && this.selectedIds.has(s.id));
    if (selectedShapes.length === 0) return;
    const isLocked = selectedShapes.every((s) => s.locked);

    const bounds = this.getPaddedBounds(selectedShapes);
    ctx.save();
    ctx.strokeStyle = isLocked ? "#9ca3af" : "#7c3aed";
    ctx.lineWidth = 1.5 / this.zoom;
    ctx.setLineDash([5 / this.zoom, 4 / this.zoom]);
    ctx.strokeRect(bounds.minX, bounds.minY, bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
    ctx.restore();

    if (selectedShapes.length === 1 && !isLocked) {
      const handles = this.getHandlePositions(bounds);
      const hs = 8 / this.zoom;
      ctx.save();
      ctx.setLineDash([]);
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#7c3aed";
      ctx.lineWidth = 1.5 / this.zoom;
      (Object.keys(handles) as HandleId[]).forEach((id) => {
        const { x, y } = handles[id];
        ctx.fillRect(x - hs / 2, y - hs / 2, hs, hs);
        ctx.strokeRect(x - hs / 2, y - hs / 2, hs, hs);
      });
      ctx.restore();
    }
  }

  // ── Shape geometry helpers (selection / move / resize) ──────────────────────
  private getBounds(shape: Shape): Bounds {
    switch (shape.type) {
      case "rect":
      case "diamond":
      case "image":
      case "video":
        return { minX: shape.x, minY: shape.y, maxX: shape.x + shape.width, maxY: shape.y + shape.height };
      case "ellipse":
        return { minX: shape.centerX - shape.rx, minY: shape.centerY - shape.ry, maxX: shape.centerX + shape.rx, maxY: shape.centerY + shape.ry };
      case "circle":
        return { minX: shape.centerX - shape.radius, minY: shape.centerY - shape.radius, maxX: shape.centerX + shape.radius, maxY: shape.centerY + shape.radius };
      case "arrow":
      case "line":
        return { minX: Math.min(shape.startX, shape.endX), minY: Math.min(shape.startY, shape.endY), maxX: Math.max(shape.startX, shape.endX), maxY: Math.max(shape.startY, shape.endY) };
      case "pencil":
      case "highlighter": {
        const xs = shape.points.map((p) => p.x);
        const ys = shape.points.map((p) => p.y);
        return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
      }
      case "text": {
        const fontSize = shape.fontSize ?? 18;
        this.ctx.save();
        this.ctx.font = `${fontSize}px Inter, ui-sans-serif, sans-serif`;
        const width = this.ctx.measureText(shape.text).width;
        this.ctx.restore();
        return { minX: shape.x, minY: shape.y - fontSize, maxX: shape.x + width, maxY: shape.y + fontSize * 0.3 };
      }
    }
  }

  private getPaddedBounds(shapes: Shape[], padPx = 6): Bounds {
    let combined: Bounds | null = null;
    shapes.forEach((s) => {
      const b = this.getBounds(s);
      combined = combined
        ? { minX: Math.min(combined.minX, b.minX), minY: Math.min(combined.minY, b.minY), maxX: Math.max(combined.maxX, b.maxX), maxY: Math.max(combined.maxY, b.maxY) }
        : b;
    });
    if (!combined) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    const pad = padPx / this.zoom;
    const c = combined as Bounds;
    return { minX: c.minX - pad, minY: c.minY - pad, maxX: c.maxX + pad, maxY: c.maxY + pad };
  }

  private getHandlePositions(bounds: Bounds): Record<HandleId, { x: number; y: number }> {
    const { minX, minY, maxX, maxY } = bounds;
    const midX = (minX + maxX) / 2, midY = (minY + maxY) / 2;
    return {
      nw: { x: minX, y: minY }, n: { x: midX, y: minY }, ne: { x: maxX, y: minY },
      e:  { x: maxX, y: midY }, se: { x: maxX, y: maxY }, s: { x: midX, y: maxY },
      sw: { x: minX, y: maxY }, w: { x: minX, y: midY },
    };
  }

  private hitTestHandle(bounds: Bounds, point: { x: number; y: number }): HandleId | null {
    const handles = this.getHandlePositions(bounds);
    const hs = 10 / this.zoom;
    for (const id of Object.keys(handles) as HandleId[]) {
      const h = handles[id];
      if (Math.abs(point.x - h.x) <= hs && Math.abs(point.y - h.y) <= hs) return id;
    }
    return null;
  }

  private getResizeAnchor(bounds: Bounds, handle: HandleId) {
    return this.getHandlePositions(bounds)[OPPOSITE_HANDLE[handle]];
  }

  private translateShape(shape: Shape, dx: number, dy: number) {
    if (shape.locked) return;
    switch (shape.type) {
      case "rect":
      case "diamond":
      case "image":
      case "video":
      case "text":
        shape.x += dx; shape.y += dy;
        break;
      case "ellipse":
      case "circle":
        shape.centerX += dx; shape.centerY += dy;
        break;
      case "arrow":
      case "line":
        shape.startX += dx; shape.startY += dy;
        shape.endX += dx; shape.endY += dy;
        break;
      case "pencil":
      case "highlighter":
        shape.points = shape.points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
        break;
    }
  }

  private scaleShapeFromAnchor(shape: Shape, anchorX: number, anchorY: number, scaleX: number, scaleY: number) {
    if (shape.locked) return;
    const sx = (x: number) => anchorX + (x - anchorX) * scaleX;
    const sy = (y: number) => anchorY + (y - anchorY) * scaleY;
    switch (shape.type) {
      case "rect":
      case "diamond":
      case "image":
      case "video": {
        const x1 = sx(shape.x), y1 = sy(shape.y);
        const x2 = sx(shape.x + shape.width), y2 = sy(shape.y + shape.height);
        shape.x = Math.min(x1, x2); shape.y = Math.min(y1, y2);
        shape.width  = Math.max(4, Math.abs(x2 - x1));
        shape.height = Math.max(4, Math.abs(y2 - y1));
        break;
      }
      case "ellipse": {
        const x1 = sx(shape.centerX - shape.rx), x2 = sx(shape.centerX + shape.rx);
        const y1 = sy(shape.centerY - shape.ry), y2 = sy(shape.centerY + shape.ry);
        shape.centerX = (x1 + x2) / 2; shape.centerY = (y1 + y2) / 2;
        shape.rx = Math.max(2, Math.abs(x2 - x1) / 2);
        shape.ry = Math.max(2, Math.abs(y2 - y1) / 2);
        break;
      }
      case "circle": {
        const scale = (Math.abs(scaleX) + Math.abs(scaleY)) / 2;
        shape.centerX = sx(shape.centerX); shape.centerY = sy(shape.centerY);
        shape.radius = Math.max(2, Math.abs(shape.radius * scale));
        break;
      }
      case "arrow":
      case "line":
        shape.startX = sx(shape.startX); shape.startY = sy(shape.startY);
        shape.endX = sx(shape.endX); shape.endY = sy(shape.endY);
        break;
      case "pencil":
      case "highlighter":
        shape.points = shape.points.map((p) => ({ x: sx(p.x), y: sy(p.y) }));
        break;
      case "text": {
        const avgScale = (Math.abs(scaleX) + Math.abs(scaleY)) / 2;
        shape.x = sx(shape.x); shape.y = sy(shape.y);
        shape.fontSize = Math.max(8, Math.round((shape.fontSize ?? 18) * avgScale));
        break;
      }
    }
  }

  private updateSelectCursor(c: { x: number; y: number }) {
    if (this.selectedIds.size === 1) {
      const selected = this.existingShapes.find((s) => s.id && this.selectedIds.has(s.id));
      if (selected) {
        const bounds = this.getPaddedBounds([selected]);
        const handle = this.hitTestHandle(bounds, c);
        if (handle) { this.canvas.style.cursor = CURSOR_FOR_HANDLE[handle]; return; }
        if (c.x >= bounds.minX && c.x <= bounds.maxX && c.y >= bounds.minY && c.y <= bounds.maxY) {
          this.canvas.style.cursor = "move"; return;
        }
      }
    } else if (this.selectedIds.size > 1) {
      const shapes = this.existingShapes.filter((s) => s.id && this.selectedIds.has(s.id));
      const bounds = this.getPaddedBounds(shapes);
      if (c.x >= bounds.minX && c.x <= bounds.maxX && c.y >= bounds.minY && c.y <= bounds.maxY) {
        this.canvas.style.cursor = "move"; return;
      }
    }
    this.canvas.style.cursor = "default";
  }

  // Lazily loads (and caches) an image; redraws once it arrives.
  private getImage(url: string): HTMLImageElement {
    let img = this.imageCache.get(url);
    if (!img) {
      img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => this.clearCanvas();
      img.src = url;
      this.imageCache.set(url, img);
    }
    return img;
  }

  private withZoom(fn: () => void) {
    const ctx = this.ctx;
    ctx.setTransform(this.zoom * this.dpr, 0, 0, this.zoom * this.dpr, this.panX * this.dpr, this.panY * this.dpr);
    ctx.strokeStyle = this.currentColor ?? this.strokeColor;
    ctx.fillStyle   = this.currentColor ?? this.strokeColor;
    ctx.lineWidth   = this.currentStrokeWidth;
    ctx.lineCap     = "round";
    ctx.lineJoin    = "round";
    fn();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  async init() {
    this.existingShapes = await getExistingShape(this.roomId);
    this.clearCanvas();
  }

  // ── Socket ────────────────────────────────────────────────────────────────
  private socketMsgHandler = (event: MessageEvent) => {
    const msg = JSON.parse(event.data);
    if (msg.type !== "chat") return;

    let data: { shape?: Shape; erase?: string[] };
    try { data = JSON.parse(msg.message); } catch { return; }

    if (data.shape) {
      const incoming = data.shape;
      const idx = this.existingShapes.findIndex((s) => s.id === incoming.id);
      if (idx >= 0) this.existingShapes[idx] = incoming;
      else this.existingShapes.push(incoming);
      this.clearCanvas();
    } else if (data.erase && Array.isArray(data.erase)) {
      const ids = new Set(data.erase as string[]);
      this.existingShapes = this.existingShapes.filter((s) => !(s.id && ids.has(s.id)));
      this.pruneSelection();
      this.clearCanvas();
    }
  };

  initSocketHandler() {
    this.socket.addEventListener("message", this.socketMsgHandler);
  }

  // ── Mouse ─────────────────────────────────────────────────────────────────
  mouseDownHandler = (e: MouseEvent) => {
    if (e.button !== 0) return;

    if (this.selectedTool === "hand") {
      this.isPanning  = true;
      this.panStartX  = e.clientX - this.panX;
      this.panStartY  = e.clientY - this.panY;
      this.canvas.style.cursor = "grabbing";
      return;
    }

    if (this.selectedTool === "text") {
      const c = this.toCanvas(e.clientX, e.clientY);
      this.onTextRequest?.(e.clientX, e.clientY, c.x, c.y);
      return;
    }

    if (this.selectedTool === "select") {
      const c = this.toCanvas(e.clientX, e.clientY);

      // 1) Resize handle? (only offered when exactly one, unlocked shape is selected)
      if (this.selectedIds.size === 1) {
        const selected = this.existingShapes.find((s) => s.id && this.selectedIds.has(s.id));
        if (selected && !selected.locked) {
          const bounds = this.getPaddedBounds([selected]);
          const handle = this.hitTestHandle(bounds, c);
          if (handle) {
            this.dragKind = "resize";
            this.resizeHandle = handle;
            this.resizeShapeId = selected.id!;
            this.resizeOriginalShape = structuredClone(selected);
            this.resizeOriginalBounds = bounds;
            return;
          }
        }
      }

      // 2) Click inside the current selection's bounds → drag to move the group
      // (skip if every selected shape is locked — nothing there could actually move)
      if (this.selectedIds.size > 0) {
        const selectedShapes = this.existingShapes.filter((s) => s.id && this.selectedIds.has(s.id));
        const bounds = this.getPaddedBounds(selectedShapes);
        const anyMovable = selectedShapes.some((s) => !s.locked);
        if (anyMovable && c.x >= bounds.minX && c.x <= bounds.maxX && c.y >= bounds.minY && c.y <= bounds.maxY) {
          this.dragKind = "move";
          this.dragLastPoint = c;
          this.moveSnapshots = selectedShapes.map((s) => structuredClone(s));
          return;
        }
      }

      // 3) Click directly on a shape → select it (shift = add/remove from selection)
      const thr = 10 / this.zoom;
      const hit = [...this.existingShapes].reverse().find((s) => isPreciseHit(s, c.x, c.y, thr));

      if (hit) {
        if (e.shiftKey) {
          const next = new Set(this.selectedIds);
          if (hit.id) { next.has(hit.id) ? next.delete(hit.id) : next.add(hit.id); }
          this.selectedIds = next;
        } else {
          this.selectedIds = new Set(hit.id ? [hit.id] : []);
          this.dragKind = "move";
          this.dragLastPoint = c;
          this.moveSnapshots = [structuredClone(hit)];
        }
        this.emitSelectionChange();
        this.clearCanvas();
        return;
      }

      // 4) Empty space → clear (unless shift) and start a marquee selection
      if (!e.shiftKey) this.selectedIds.clear();
      this.dragKind = "marquee";
      this.marqueeStart = c;
      this.marqueeCurrent = c;
      this.emitSelectionChange();
      this.clearCanvas();
      return;
    }

    const c = this.toCanvas(e.clientX, e.clientY);
    this.startX  = c.x;
    this.startY  = c.y;
    this.clicked = true;

    if (this.selectedTool === "pencil" || this.selectedTool === "highlighter") {
      this.currentPencilPoints = [{ x: c.x, y: c.y }];
    }
    if (this.selectedTool === "eraser") {
      this.pendingErasedIds = new Set();
      this.pendingErasedShapes = [];
    }
  };

  // Videos open on double-click so a single click can select/move/resize them like any other shape.
  dblClickHandler = (e: MouseEvent) => {
    if (this.selectedTool !== "select") return;
    const c = this.toCanvas(e.clientX, e.clientY);
    const hit = [...this.existingShapes].reverse().find(
      (s): s is VideoShape =>
        s.type === "video" &&
        c.x >= s.x && c.x <= s.x + s.width &&
        c.y >= s.y && c.y <= s.y + s.height
    );
    if (hit) this.onVideoOpen?.(hit);
  };

  mouseMoveHandler = (e: MouseEvent) => {
    if (this.isPanning) {
      this.panX = e.clientX - this.panStartX;
      this.panY = e.clientY - this.panStartY;
      this.clearCanvas();
      return;
    }

    // ── Selection drags (move / resize / marquee) ──
    if (this.dragKind !== "none") {
      const c = this.toCanvas(e.clientX, e.clientY);

      if (this.dragKind === "move" && this.dragLastPoint) {
        const dx = c.x - this.dragLastPoint.x;
        const dy = c.y - this.dragLastPoint.y;
        this.selectedIds.forEach((id) => {
          const shape = this.existingShapes.find((s) => s.id === id);
          if (shape) this.translateShape(shape, dx, dy);
        });
        this.dragLastPoint = c;
        this.clearCanvas();
      } else if (
        this.dragKind === "resize" && this.resizeOriginalShape &&
        this.resizeOriginalBounds && this.resizeHandle && this.resizeShapeId
      ) {
        const target = this.existingShapes.find((s) => s.id === this.resizeShapeId);
        if (target) {
          const ob = this.resizeOriginalBounds;
          const handle = this.resizeHandle;
          const anchor = this.getResizeAnchor(ob, handle);

          let scaleX = 1;
          const mx = MOVING_X[handle];
          if (mx) {
            const originalEdge = mx === "min" ? ob.minX : ob.maxX;
            const denom = originalEdge - anchor.x;
            scaleX = denom !== 0 ? (c.x - anchor.x) / denom : 1;
          }

          let scaleY = 1;
          const my = MOVING_Y[handle];
          if (my) {
            const originalEdge = my === "min" ? ob.minY : ob.maxY;
            const denom = originalEdge - anchor.y;
            scaleY = denom !== 0 ? (c.y - anchor.y) / denom : 1;
          }

          const fresh = structuredClone(this.resizeOriginalShape);
          this.scaleShapeFromAnchor(fresh, anchor.x, anchor.y, scaleX, scaleY);
          Object.assign(target, fresh);
        }
        this.clearCanvas();
      } else if (this.dragKind === "marquee") {
        this.marqueeCurrent = c;
        this.clearCanvas();
      }
      return;
    }

    if (this.selectedTool === "select") {
      this.updateSelectCursor(this.toCanvas(e.clientX, e.clientY));
    }

    if (!this.clicked) return;

    const c = this.toCanvas(e.clientX, e.clientY);
    const w = c.x - this.startX;
    const h = c.y - this.startY;

    // ── Eraser ──
    if (this.selectedTool === "eraser") {
      const thr = 20 / this.zoom;
      const toRemove = this.existingShapes.filter((s) => isNearShape(s, c.x, c.y, thr));
      toRemove.forEach((s) => {
        if (s.id) {
          this.pendingErasedIds.add(s.id);
          this.pendingErasedShapes.push(s);
        }
      });
      if (toRemove.length > 0) {
        this.existingShapes = this.existingShapes.filter((s) => !toRemove.includes(s));
        this.clearCanvas();
      }
      return;
    }

    // ── Pencil / highlighter preview ──
    if (this.selectedTool === "pencil" || this.selectedTool === "highlighter") {
      const isHighlighter = this.selectedTool === "highlighter";
      this.currentPencilPoints.push({ x: c.x, y: c.y });
      this.clearCanvas();
      this.withZoom(() => {
        const pts = this.currentPencilPoints;
        if (pts.length < 2) return;
        if (isHighlighter) {
          this.ctx.save();
          this.ctx.globalAlpha = 0.35;
          this.ctx.lineWidth   = 14;
          this.ctx.strokeStyle = this.currentColor ?? "#fbbf24";
        }
        this.ctx.beginPath();
        this.ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) this.ctx.lineTo(pts[i].x, pts[i].y);
        this.ctx.stroke();
        if (isHighlighter) this.ctx.restore();
      });
      return;
    }

    // ── Shape previews ──
    this.clearCanvas();
    this.withZoom(() => {
      const ctx = this.ctx;
      switch (this.selectedTool) {
        case "rect": {
          const rx = Math.min(this.startX, c.x), ry = Math.min(this.startY, c.y);
          if (this.currentFillColor) { ctx.fillStyle = this.currentFillColor; ctx.fillRect(rx, ry, Math.abs(w), Math.abs(h)); }
          ctx.strokeRect(rx, ry, Math.abs(w), Math.abs(h));
          break;
        }
        case "ellipse":
          ctx.beginPath();
          ctx.ellipse(this.startX + w / 2, this.startY + h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2);
          if (this.currentFillColor) { ctx.fillStyle = this.currentFillColor; ctx.fill(); }
          ctx.stroke();
          break;
        case "diamond": {
          const dx = Math.min(this.startX, c.x), dy = Math.min(this.startY, c.y);
          const dw = Math.abs(w),                dh = Math.abs(h);
          const cx = dx + dw / 2,               cy = dy + dh / 2;
          ctx.beginPath();
          ctx.moveTo(cx, dy); ctx.lineTo(dx + dw, cy);
          ctx.lineTo(cx, dy + dh); ctx.lineTo(dx, cy);
          ctx.closePath();
          if (this.currentFillColor) { ctx.fillStyle = this.currentFillColor; ctx.fill(); }
          ctx.stroke();
          break;
        }
        case "arrow": {
          const angle = Math.atan2(c.y - this.startY, c.x - this.startX);
          const hl = 14;
          ctx.beginPath();
          ctx.moveTo(this.startX, this.startY); ctx.lineTo(c.x, c.y);
          ctx.moveTo(c.x, c.y);
          ctx.lineTo(c.x - hl * Math.cos(angle - Math.PI / 6), c.y - hl * Math.sin(angle - Math.PI / 6));
          ctx.moveTo(c.x, c.y);
          ctx.lineTo(c.x - hl * Math.cos(angle + Math.PI / 6), c.y - hl * Math.sin(angle + Math.PI / 6));
          ctx.stroke();
          break;
        }
        case "line":
          ctx.beginPath();
          ctx.moveTo(this.startX, this.startY);
          ctx.lineTo(c.x, c.y);
          ctx.stroke();
          break;
      }
    });
  };

  mouseUpHandler = (e: MouseEvent) => {
    if (this.isPanning) {
      this.isPanning = false;
      this.canvas.style.cursor = "grab";
      return;
    }

    // ── Finalize selection drags ──
    if (this.dragKind !== "none") {
      const c = this.toCanvas(e.clientX, e.clientY);

      if (this.dragKind === "move" && this.moveSnapshots.length > 0) {
        const before = this.moveSnapshots;
        const moved = before.some((snap) => {
          const cur = this.existingShapes.find((s) => s.id === snap.id);
          return cur && JSON.stringify(cur) !== JSON.stringify(snap);
        });
        if (moved) {
          this.history.push({ type: "update", before });
          before.forEach((snap) => {
            const cur = this.existingShapes.find((s) => s.id === snap.id);
            if (cur) this.broadcastShapeUpdate(cur);
          });
        }
      } else if (this.dragKind === "resize" && this.resizeOriginalShape) {
        const before = [this.resizeOriginalShape];
        const cur = this.existingShapes.find((s) => s.id === this.resizeShapeId);
        if (cur && JSON.stringify(cur) !== JSON.stringify(this.resizeOriginalShape)) {
          this.history.push({ type: "update", before });
          this.broadcastShapeUpdate(cur);
        }
      } else if (this.dragKind === "marquee" && this.marqueeStart) {
        const rectMinX = Math.min(this.marqueeStart.x, c.x);
        const rectMaxX = Math.max(this.marqueeStart.x, c.x);
        const rectMinY = Math.min(this.marqueeStart.y, c.y);
        const rectMaxY = Math.max(this.marqueeStart.y, c.y);
        const dragged = rectMaxX - rectMinX > 3 || rectMaxY - rectMinY > 3;
        if (dragged) {
          const found = this.existingShapes.filter((s) => {
            const b = this.getBounds(s);
            return b.minX <= rectMaxX && b.maxX >= rectMinX && b.minY <= rectMaxY && b.maxY >= rectMinY;
          });
          const ids = found.map((s) => s.id).filter((id): id is string => Boolean(id));
          if (e.shiftKey) ids.forEach((id) => this.selectedIds.add(id));
          else this.selectedIds = new Set(ids);
        }
      }

      this.dragKind = "none";
      this.resizeHandle = null;
      this.resizeShapeId = null;
      this.resizeOriginalShape = null;
      this.resizeOriginalBounds = null;
      this.marqueeStart = null;
      this.marqueeCurrent = null;
      this.moveSnapshots = [];
      this.emitSelectionChange();
      this.clearCanvas();
      return;
    }

    if (!this.clicked) return;
    this.clicked = false;

    const c = this.toCanvas(e.clientX, e.clientY);
    const w = c.x - this.startX;
    const h = c.y - this.startY;

    // ── Flush eraser ──
    if (this.selectedTool === "eraser") {
      if (this.pendingErasedIds.size > 0) {
        const ids = [...this.pendingErasedIds];
        this.history.push({ type: "erase", shapes: [...this.pendingErasedShapes] });
        this.pendingErasedIds = new Set();
        this.pendingErasedShapes = [];
        this.socket.send(JSON.stringify({
          type: "chat",
          roomId: Number(this.roomId),
          message: JSON.stringify({ erase: ids }),
        }));
      }
      this.clearCanvas();
      return;
    }

    let shape: Shape | null = null;
    const id = genId();

    const color = this.currentColor ?? undefined;
    const fillColor = this.currentFillColor ?? undefined;
    const strokeWidth = this.currentStrokeWidth;

    switch (this.selectedTool) {
      case "rect":
        if (Math.abs(w) > 2 || Math.abs(h) > 2)
          shape = { type: "rect", id, x: Math.min(this.startX, c.x), y: Math.min(this.startY, c.y), width: Math.abs(w), height: Math.abs(h), color, fillColor, strokeWidth };
        break;
      case "ellipse":
        if (Math.abs(w) > 2 || Math.abs(h) > 2)
          shape = { type: "ellipse", id, centerX: this.startX + w / 2, centerY: this.startY + h / 2, rx: Math.abs(w / 2), ry: Math.abs(h / 2), color, fillColor, strokeWidth };
        break;
      case "diamond":
        if (Math.abs(w) > 2 || Math.abs(h) > 2)
          shape = { type: "diamond", id, x: Math.min(this.startX, c.x), y: Math.min(this.startY, c.y), width: Math.abs(w), height: Math.abs(h), color, fillColor, strokeWidth };
        break;
      case "arrow":
        if (Math.hypot(w, h) > 5)
          shape = { type: "arrow", id, startX: this.startX, startY: this.startY, endX: c.x, endY: c.y, color, strokeWidth };
        break;
      case "line":
        if (Math.hypot(w, h) > 5)
          shape = { type: "line", id, startX: this.startX, startY: this.startY, endX: c.x, endY: c.y, color, strokeWidth };
        break;
      case "pencil":
        if (this.currentPencilPoints.length > 1)
          shape = { type: "pencil", id, points: [...this.currentPencilPoints], color, strokeWidth };
        this.currentPencilPoints = [];
        break;
      case "highlighter":
        if (this.currentPencilPoints.length > 1)
          shape = { type: "highlighter", id, points: [...this.currentPencilPoints], color };
        this.currentPencilPoints = [];
        break;
    }

    if (shape) this.addShape(shape);
    else this.clearCanvas();
  };

  wheelHandler = (e: WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const factor  = e.deltaY < 0 ? 1.1 : 0.9;
      const newZoom = Math.min(Math.max(0.05, this.zoom * factor), 20);
      const r  = this.canvas.getBoundingClientRect();
      const mx = e.clientX - r.left;
      const my = e.clientY - r.top;
      this.panX = mx - (mx - this.panX) * (newZoom / this.zoom);
      this.panY = my - (my - this.panY) * (newZoom / this.zoom);
      this.zoom = newZoom;
      this.clearCanvas();
      this.onZoomChange?.(this.zoom);
    } else {
      this.panX -= e.deltaX;
      this.panY -= e.deltaY;
      this.clearCanvas();
    }
  };

  initMouseHandlers() {
    this.canvas.addEventListener("mousedown", this.mouseDownHandler);
    this.canvas.addEventListener("mouseup",   this.mouseUpHandler);
    this.canvas.addEventListener("mousemove", this.mouseMoveHandler);
    this.canvas.addEventListener("dblclick",  this.dblClickHandler);
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const full  = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const num   = parseInt(full, 16);
  if (full.length !== 6 || Number.isNaN(num)) return [0, 0, 0];
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function isNearRectOutline(x: number, y: number, rx: number, ry: number, w: number, h: number, thr: number): boolean {
  const edges: [number, number, number, number][] = [
    [rx, ry, rx + w, ry], [rx + w, ry, rx + w, ry + h],
    [rx + w, ry + h, rx, ry + h], [rx, ry + h, rx, ry],
  ];
  return edges.some(([ax, ay, bx, by]) => segDist(x, y, ax, ay, bx, by) <= thr);
}

function isNearDiamondOutline(x: number, y: number, dx: number, dy: number, w: number, h: number, thr: number): boolean {
  const cx = dx + w / 2, cy = dy + h / 2;
  const top = { x: cx, y: dy }, right = { x: dx + w, y: cy }, bottom = { x: cx, y: dy + h }, left = { x: dx, y: cy };
  const edges = [[top, right], [right, bottom], [bottom, left], [left, top]] as const;
  return edges.some(([a, b]) => segDist(x, y, a.x, a.y, b.x, b.y) <= thr);
}

// Approximates "near the ellipse's boundary ring" (not just inside it) using the
// normalized radius — good enough for click precision, not pixel-perfect geometry.
function isNearEllipseOutline(x: number, y: number, cx: number, cy: number, rx: number, ry: number, thr: number): boolean {
  const ndx = (x - cx) / Math.max(1e-6, rx);
  const ndy = (y - cy) / Math.max(1e-6, ry);
  const normalizedDist = Math.sqrt(ndx * ndx + ndy * ndy);
  const tolerance = thr / (Math.max(1e-6, (rx + ry) / 2));
  return Math.abs(normalizedDist - 1) <= tolerance;
}

// Precise hit test used for click-to-select: unfilled closed shapes are only
// clickable near their actual outline, not anywhere in their (empty) bounding box —
// otherwise a large unfilled shape "swallows" clicks meant for a smaller shape nested inside it.
function isPreciseHit(shape: Shape, x: number, y: number, thr: number): boolean {
  switch (shape.type) {
    case "rect":
      if (shape.fillColor) return isNearShape(shape, x, y, thr);
      return isNearRectOutline(x, y, shape.x, shape.y, shape.width, shape.height, thr);
    case "diamond":
      if (shape.fillColor) return isNearShape(shape, x, y, thr);
      return isNearDiamondOutline(x, y, shape.x, shape.y, shape.width, shape.height, thr);
    case "ellipse":
      if (shape.fillColor) return isNearShape(shape, x, y, thr);
      return isNearEllipseOutline(x, y, shape.centerX, shape.centerY, shape.rx, shape.ry, thr);
    default:
      return isNearShape(shape, x, y, thr);
  }
}

function isNearShape(shape: Shape, x: number, y: number, thr: number): boolean {
  switch (shape.type) {
    case "rect":
      return x >= shape.x - thr && x <= shape.x + shape.width  + thr &&
             y >= shape.y - thr && y <= shape.y + shape.height + thr;
    case "ellipse": {
      const dx = (x - shape.centerX) / (shape.rx + thr);
      const dy = (y - shape.centerY) / (shape.ry + thr);
      return dx * dx + dy * dy <= 1;
    }
    case "circle":
      return Math.hypot(x - shape.centerX, y - shape.centerY) <= shape.radius + thr;
    case "diamond":
      return x >= shape.x - thr && x <= shape.x + shape.width  + thr &&
             y >= shape.y - thr && y <= shape.y + shape.height + thr;
    case "arrow":
    case "line":
      return segDist(x, y, shape.startX, shape.startY, shape.endX, shape.endY) <= thr;
    case "pencil":
    case "highlighter":
      return shape.points.some((p) => Math.hypot(p.x - x, p.y - y) <= thr * 2);
    case "text":
      return x >= shape.x - thr && x <= shape.x + 200 &&
             y >= shape.y - 20 - thr && y <= shape.y + thr;
    case "image":
    case "video":
      return x >= shape.x - thr && x <= shape.x + shape.width  + thr &&
             y >= shape.y - thr && y <= shape.y + shape.height + thr;
    default:
      return false;
  }
}
