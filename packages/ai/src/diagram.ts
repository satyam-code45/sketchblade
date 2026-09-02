import { z } from "zod";

// Every field required and no optionals: OpenAI strict mode rejects open-ended
// schemas, so defaults are applied in clamp() instead.
export const NodeSchema = z.object({
  id: z.string(),
  type: z.enum(["rectangle", "diamond", "ellipse"]),
  label: z.string(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});

export const ConnectionSchema = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string(),
  label: z.string(),
});

export const DiagramSchema = z.object({
  title: z.string(),
  elements: z.array(NodeSchema),
  connections: z.array(ConnectionSchema),
});

export type DiagramNode = z.infer<typeof NodeSchema> & { stroke: string; fill: string };
export type DiagramConnection = z.infer<typeof ConnectionSchema>;
export type Diagram = { title: string; elements: DiagramNode[]; connections: DiagramConnection[] };

const PALETTE = [
  { stroke: "#2563eb", fill: "#dbeafe" },
  { stroke: "#16a34a", fill: "#dcfce7" },
  { stroke: "#7c3aed", fill: "#ede9fe" },
  { stroke: "#ea580c", fill: "#ffedd5" },
  { stroke: "#0891b2", fill: "#cffafe" },
  { stroke: "#be123c", fill: "#ffe4e6" },
  { stroke: "#475569", fill: "#f1f5f9" },
];

const MAX_NODES = 12;
const clampNum = (v: unknown, lo: number, hi: number, fallback: number) =>
  Number.isFinite(Number(v)) ? Math.min(hi, Math.max(lo, Number(v))) : fallback;

const slug = (v: string, fallback: string) =>
  v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || fallback;

// The trust boundary around a non-deterministic component: a hallucinating
// model must not be able to put nonsense on someone's canvas.
export function clamp(raw: z.infer<typeof DiagramSchema>): Diagram {
  const elements = raw.elements.slice(0, MAX_NODES).map((n, i) => {
    const palette = PALETTE[i % PALETTE.length]!;
    return {
      id: slug(n.id, `node-${i + 1}`),
      type: n.type,
      label: n.label.replace(/\s+/g, " ").trim().slice(0, 56) || `Step ${i + 1}`,
      x: clampNum(n.x, -5000, 5000, (i % 3) * 300),
      y: clampNum(n.y, -5000, 5000, Math.floor(i / 3) * 170),
      width: clampNum(n.width, 180, 300, 240),
      height: clampNum(n.height, 80, 150, 96),
      stroke: palette.stroke,
      fill: palette.fill,
    };
  });

  const ids = new Set(elements.map((e) => e.id));
  const connections = raw.connections
    .map((c, i) => ({
      id: slug(c.id, `edge-${i + 1}`),
      from: slug(c.from, ""),
      to: slug(c.to, ""),
      label: c.label.replace(/\s+/g, " ").trim().slice(0, 32),
    }))
    // Models routinely invent edges to nodes they never emitted.
    .filter((c) => ids.has(c.from) && ids.has(c.to) && c.from !== c.to);

  return { title: raw.title.trim().slice(0, 80) || "Diagram", elements, connections };
}

const QUALITY = `
Quality rules:
- Produce 6 to 10 nodes unless the request is very small.
- Short labels: 2 to 6 words, no sentences.
- Connection labels only when they clarify the relationship, otherwise "".
- Lay nodes out on a clean grid with no overlap: about 300 apart horizontally, 170 vertically.
- Start near x=0, y=0. Use width 220-280 and height 80-120.
- Every connection must reference ids that exist in elements.`;

export const PRESETS = {
  diagram: {
    name: "Diagram",
    system: `You turn ideas into clear general diagrams with labelled sections and relationships.${QUALITY}`,
  },
  flowchart: {
    name: "Flowchart",
    system: `You produce flowcharts. Ellipses for start and end, rectangles for actions, diamonds for decisions. Prefer top-to-bottom flow.${QUALITY}`,
  },
  architecture: {
    name: "Architecture",
    system: `You produce software architecture diagrams covering clients, frontend, services, APIs, datastores, auth and external systems. Lay users left, services centre, data right.${QUALITY}`,
  },
  web: {
    name: "Web mockup",
    system: `You produce website wireframes as logical blocks: navigation, headers, content sections, cards, forms and actions.${QUALITY}`,
  },
  mobile: {
    name: "Mobile mockup",
    system: `You produce mobile app wireframes as logical screens and elements: navigation, inputs, cards, lists and buttons.${QUALITY}`,
  },
} as const;

export type PresetId = keyof typeof PRESETS;
