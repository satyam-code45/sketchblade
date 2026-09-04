import type { Shape } from "..";
import type { Diagram, DiagramNode } from "@repo/ai";

const LABEL_SIZE = 16;
const TITLE_SIZE = 28;
const LINE_HEIGHT = 20;
const EDGE_COLOR = "#64748b";

// No canvas here so this stays pure and testable; 0.55em is close enough for
// centring that a few pixels of drift is invisible.
const textWidth = (text: string, fontSize: number) => text.length * fontSize * 0.55;

export function wrapLabel(text: string, boxWidth: number): string[] {
  const maxChars = Math.max(6, Math.floor((boxWidth - 24) / (LABEL_SIZE * 0.55)));
  const lines: string[] = [];
  let line = "";

  for (const word of text.trim().split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

// Attach to the facing edge rather than centre-to-centre, or arrows cut
// straight through their own boxes.
export function anchorPoints(from: DiagramNode, to: DiagramNode, o: { x: number; y: number }) {
  const fx = o.x + from.x, fy = o.y + from.y;
  const tx = o.x + to.x, ty = o.y + to.y;
  const fcx = fx + from.width / 2, fcy = fy + from.height / 2;
  const tcx = tx + to.width / 2, tcy = ty + to.height / 2;
  const dx = tcx - fcx, dy = tcy - fcy;

  if (Math.abs(dy) >= Math.abs(dx)) {
    return dy > 0
      ? { startX: fcx, startY: fy + from.height, endX: tcx, endY: ty }
      : { startX: fcx, startY: fy, endX: tcx, endY: ty + to.height };
  }
  return dx > 0
    ? { startX: fx + from.width, startY: fcy, endX: tx, endY: tcy }
    : { startX: fx, startY: fcy, endX: tx + to.width, endY: tcy };
}

export function compileDiagram(diagram: Diagram, origin: { x: number; y: number }): Shape[] {
  const shapes: Shape[] = [];

  if (diagram.title) {
    shapes.push({
      type: "text",
      x: origin.x,
      y: origin.y - 34,
      text: diagram.title,
      fontSize: TITLE_SIZE,
      color: "#0f172a",
    });
  }

  for (const node of diagram.elements) {
    const x = origin.x + node.x;
    const y = origin.y + node.y;
    const { width, height } = node;

    if (node.type === "ellipse") {
      // The model emits a top-left box; our ellipse is centre-based.
      shapes.push({
        type: "ellipse",
        centerX: x + width / 2,
        centerY: y + height / 2,
        rx: width / 2,
        ry: height / 2,
        color: node.stroke,
        fillColor: node.fill,
        strokeWidth: 2,
      });
    } else {
      shapes.push({
        type: node.type === "diamond" ? "diamond" : "rect",
        x, y, width, height,
        color: node.stroke,
        fillColor: node.fill,
        strokeWidth: 2,
      });
    }

    // One text shape per line: the renderer uses a single fillText, so it has
    // no newline handling and no textAlign.
    const lines = wrapLabel(node.label, width);
    const blockTop = y + (height - lines.length * LINE_HEIGHT) / 2 + LABEL_SIZE;
    lines.forEach((line, i) => {
      shapes.push({
        type: "text",
        x: x + (width - textWidth(line, LABEL_SIZE)) / 2,
        y: blockTop + i * LINE_HEIGHT,
        text: line,
        fontSize: LABEL_SIZE,
        color: node.stroke,
      });
    });
  }

  const byId = new Map(diagram.elements.map((n) => [n.id, n]));
  for (const edge of diagram.connections) {
    const from = byId.get(edge.from);
    const to = byId.get(edge.to);
    if (!from || !to) continue;

    const p = anchorPoints(from, to, origin);
    shapes.push({
      type: "arrow",
      startX: p.startX, startY: p.startY,
      endX: p.endX, endY: p.endY,
      color: EDGE_COLOR,
      strokeWidth: 2,
    });

    if (edge.label) {
      shapes.push({
        type: "text",
        x: (p.startX + p.endX) / 2 - textWidth(edge.label, 14) / 2,
        y: (p.startY + p.endY) / 2 - 6,
        text: edge.label,
        fontSize: 14,
        color: EDGE_COLOR,
      });
    }
  }

  return shapes;
}
