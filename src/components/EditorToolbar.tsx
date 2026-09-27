import { placeMenu } from "../ui/placeMenu";
import { ShapePicker } from "./ShapePicker";
import type { ShapeId } from "../ui/materialShapes";
import { RuleThicknessMenu } from "./RuleThicknessMenu";
import { ColorGrid } from "./ColorGrid";
import { recentColors, rememberColor } from "../ui/recentColors";
import { FindAndReplacePluginKey } from "@tiptap/extension-find-and-replace";
import { useEditorState, type Editor } from "@tiptap/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, Archive, Baseline, Bold, Check, ChevronDown, Download,
  ChevronLeft, ChevronRight, CircleAlert, Code2, Highlighter, Italic, List, ListOrdered,
  ImagePlus, ListTodo, Minus, PanelRightOpen, Redo2, RotateCcw, Search,
  Strikethrough, Trash2, Underline, Undo2, X,
} from "lucide-react";
import type { AppSettings, EditorFont, ExportFormat, LineSpacing, PaperColor } from "../api/types";
import { EDITOR_FONTS, EXPORT_FORMATS, LINE_SPACINGS, PAPER_COLORS } from "../options";
import { runForTextSelections } from "../editor/multiSelection";

interface Props {
  onInsertImages: (files: File[]) => void;
  checkboxShape: ShapeId;
  noteId: number;
  onShapeChange: (shape: ShapeId | null, global: boolean) => void;
  ruleThickness: number;
  onRuleThicknessChange: (n: number) => void;
  customColors: string[];
  onAddCustom: (hex: string) => void;
  dark: boolean;
  editor: Editor;
  lineSpacing: LineSpacing;
  paperColor: PaperColor;
  readOnly: boolean;
  defaultExportFormat: ExportFormat;
  editorFont: EditorFont;
  editorFontSize: number;
  findOpen: boolean;
  outlineOpen: boolean;
  needsAttention: boolean;
  onFindOpenChange: (open: boolean) => void;
  onToggleOutline: () => void;
  onToggleAttention: () => void;
  onLineSpacingChange: (value: LineSpacing) => void;
  onPaperColorChange: (value: PaperColor) => void;
  onArchive: () => void;
  onTrash: () => void;
  onRestore: () => void;
  trashed?: boolean;
  onExport: (format: ExportFormat) => void;
  onEditorFontChange: (font: EditorFont) => void;
  onEditorFontSizeChange: (size: number) => void;
  toolbarWidths: ToolbarWidths;
  onToolbarWidthChange: (setting: ToolbarWidthSetting, width: number) => void;
}

export type ToolbarWidthSetting = keyof Pick<AppSettings,
  "toolbarCharacterWidth" | "toolbarParagraphWidth" | "toolbarStylesWidth" | "toolbarNoteWidth" | "toolbarToolsWidth"
>;

type ToolbarWidths = Pick<AppSettings, ToolbarWidthSetting>;

const WIDTH_LIMITS: Record<ToolbarWidthSetting, { min: number; max: number }> = {
  toolbarCharacterWidth: { min: 190, max: 360 },
  toolbarParagraphWidth: { min: 190, max: 360 },
  toolbarStylesWidth: { min: 180, max: 380 },
  toolbarNoteWidth: { min: 180, max: 360 },
  toolbarToolsWidth: { min: 90, max: 180 },
};

function ToolButton({ label, active, disabled, onClick, onContextMenu, children }: { onContextMenu?: React.MouseEventHandler<HTMLButtonElement>; label: string; active?: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" className={active ? "toolbar-button is-active" : "toolbar-button"} aria-label={label} title={label} aria-pressed={active} disabled={disabled} onContextMenu={onContextMenu} onClick={onClick}>{children}</button>;
}

function RibbonGroup({ label, className = "", onResize, onResizeBy, children }: { label: string; className?: string; onResize: (event: React.PointerEvent<HTMLSpanElement>) => void; onResizeBy: (delta: number) => void; children: React.ReactNode }) {
  return <section className={`ribbon-group ${className}`} aria-label={label}><div className="ribbon-group-content">{children}</div><span className="ribbon-label">{label}</span><span className="ribbon-resizer" role="separator" aria-label={`Ridimensiona sezione ${label}`} aria-orientation="vertical" tabIndex={0} onPointerDown={onResize} onKeyDown={(event) => { if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); onResizeBy(event.key === "ArrowLeft" ? -10 : 10); } }} /></section>;
}

