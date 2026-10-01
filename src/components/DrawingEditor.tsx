import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import { Archive, CircleAlert, Eraser, Grid3x3, Highlighter, PenLine, Redo2, RotateCcw, Rows3, Square, Trash2, Undo2 } from "lucide-react";
import { api, errorMessage } from "../api/commands";
import type { DrawingBackground, DrawingDocument, DrawingStroke, PaperColor } from "../api/types";
import { NO_PRESSURE, PAGE_GROWTH, PAGE_WIDTH, hitsStroke, paintStroke, paintStrokes, toDrawing } from "../drawing/ink";
import { ColorGrid } from "./ColorGrid";
import { ExportSelect, PaperColorMenu, ToolButton, showAnchoredPopover } from "./EditorToolbar";
import type { NoteEditorHandle, NoteEditorProps, SavedDraft } from "./NoteEditor";

type Tool = "pen" | "highlighter" | "eraser";

const SIZES: Record<Exclude<Tool, "eraser">, number[]> = { pen: [2, 4, 7, 12], highlighter: [12, 20, 30, 44] };
const BACKGROUNDS: Array<[DrawingBackground, string, typeof Square]> = [["blank", "Foglio bianco", Square], ["lines", "Foglio a righe", Rows3], ["grid", "Foglio a quadretti", Grid3x3]];
/** Distance between ruled lines / grid squares, in page units. */
const RULE = 40;
const ERASER_RADIUS = 8;
const round = (value: number) => Math.round(value * 100) / 100;

