import { getStroke } from "perfect-freehand";
import type { DrawingDocument, DrawingStroke, NoteContent } from "../api/types";

/** Page units: every drawing is 1000 units wide, so it scales with the window. */
export const PAGE_WIDTH = 1000;
export const MIN_PAGE_HEIGHT = 1414;
/** The page grows by this much when a stroke ends near its bottom edge. */
export const PAGE_GROWTH = 700;
/** Mouse and touch have no real pressure: they record this value and the stroke simulates it. */
export const NO_PRESSURE = 0.5;

export function toDrawing(content: NoteContent): DrawingDocument {
  const value = content as Partial<DrawingDocument>;
  return {
    schemaVersion: 1,
    type: "drawing",
    background: value.background === "blank" || value.background === "grid" ? value.background : "lines",
    height: typeof value.height === "number" ? Math.max(MIN_PAGE_HEIGHT, value.height) : MIN_PAGE_HEIGHT,
    strokes: Array.isArray(value.strokes) ? value.strokes : [],
  };
}

const paths = new WeakMap<DrawingStroke, Path2D>();

/** Filled outline of a stroke (perfect-freehand), cached per stroke object. */
export function strokePath(stroke: DrawingStroke, last = true): Path2D {
  const cached = last ? paths.get(stroke) : undefined;
  if (cached) return cached;
  const outline = getStroke(stroke.points, {
    size: stroke.size,
    thinning: stroke.tool === "pen" ? 0.6 : 0,
    smoothing: 0.5,
    streamline: 0.45,
    simulatePressure: stroke.points.every((point) => point[2] === NO_PRESSURE),
    start: { cap: true },
    end: { cap: true },
    last,
  });
  const path = new Path2D();
  if (outline.length > 0) {
    path.moveTo(outline[0]![0], outline[0]![1]);
    for (let index = 1; index < outline.length; index += 1) {
      const [x0, y0] = outline[index]!;
      const [x1, y1] = outline[(index + 1) % outline.length]!;
      path.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
    }
    path.closePath();
  }
  if (last) paths.set(stroke, path);
  return path;
}

export function paintStroke(context: CanvasRenderingContext2D, stroke: DrawingStroke, ink: string, last = true) {
  context.globalAlpha = stroke.tool === "highlighter" ? 0.35 : 1;
  context.fillStyle = stroke.color ?? ink;
  context.fill(strokePath(stroke, last));
}

/** Clears the canvas and paints the strokes in page units. */
export function paintStrokes(canvas: HTMLCanvasElement, strokes: DrawingStroke[], scale: number, ink: string) {
  const context = canvas.getContext("2d");
  if (!context) return;
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, canvas.width, canvas.height);
  const ratio = canvas.width / (PAGE_WIDTH * scale || 1);
  context.setTransform(scale * ratio, 0, 0, scale * ratio, 0, 0);
  // Highlighter first, so ink always stays on top of it.
  for (const stroke of strokes) if (stroke.tool === "highlighter") paintStroke(context, stroke, ink);
  for (const stroke of strokes) if (stroke.tool !== "highlighter") paintStroke(context, stroke, ink);
  context.globalAlpha = 1;
}

/** Stroke eraser: true when (x, y) is within `radius` of the stroke's centre line. */
export function hitsStroke(stroke: DrawingStroke, x: number, y: number, radius: number): boolean {
  const reach = radius + stroke.size / 2;
  const points = stroke.points;
  if (points.length === 1) return Math.hypot(points[0]![0] - x, points[0]![1] - y) <= reach;
  for (let index = 1; index < points.length; index += 1) {
    const [ax, ay] = points[index - 1]!;
    const [bx, by] = points[index]!;
    const dx = bx - ax;
    const dy = by - ay;
    const length = dx * dx + dy * dy;
    const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / length));
    if (Math.hypot(ax + t * dx - x, ay + t * dy - y) <= reach) return true;
  }
  return false;
}