export function EditorToolbar(props: Props) {
  const { editor, readOnly } = props;
  const [activeGroup, setActiveGroup] = useState("character");
  const [toolbarWidths, setToolbarWidths] = useState(props.toolbarWidths);
  const [compact, setCompact] = useState(false);
  const imageInput = useRef<HTMLInputElement>(null);
  const shapeMenu = useRef<HTMLDivElement>(null);
  const openShapes = (e: React.MouseEvent<HTMLButtonElement>) => { e.preventDefault(); showAnchoredPopover(e.currentTarget, shapeMenu.current); };
  const ruleMenu = useRef<HTMLDivElement>(null);
  const insertRule = (n: number) => { props.onRuleThicknessChange(n); editor.chain().focus().insertContent({ type: "horizontalRule", attrs: { thickness: n } }).run(); ruleMenu.current?.hidePopover(); };
  const toolbarRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const widthsRef = useRef(toolbarWidths);
  widthsRef.current = toolbarWidths;

  // The ribbon never squeezes a group below its content: when the groups together need more
  // room than the toolbar has, it switches to one group at a time behind tabs.
  // The measure is the same in both layouts (content is always max-content), so it cannot flip-flop.
  useLayoutEffect(() => {
    const toolbar = toolbarRef.current;
    const strip = stripRef.current;
    if (!toolbar || !strip) return;
    const order: ToolbarWidthSetting[] = ["toolbarCharacterWidth", "toolbarParagraphWidth", "toolbarStylesWidth", "toolbarNoteWidth", "toolbarToolsWidth"];
    const measure = () => {
      const groups = [...strip.querySelectorAll<HTMLElement>(".ribbon-group")];
      const needed = groups.reduce((sum, group, index) => {
        const content = group.querySelector<HTMLElement>(".ribbon-group-content");
        const style = getComputedStyle(group);
        const chrome = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight) + parseFloat(style.borderRightWidth);
        const contentWidth = Math.ceil((content?.getBoundingClientRect().width ?? 0) + chrome);
        return sum + Math.max(widthsRef.current[order[index]!], contentWidth);
      }, 0);
      setCompact(needed > toolbar.clientWidth);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(toolbar);
    strip.querySelectorAll(".ribbon-group-content").forEach((content) => observer.observe(content));
    void document.fonts.ready.then(measure);
    return () => observer.disconnect();
  }, [readOnly, toolbarWidths]);
  useEffect(() => setToolbarWidths(props.toolbarWidths), [
    props.toolbarWidths.toolbarCharacterWidth,
    props.toolbarWidths.toolbarParagraphWidth,
    props.toolbarWidths.toolbarStylesWidth,
    props.toolbarWidths.toolbarNoteWidth,
    props.toolbarWidths.toolbarToolsWidth,
  ]);

  // With text selected font and size apply to the selection only; otherwise they are the note default.
  const selectionStyle = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      hasSelection: !current.state.selection.empty,
      fontFamily: current.getAttributes("textStyle").fontFamily as string | undefined,
      fontSize: current.getAttributes("textStyle").fontSize as string | undefined,
    }),
  });
  const selectionFont = EDITOR_FONTS.find((font) => font.label === selectionStyle.fontFamily)?.id ?? props.editorFont;
  const selectionSize = Number.parseInt(selectionStyle.fontSize ?? "", 10) || props.editorFontSize;
  const changeFont = (id: EditorFont) => {
    const font = EDITOR_FONTS.find((item) => item.id === id);
    if (!font) return;
    if (selectionStyle.hasSelection) runForTextSelections(editor, () => { editor.chain().focus().setFontFamily(font.label).run(); });
    else props.onEditorFontChange(id);
  };
  const changeFontSize = (size: number) => {
    if (selectionStyle.hasSelection) runForTextSelections(editor, () => { editor.chain().focus().setMark("textStyle", { fontSize: `${size}px` }).run(); });
    else props.onEditorFontSizeChange(size);
  };

  const setWidth = (setting: ToolbarWidthSetting, width: number, persist: boolean) => {
    const limits = WIDTH_LIMITS[setting];
    const bounded = Math.min(limits.max, Math.max(limits.min, Math.round(width)));
    setToolbarWidths((current) => ({ ...current, [setting]: bounded }));
    if (persist) props.onToolbarWidthChange(setting, bounded);
  };

  const beginResize = (setting: ToolbarWidthSetting, event: React.PointerEvent<HTMLSpanElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = toolbarWidths[setting];
    let latestWidth = startWidth;
    const onMove = (move: PointerEvent) => {
      const limits = WIDTH_LIMITS[setting];
      latestWidth = Math.min(limits.max, Math.max(limits.min, Math.round(startWidth + move.clientX - startX)));
      setToolbarWidths((current) => ({ ...current, [setting]: latestWidth }));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      props.onToolbarWidthChange(setting, latestWidth);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
  };
  if (readOnly) {
    return <div className="editor-toolbar editor-toolbar-readonly" role="toolbar" aria-label={props.trashed ? "Azioni nota nel Cestino" : "Azioni nota archiviata"}><span className="readonly-label">{props.trashed ? <Trash2 size={16} /> : <Archive size={16} />} {props.trashed ? "Nota nel Cestino, sola lettura" : "Nota archiviata, sola lettura"}</span><div className="toolbar-spacer" /><button type="button" className="toolbar-action" onClick={props.onRestore}><RotateCcw size={15} /> Ripristina</button>{!props.trashed && <ExportSelect value={props.defaultExportFormat} onExport={props.onExport} />}</div>;
  }

  return (
    <div ref={toolbarRef} className={`editor-toolbar${props.findOpen ? " has-find" : ""}`} role="toolbar" aria-label="Formattazione nota">
      <div ref={stripRef} className={`ribbon-strip${compact ? " is-compact" : ""}`} data-layout={compact ? "compact" : "full"} style={{
        "--toolbar-character-width": `${toolbarWidths.toolbarCharacterWidth}px`,
        "--toolbar-paragraph-width": `${toolbarWidths.toolbarParagraphWidth}px`,
        "--toolbar-styles-width": `${toolbarWidths.toolbarStylesWidth}px`,
        "--toolbar-note-width": `${toolbarWidths.toolbarNoteWidth}px`,
        "--toolbar-tools-width": `${toolbarWidths.toolbarToolsWidth}px`,
      } as React.CSSProperties}>
        <nav className="ribbon-tabs" aria-label="Sezioni della barra strumenti">
          <button type="button" className={activeGroup === "character" ? "is-active" : ""} onClick={() => setActiveGroup("character")} aria-pressed={activeGroup === "character"}>Carattere</button>
          <button type="button" className={activeGroup === "paragraph" ? "is-active" : ""} onClick={() => setActiveGroup("paragraph")} aria-pressed={activeGroup === "paragraph"}>Paragrafo</button>
          <button type="button" className={activeGroup === "styles" ? "is-active" : ""} onClick={() => setActiveGroup("styles")} aria-pressed={activeGroup === "styles"}>Stili</button>
          <button type="button" className={activeGroup === "note" ? "is-active" : ""} onClick={() => setActiveGroup("note")} aria-pressed={activeGroup === "note"}>Nota</button>
          <button type="button" className={activeGroup === "tools" ? "is-active" : ""} onClick={() => setActiveGroup("tools")} aria-pressed={activeGroup === "tools"}>Strumenti</button>
        </nav>
        <RibbonGroup label="Carattere" className={`ribbon-character${activeGroup === "character" ? " is-active" : ""}`} onResize={(event) => beginResize("toolbarCharacterWidth", event)} onResizeBy={(delta) => setWidth("toolbarCharacterWidth", toolbarWidths.toolbarCharacterWidth + delta, true)}>
          <div className="ribbon-row ribbon-select-row">
            <label className="toolbar-field toolbar-font"><span className="sr-only">Font</span><select aria-label={selectionStyle.hasSelection ? "Font del testo selezionato" : "Font della nota"} title={selectionStyle.hasSelection ? "Cambia il font del testo selezionato" : "Cambia il font delle note (seleziona del testo per cambiarlo solo lì)"} value={selectionFont} onChange={(event) => changeFont(event.target.value as EditorFont)}>{EDITOR_FONTS.map((font) => <option key={font.id} value={font.id}>{font.label}</option>)}</select></label>
            <label className="toolbar-field toolbar-font-size"><span className="toolbar-field-label">Testo</span><select aria-label={selectionStyle.hasSelection ? "Dimensione del testo selezionato" : "Dimensione del testo della nota"} value={selectionSize} onChange={(event) => changeFontSize(Number(event.target.value))}>{Array.from({ length: 17 }, (_, index) => 12 + index).map((size) => <option key={size} value={size}>{size} px</option>)}</select></label>
          </div>
          <div className="ribbon-row ribbon-format-row">
            <ToolButton label="Grassetto" active={editor.isActive("bold")} onClick={() => runForTextSelections(editor, () => { editor.chain().focus().toggleBold().run(); })}><Bold size={18} /></ToolButton>
            <ToolButton label="Corsivo" active={editor.isActive("italic")} onClick={() => runForTextSelections(editor, () => { editor.chain().focus().toggleItalic().run(); })}><Italic size={18} /></ToolButton>
            <ToolButton label="Sottolineato" active={editor.isActive("underline")} onClick={() => runForTextSelections(editor, () => { editor.chain().focus().toggleUnderline().run(); })}><Underline size={18} /></ToolButton>
            <ToolButton label="Barrato" active={editor.isActive("strike")} onClick={() => runForTextSelections(editor, () => { editor.chain().focus().toggleStrike().run(); })}><Strikethrough size={18} /></ToolButton>
            <ColorPaletteMenu editor={editor} noteId={props.noteId} customColors={props.customColors} onAddCustom={props.onAddCustom} />
            <ColorPaletteMenu editor={editor} noteId={props.noteId} highlight customColors={props.customColors} onAddCustom={props.onAddCustom} />
          </div>
        </RibbonGroup>

        <RibbonGroup label="Paragrafo" className={`ribbon-paragraph${activeGroup === "paragraph" ? " is-active" : ""}`} onResize={(event) => beginResize("toolbarParagraphWidth", event)} onResizeBy={(delta) => setWidth("toolbarParagraphWidth", toolbarWidths.toolbarParagraphWidth + delta, true)}>
          <div className="ribbon-row ribbon-align-row">
            <label className="toolbar-field toolbar-spacing"><span className="toolbar-field-label">Righe</span><select aria-label="Interlinea" value={props.lineSpacing} onChange={(event) => props.onLineSpacingChange(Number(event.target.value) as LineSpacing)}>{LINE_SPACINGS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
            <ToolButton label="Allinea a sinistra" active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()}><AlignLeft size={20} /></ToolButton>
            <ToolButton label="Allinea al centro" active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()}><AlignCenter size={20} /></ToolButton>
            <ToolButton label="Allinea a destra" active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()}><AlignRight size={20} /></ToolButton>
            <ToolButton label="Giustifica" active={editor.isActive({ textAlign: "justify" })} onClick={() => editor.chain().focus().setTextAlign("justify").run()}><AlignJustify size={20} /></ToolButton>
          </div>
          <div className="ribbon-row ribbon-list-row">
            <ToolButton label="Lista puntata" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}><List size={18} /></ToolButton>
            <ToolButton label="Lista numerata" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered size={18} /></ToolButton>
            <ToolButton onContextMenu={openShapes} label="Checklist" active={editor.isActive("taskList")} onClick={() => editor.chain().focus().toggleTaskList().run()}><ListTodo size={18} /></ToolButton>
            <ToolButton label="Blocco codice" active={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()}><Code2 size={18} /></ToolButton>
            <input ref={imageInput} type="file" hidden multiple accept="image/png,image/jpeg,image/webp,image/gif,image/bmp" onChange={e => { props.onInsertImages([...e.target.files ?? []]); e.target.value = ""; }} />
            <ToolButton label="Inserisci immagine" onClick={() => imageInput.current?.click()}><ImagePlus size={18} /></ToolButton>
            <ToolButton label="Inserisci divisore" active={editor.isActive("horizontalRule")} onContextMenu={e => { e.preventDefault(); showAnchoredPopover(e.currentTarget, ruleMenu.current); }} onClick={() => insertRule(props.ruleThickness)}><Minus size={18} /></ToolButton>
          </div>
        </RibbonGroup>

        <RibbonGroup label="Stili" className={`ribbon-styles${activeGroup === "styles" ? " is-active" : ""}`} onResize={(event) => beginResize("toolbarStylesWidth", event)} onResizeBy={(delta) => setWidth("toolbarStylesWidth", toolbarWidths.toolbarStylesWidth + delta, true)}>
          <div className="style-gallery">
            <StyleButton label="Normale" sample="Aa" active={!editor.isActive("heading")} onClick={() => editor.chain().focus().setParagraph().run()} />
            <StyleButton label="Titolo 1" sample="H1" active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().setHeading({ level: 1 }).run()} />
            <StyleButton label="Titolo 2" sample="H2" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().setHeading({ level: 2 }).run()} />
            <StyleButton label="Titolo 3" sample="H3" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().setHeading({ level: 3 }).run()} />
          </div>
        </RibbonGroup>

        <RibbonGroup label="Nota" className={`ribbon-note${activeGroup === "note" ? " is-active" : ""}`} onResize={(event) => beginResize("toolbarNoteWidth", event)} onResizeBy={(delta) => setWidth("toolbarNoteWidth", toolbarWidths.toolbarNoteWidth + delta, true)}>
          <div className="ribbon-note-controls">
            <PaperColorMenu dark={props.dark} value={props.paperColor} onChange={props.onPaperColorChange} />
            <ExportSelect value={props.defaultExportFormat} onExport={props.onExport} />
            <div className="ribbon-action-row">
              <ToolButton label="Annulla" disabled={!editor.can().chain().focus().undo().run()} onClick={() => editor.chain().focus().undo().run()}><Undo2 size={17} /></ToolButton>
              <ToolButton label="Ripeti" disabled={!editor.can().chain().focus().redo().run()} onClick={() => editor.chain().focus().redo().run()}><Redo2 size={17} /></ToolButton>
              <ToolButton label="Archivia nota" onClick={props.onArchive}><Archive size={17} /></ToolButton>
              <ToolButton label={props.needsAttention ? "Rimuovi da sistemare" : "Segna da sistemare"} active={props.needsAttention} onClick={props.onToggleAttention}><CircleAlert size={17} /></ToolButton>
              <ToolButton label="Sposta nel Cestino" onClick={props.onTrash}><Trash2 size={17} /></ToolButton>
            </div>
          </div>
        </RibbonGroup>

        <RibbonGroup label="Strumenti" className={`ribbon-tools${activeGroup === "tools" ? " is-active" : ""}`} onResize={(event) => beginResize("toolbarToolsWidth", event)} onResizeBy={(delta) => setWidth("toolbarToolsWidth", toolbarWidths.toolbarToolsWidth + delta, true)}>
          <div className="ribbon-tools-row">
            <button type="button" className={props.findOpen ? "toolbar-tool is-active" : "toolbar-tool"} onClick={() => props.onFindOpenChange(!props.findOpen)} title="Trova e sostituisci (Ctrl+F)"><Search size={18} /><span>Trova</span></button>
            <button type="button" className={props.outlineOpen ? "toolbar-tool is-active" : "toolbar-tool"} onClick={props.onToggleOutline} title="Mostra l’indice della nota"><PanelRightOpen size={18} /><span>Indice</span></button>
          </div>
        </RibbonGroup>
      </div>
      <div ref={shapeMenu} className="paper-color-popover" popover="auto" role="menu" aria-label="Forma checkbox"><ShapePicker value={props.checkboxShape} onSelect={(id, global) => { props.onShapeChange(id, global); shapeMenu.current?.hidePopover(); }} onReset={() => { props.onShapeChange(null, false); shapeMenu.current?.hidePopover(); }} /></div>
      <div ref={ruleMenu} popover="auto" className="paper-color-popover" role="menu" aria-label="Spessore divisore"><RuleThicknessMenu value={props.ruleThickness} onSelect={insertRule} /></div>
      {props.findOpen && <FindReplaceBar editor={editor} onClose={() => props.onFindOpenChange(false)} />}
    </div>
  );
}