export const DrawingEditor = forwardRef<NoteEditorHandle, NoteEditorProps>(function DrawingEditor(
  { note, settings, readOnly = false, onSaved, onSaveStatus, onArchive, onTrash, onRestore, onToggleAttention, onExport, onSettingsChange },
  ref,
) {
  const [title, setTitle] = useState(note.title);
  const [paperColor, setPaperColor] = useState(note.paperColor);
  const [drawing, setDrawing] = useState(() => toDrawing(note.content));
  const [tool, setTool] = useState<Tool>("pen");
  // null = theme ink; the highlighter starts yellow so it never looks like grey ink.
  const [colors, setColors] = useState<{ pen: string | null; highlighter: string | null }>({ pen: null, highlighter: "#ffd400" });
  const [sizes, setSizes] = useState({ pen: 4, highlighter: 20 });
  const [history, setHistory] = useState<{ undo: DrawingStroke[][]; redo: DrawingStroke[][] }>({ undo: [], redo: [] });
  const [width, setWidth] = useState(0);
  const [ink, setInk] = useState("#1f1b16");

  const drawingRef = useRef(drawing);
  const titleRef = useRef(title);
  const paperColorRef = useRef(paperColor);
  const revisionRef = useRef(note.revision);
  const changeVersionRef = useRef(0);
  const savedVersionRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const queueRef = useRef(Promise.resolve(true));
  const mountedRef = useRef(true);
  const pageRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLCanvasElement>(null);
  const liveRef = useRef<HTMLCanvasElement>(null);
  const colorTrigger = useRef<HTMLButtonElement>(null);
  const colorMenu = useRef<HTMLDivElement>(null);
  const gesture = useRef<{ pointerId: number; stroke?: DrawingStroke; before: DrawingStroke[] } | null>(null);
  /** Palm rejection: once a pen is used, finger touches no longer draw. */
  const penSeen = useRef(false);
  const scale = width / PAGE_WIDTH;

  useEffect(() => () => { mountedRef.current = false; if (timerRef.current !== null) window.clearTimeout(timerRef.current); }, []);

  // Same save queue as NoteEditor: debounce, expected revision, retry after a failure, flush on demand.
  function markDirty() {
    if (readOnly) return;
    changeVersionRef.current += 1;
    onSaveStatus("dirty");
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => void enqueueSave(), 700);
  }

  function enqueueSave(): Promise<boolean> {
    if (readOnly) return Promise.resolve(true);
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    queueRef.current = queueRef.current.then(async () => {
      while (savedVersionRef.current < changeVersionRef.current) {
        const targetVersion = changeVersionRef.current;
        const snapshot: SavedDraft = {
          bulletShape: note.bulletShape,
          checkboxShape: note.checkboxShape,
          title: titleRef.current.trim() || "Senza titolo",
          subtitle: note.subtitle,
          paperColor: paperColorRef.current,
          lineSpacing: note.lineSpacing,
          paperWidth: note.paperWidth,
          content: drawingRef.current,
        };
        onSaveStatus("saving");
        try {
          const receipt = await api.saveNote({ id: note.id, ...snapshot, expectedRevision: revisionRef.current });
          revisionRef.current = receipt.revision;
          savedVersionRef.current = targetVersion;
          onSaved(receipt, snapshot);
        } catch (cause) {
          onSaveStatus("error", errorMessage(cause));
          if (mountedRef.current && timerRef.current === null) timerRef.current = window.setTimeout(() => void enqueueSave(), 5000);
          return false;
        }
      }
      onSaveStatus("saved");
      return true;
    });
    return queueRef.current;
  }

  useImperativeHandle(ref, () => ({
    flush: async () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      return enqueueSave();
    },
  }));

  const commit = (next: DrawingDocument) => {
    drawingRef.current = next;
    setDrawing(next);
    markDirty();
  };
  /** Records an undo step from the strokes before the change. */
  const commitStrokes = (before: DrawingStroke[], strokes: DrawingStroke[], height = drawingRef.current.height) => {
    setHistory((current) => ({ undo: [...current.undo, before].slice(-200), redo: [] }));
    commit({ ...drawingRef.current, strokes, height });
  };
  const undo = () => {
    const previous = history.undo.at(-1);
    if (!previous) return;
    setHistory({ undo: history.undo.slice(0, -1), redo: [...history.redo, drawingRef.current.strokes] });
    commit({ ...drawingRef.current, strokes: previous });
  };
  const redo = () => {
    const next = history.redo.at(-1);
    if (!next) return;
    setHistory({ undo: [...history.undo, drawingRef.current.strokes], redo: history.redo.slice(0, -1) });
    commit({ ...drawingRef.current, strokes: next });
  };

  useEffect(() => {
    if (readOnly) return;
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || (event.target as HTMLElement).closest("input, textarea, select")) return;
      const key = event.key.toLowerCase();
      if (key === "z" && !event.shiftKey) { event.preventDefault(); undo(); }
      else if (key === "y" || (key === "z" && event.shiftKey)) { event.preventDefault(); redo(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // The page follows the sheet width; the theme decides the default ink (the paper's text colour).
  useLayoutEffect(() => {
    const page = pageRef.current;
    if (!page) return;
    const measure = () => { setWidth(page.clientWidth); setInk(getComputedStyle(page).color); };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(page);
    return () => observer.disconnect();
  }, [settings.theme, paperColor]);

  useLayoutEffect(() => {
    const ratio = window.devicePixelRatio || 1;
    for (const canvas of [baseRef.current, liveRef.current]) {
      if (!canvas) continue;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(drawing.height * scale * ratio);
    }
    if (baseRef.current) paintStrokes(baseRef.current, drawing.strokes, scale, ink);
  }, [drawing, width, scale, ink]);

  const pagePoint = (event: PointerEvent): [number, number, number] => {
    const rect = liveRef.current!.getBoundingClientRect();
    const x = Math.min(PAGE_WIDTH, Math.max(0, (event.clientX - rect.left) / scale));
    const y = Math.min(drawingRef.current.height, Math.max(0, (event.clientY - rect.top) / scale));
    const pressure = event.pointerType === "pen" && event.pressure > 0 ? event.pressure : NO_PRESSURE;
    return [round(x), round(y), round(pressure)];
  };

  const paintLive = () => {
    const canvas = liveRef.current;
    const stroke = gesture.current?.stroke;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (!stroke) return;
    const ratio = canvas.width / (width || 1);
    context.setTransform(scale * ratio, 0, 0, scale * ratio, 0, 0);
    paintStroke(context, stroke, ink, false);
    context.globalAlpha = 1;
  };

  const erase = (point: [number, number, number]) => {
    const strokes = drawingRef.current.strokes;
    const kept = strokes.filter((stroke) => !hitsStroke(stroke, point[0], point[1], ERASER_RADIUS / Math.max(scale, 0.2)));
    if (kept.length !== strokes.length) {
      drawingRef.current = { ...drawingRef.current, strokes: kept };
      setDrawing(drawingRef.current);
    }
  };

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (readOnly || gesture.current || (event.pointerType === "mouse" && event.button !== 0)) return;
    if (event.pointerType === "pen") penSeen.current = true;
    else if (event.pointerType === "touch" && penSeen.current) return;
    event.preventDefault();
    // Synthetic pointer events (tests, accessibility tools) have no active pointer to capture.
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* drawing still works without capture */ }
    const point = pagePoint(event.nativeEvent);
    const before = drawingRef.current.strokes;
    if (tool === "eraser") {
      gesture.current = { pointerId: event.pointerId, before };
      erase(point);
      return;
    }
    gesture.current = { pointerId: event.pointerId, before, stroke: { tool, color: colors[tool], size: sizes[tool], points: [point] } };
    paintLive();
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const events = event.nativeEvent.getCoalescedEvents?.() ?? [];
    for (const item of events.length ? events : [event.nativeEvent]) {
      const point = pagePoint(item);
      if (current.stroke) current.stroke.points.push(point);
      else erase(point);
    }
    if (current.stroke) paintLive();
  };

  const onPointerEnd = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    gesture.current = null;
    if (current.stroke) {
      const lowest = Math.max(...current.stroke.points.map((point) => point[1]));
      const height = lowest > drawingRef.current.height - 200 ? drawingRef.current.height + PAGE_GROWTH : drawingRef.current.height;
      commitStrokes(current.before, [...drawingRef.current.strokes, current.stroke], height);
      paintLive();
    } else if (drawingRef.current.strokes !== current.before) {
      commitStrokes(current.before, drawingRef.current.strokes);
    }
  };

  const updateTitle = (value: string) => { setTitle(value); titleRef.current = value; markDirty(); };
  const updatePaperColor = (value: PaperColor) => { setPaperColor(value); paperColorRef.current = value; markDirty(); };
  const setBackground = (background: DrawingBackground) => commit({ ...drawingRef.current, background });
  const sizeTool = tool === "eraser" ? "pen" : tool;
  const addCustomColor = (hex: string) => onSettingsChange({ customColors: [hex, ...settings.customColors.filter((c) => c !== hex)].slice(0, 10) });

  return (
    <section className="editor-panel drawing-editor">
      {readOnly ? (
        <div className="editor-toolbar editor-toolbar-readonly" role="toolbar" aria-label={note.trashedAt !== null ? "Azioni nota nel Cestino" : "Azioni nota archiviata"}>
          <span className="readonly-label">{note.trashedAt !== null ? <Trash2 size={16} /> : <Archive size={16} />} {note.trashedAt !== null ? "Nota nel Cestino, sola lettura" : "Nota archiviata, sola lettura"}</span>
          <div className="toolbar-spacer" />
          <button type="button" className="toolbar-action" onClick={onRestore}><RotateCcw size={15} /> Ripristina</button>
          {note.trashedAt === null && <ExportSelect value={settings.defaultExportFormat} onExport={onExport} />}
        </div>
      ) : (
        <div className="editor-toolbar" role="toolbar" aria-label="Strumenti di disegno">
          <div className="ribbon-strip">
            <section className="ribbon-group" aria-label="Strumenti">
              <ToolButton label="Penna" active={tool === "pen"} onClick={() => setTool("pen")}><PenLine size={18} /></ToolButton>
              <ToolButton label="Evidenziatore" active={tool === "highlighter"} onClick={() => setTool("highlighter")}><Highlighter size={18} /></ToolButton>
              <ToolButton label="Gomma" active={tool === "eraser"} onClick={() => setTool("eraser")}><Eraser size={18} /></ToolButton>
            </section>
            <section className="ribbon-group" aria-label="Colore e spessore">
              <div className="color-tool">
                <button ref={colorTrigger} type="button" className="color-palette-trigger drawing-color-trigger" aria-label="Colore inchiostro" title="Colore inchiostro" aria-haspopup="menu" style={{ "--active-color": colors[sizeTool] ?? ink } as React.CSSProperties} onClick={() => showAnchoredPopover(colorTrigger.current, colorMenu.current)}><span /></button>
                <div ref={colorMenu} className="color-grid-popover" role="menu" aria-label="Colore inchiostro" popover="auto">
                  <ColorGrid label="Colore inchiostro" customColors={settings.customColors} onAddCustom={addCustomColor} onSelect={(hex) => { setColors((current) => ({ ...current, [sizeTool]: hex })); colorMenu.current?.hidePopover(); }} onClear={() => { setColors((current) => ({ ...current, [sizeTool]: null })); colorMenu.current?.hidePopover(); }} />
                </div>
              </div>
              {SIZES[sizeTool].map((size, index) => (
                <ToolButton key={size} label={`Spessore ${index + 1}`} active={sizes[sizeTool] === size} onClick={() => setSizes((current) => ({ ...current, [sizeTool]: size }))}>
                  <span className="drawing-size-dot" style={{ width: 4 + index * 4, height: 4 + index * 4 }} />
                </ToolButton>
              ))}
            </section>
            <section className="ribbon-group" aria-label="Foglio">
              {BACKGROUNDS.map(([id, label, Icon]) => <ToolButton key={id} label={label} active={drawing.background === id} onClick={() => setBackground(id)}><Icon size={18} /></ToolButton>)}
            </section>
            <section className="ribbon-group" aria-label="Modifica">
              <ToolButton label="Annulla" disabled={history.undo.length === 0} onClick={undo}><Undo2 size={17} /></ToolButton>
              <ToolButton label="Ripeti" disabled={history.redo.length === 0} onClick={redo}><Redo2 size={17} /></ToolButton>
            </section>
            <section className="ribbon-group" aria-label="Nota">
              <div className="ribbon-note-controls">
                <PaperColorMenu dark={settings.theme === "dark"} value={paperColor} onChange={updatePaperColor} />
                <ExportSelect value={settings.defaultExportFormat} onExport={onExport} />
                <div className="ribbon-action-row">
                  <ToolButton label="Archivia nota" onClick={onArchive}><Archive size={17} /></ToolButton>
                  <ToolButton label={note.needsAttention ? "Rimuovi da sistemare" : "Segna da sistemare"} active={note.needsAttention} onClick={onToggleAttention}><CircleAlert size={17} /></ToolButton>
                  <ToolButton label="Sposta nel Cestino" onClick={onTrash}><Trash2 size={17} /></ToolButton>
                </div>
              </div>
            </section>
          </div>
        </div>
      )}
      <div className="editor-body">
        <div className="paper-scroll thin-scrollbar">
          <article className={`paper paper-${paperColor} drawing-paper${readOnly ? " is-readonly" : ""}`}>
            <div className="drawing-header">
              <input className="note-title" value={title} readOnly={readOnly} aria-label="Titolo della nota" placeholder="Senza titolo" onChange={(event) => updateTitle(event.target.value)} />
            </div>
            <div
              ref={pageRef}
              className={`drawing-page bg-${drawing.background} tool-${tool}`}
              style={{ height: drawing.height * scale, "--drawing-rule": `${RULE * scale}px` } as React.CSSProperties}
            >
              <canvas ref={baseRef} className="drawing-canvas" aria-hidden="true" />
              <canvas
                ref={liveRef}
                className="drawing-canvas drawing-input"
                role="img"
                aria-label={`Disegno: ${drawing.strokes.length} tratti`}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerEnd}
                onPointerCancel={onPointerEnd}
                onContextMenu={(event) => event.preventDefault()}
              />
            </div>
          </article>
        </div>
      </div>
    </section>
  );
});