function ColorPaletteMenu({ editor, noteId, highlight = false, customColors, onAddCustom }: { editor: Editor; noteId: number; highlight?: boolean; customColors: string[]; onAddCustom: (hex: string) => void }) {
  const [color, setColor] = useState(highlight ? "#ffff00" : "#000000");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const paletteRef = useRef<HTMLDivElement>(null);
  const label = highlight ? "Evidenziatore" : "Colore testo";
  const kind = highlight ? "highlight" : "text";
  const [recent, setRecent] = useState<string[]>([]);
  const select = (hex: string) => {
    setColor(hex);
    rememberColor(kind, noteId, editor.state.doc, hex);
    runForTextSelections(editor, () => { const chain = editor.chain().focus(); (highlight ? chain.setHighlight({ color: hex }) : chain.setColor(hex)).run(); });
    paletteRef.current?.hidePopover();
  };
  const open = () => { setRecent(recentColors(kind, noteId, editor.state.doc)); showAnchoredPopover(triggerRef.current, paletteRef.current); };
  return <div className={highlight ? "highlight-menu" : "color-tool"}><button ref={triggerRef} type="button" className="color-palette-trigger" aria-label={label} title={label} aria-haspopup="menu" style={{ "--active-color": color } as React.CSSProperties} onClick={open} onContextMenu={event => { event.preventDefault(); open(); }}>{highlight ? <Highlighter size={19} /> : <Baseline size={19} />}<span /></button><div ref={paletteRef} className="color-grid-popover" role="menu" aria-label={label} popover="auto"><ColorGrid label={label} recent={recent} customColors={customColors} onSelect={select} onAddCustom={onAddCustom} onClear={() => { runForTextSelections(editor, () => { const chain = editor.chain().focus(); (highlight ? chain.unsetHighlight() : chain.unsetColor()).run(); }); paletteRef.current?.hidePopover(); }} /></div></div>;
}

function PaperColorMenu({ value, onChange, dark }: { dark: boolean; value: PaperColor; onChange: (value: PaperColor) => void }) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const selected = PAPER_COLORS.find((item) => item.id === value) ?? PAPER_COLORS[0]!;
  const open = () => showAnchoredPopover(triggerRef.current, menuRef.current);
  return <div className="toolbar-paper"><button ref={triggerRef} type="button" className="paper-color-trigger" aria-label="Colore del foglio" aria-haspopup="menu" onClick={open}><span className="paper-dot" style={{ background: `var(--swatch-paper-${selected.id})` }} /><span>{dark ? selected.darkLabel : selected.label}</span><ChevronDown size={12} /></button><div ref={menuRef} className="paper-color-popover paper-menu" role="menu" aria-label="Colore del foglio" popover="auto">{PAPER_COLORS.map((item) => { const label = dark ? item.darkLabel : item.label; return <button type="button" role="menuitemradio" aria-checked={item.id === value} aria-label={label} title={label} key={item.id} onClick={() => { onChange(item.id); menuRef.current?.hidePopover(); }}><span className="paper-swatch" style={{ background: `var(--swatch-paper-${item.id})` }}>{item.id === value && <Check size={16} aria-hidden="true" />}</span><small>{label}</small></button>; })}</div></div>;
}

export function showAnchoredPopover(trigger: HTMLElement | null, popover: HTMLElement | null) {
  if (!trigger || !popover) return;
  popover.showPopover();
  requestAnimationFrame(() => {
    const anchor = trigger.getBoundingClientRect();
    const position = placeMenu(anchor.left, anchor.bottom + 6, popover.offsetWidth, popover.scrollHeight);
    Object.assign(popover.style, { left: `${position.left}px`, top: `${position.top}px`, maxHeight: `${position.maxHeight}px`, overflowY: "auto" });
  });
}

function FindReplaceBar({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const [, setRevision] = useState(0);
  const [term, setTerm] = useState(editor.storage.findAndReplace.searchTerm);
  const pendingFirst = useRef(false);
  const termRef = useRef(term);
  useEffect(() => {
    let frame = 0;
    let previousResults = editor.storage.findAndReplace.results;
    let previousIndex = editor.storage.findAndReplace.currentIndex;
    const refresh = () => {
      setRevision((value) => value + 1);
      const storage = editor.storage.findAndReplace;
      if (!pendingFirst.current && previousResults === storage.results && previousIndex === storage.currentIndex) return;
      previousResults = storage.results;
      previousIndex = storage.currentIndex;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (editor.isDestroyed) return;
        const current = editor.storage.findAndReplace;
        if (pendingFirst.current && current.searchTerm === termRef.current) {
          pendingFirst.current = false;
          const first = current.results[0];
          if (first) {
            editor.view.dispatch(editor.state.tr.setMeta(FindAndReplacePluginKey, { currentIndex: 0 }));
            editor.chain().setTextSelection(first).focus().run();
          }
        }
        editor.view.dom.querySelector<HTMLElement>(".find-and-replace-result-current")?.scrollIntoView({ behavior: "instant", block: "center" });
      });
    };
    editor.on("transaction", refresh);
    return () => { editor.off("transaction", refresh); cancelAnimationFrame(frame); editor.commands.clearSearch(); };
  }, [editor]);
  const storage = editor.storage.findAndReplace;
  return <div className="find-replace-bar" role="search" aria-label="Trova e sostituisci"><Search size={15} /><input autoFocus aria-label="Testo da trovare" placeholder="Trova nella nota" value={term} onChange={(event) => { setTerm(event.target.value); termRef.current = event.target.value; pendingFirst.current = false; editor.commands.setSearchTerm(event.target.value); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); pendingFirst.current = true; editor.commands.setSearchTerm(term); } }} /><span className="find-count" aria-live="polite">{storage.results.length ? `${(storage.currentIndex ?? 0) + 1}/${storage.results.length}` : "0"}</span><button type="button" aria-label="Risultato precedente" onClick={() => editor.commands.goToPreviousResult()}><ChevronLeft size={15} /></button><button type="button" aria-label="Risultato successivo" onClick={() => editor.commands.goToNextResult()}><ChevronRight size={15} /></button><input aria-label="Testo sostitutivo" placeholder="Sostituisci con" value={storage.replaceTerm} onChange={(event) => editor.commands.setReplaceTerm(event.target.value)} /><button type="button" className="find-text-button" onClick={() => editor.commands.replace()}>Sostituisci</button><button type="button" className="find-text-button" onClick={() => editor.commands.replaceAll()}>Tutto</button><button type="button" aria-label="Chiudi ricerca" onClick={() => { editor.commands.clearSearch(); onClose(); }}><X size={15} /></button></div>;
}

function StyleButton({ label, sample, active, onClick }: { label: string; sample: string; active: boolean; onClick: () => void }) {
  return <button type="button" className={active ? "style-button is-active" : "style-button"} aria-pressed={active} onClick={onClick}><strong>{sample}</strong><small>{label}</small></button>;
}

function ExportSelect({ value, onExport }: { value: ExportFormat; onExport: (format: ExportFormat) => void }) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  return <div className="toolbar-export"><button ref={triggerRef} type="button" className="paper-color-trigger" aria-label="Esporta nota" aria-haspopup="menu" onClick={() => showAnchoredPopover(triggerRef.current, menuRef.current)}><Download size={16} /><span>Esporta</span><ChevronDown size={12} /></button><div ref={menuRef} className="paper-color-popover export-menu" role="menu" aria-label="Esporta nota" popover="auto">{EXPORT_FORMATS.map((format) => <button key={format.id} type="button" role="menuitem" onClick={() => { menuRef.current?.hidePopover(); onExport(format.id); }}>{format.label}{format.id === value ? " (predefinito)" : ""}</button>)}</div></div>;
}
