import { placeMenu } from "../ui/placeMenu";
import { ShapePicker } from "./ShapePicker";
import type { ShapeId } from "../ui/materialShapes";
import { RuleThicknessMenu } from "./RuleThicknessMenu";
import { ColorGrid } from "./ColorGrid";
import { recentColors, rememberColor } from "../ui/recentColors";
import { FindAndReplacePluginKey } from "@tiptap/extension-find-and-replace";
import { useEditorState, type Editor } from "@tiptap/react";
import { useEffect, useRef, useState } from "react";
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, Archive, Baseline, Bold, Check, ChevronDown, Download,
  ChevronLeft, ChevronRight, CircleAlert, Code2, Highlighter, Italic, List, ListOrdered,
  ImagePlus, ListTodo, Minus, PanelRightOpen, Redo2, RotateCcw, Search,
  Strikethrough, Table2, Trash2, Underline, Undo2, X,
} from "lucide-react";
import type { EditorFont, ExportFormat, LineSpacing, PaperColor } from "../api/types";
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
}

export function ToolButton({ label, active, disabled, onClick, onContextMenu, children }: { onContextMenu?: React.MouseEventHandler<HTMLButtonElement>; label: string; active?: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" className={active ? "toolbar-button is-active" : "toolbar-button"} aria-label={label} title={label} aria-pressed={active} disabled={disabled} onContextMenu={onContextMenu} onClick={onClick}>{children}</button>;
}

function RibbonGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return <section className="ribbon-group" aria-label={label}>{children}</section>;
}

export function EditorToolbar(props: Props) {
  const { editor, readOnly } = props;
  const imageInput = useRef<HTMLInputElement>(null);
  const shapeMenu = useRef<HTMLDivElement>(null);
  const openShapes = (e: React.MouseEvent<HTMLButtonElement>) => { e.preventDefault(); showAnchoredPopover(e.currentTarget, shapeMenu.current); };
  const ruleMenu = useRef<HTMLDivElement>(null);
  const insertRule = (n: number) => { props.onRuleThicknessChange(n); editor.chain().focus().insertContent({ type: "horizontalRule", attrs: { thickness: n } }).run(); ruleMenu.current?.hidePopover(); };

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

  if (readOnly) {
    return <div className="editor-toolbar editor-toolbar-readonly" role="toolbar" aria-label={props.trashed ? "Azioni nota nel Cestino" : "Azioni nota archiviata"}><span className="readonly-label">{props.trashed ? <Trash2 size={16} /> : <Archive size={16} />} {props.trashed ? "Nota nel Cestino, sola lettura" : "Nota archiviata, sola lettura"}</span><div className="toolbar-spacer" /><button type="button" className="toolbar-action" onClick={props.onRestore}><RotateCcw size={15} /> Ripristina</button>{!props.trashed && <ExportSelect value={props.defaultExportFormat} onExport={props.onExport} />}</div>;
  }

  return (
    <div className={`editor-toolbar${props.findOpen ? " has-find" : ""}`} role="toolbar" aria-label="Formattazione nota">
      <div className="ribbon-strip">
        <RibbonGroup label="Carattere">
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

        <RibbonGroup label="Paragrafo">
          <div className="ribbon-row ribbon-align-row">
            <label className="toolbar-field toolbar-spacing"><span className="toolbar-field-label">Righe</span><select aria-label="Interlinea" value={props.lineSpacing} onChange={(event) => props.onLineSpacingChange(Number(event.target.value) as LineSpacing)}>{LINE_SPACINGS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
            <ToolButton label="Allinea a sinistra" active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()}><AlignLeft size={20} /></ToolButton>
            <ToolButton label="Allinea al centro" active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()}><AlignCenter size={20} /></ToolButton>
            <ToolButton label="Allinea a destra" active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()}><AlignRight size={20} /></ToolButton>
            <ToolButton label="Giustifica" active={editor.isActive({ textAlign: "justify" })} onClick={() => editor.chain().focus().setTextAlign("justify").run()}><AlignJustify size={20} /></ToolButton>
          </div>
        </RibbonGroup>

        <RibbonGroup label="Stili">
          <div className="style-gallery">
            <StyleButton label="Normale" sample="Aa" active={!editor.isActive("heading")} onClick={() => editor.chain().focus().setParagraph().run()} />
            <StyleButton label="Titolo 1" sample="H1" active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().setHeading({ level: 1 }).run()} />
            <StyleButton label="Titolo 2" sample="H2" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().setHeading({ level: 2 }).run()} />
            <StyleButton label="Titolo 3" sample="H3" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().setHeading({ level: 3 }).run()} />
          </div>
        </RibbonGroup>

        <RibbonGroup label="Inserisci">
          <div className="ribbon-row">
            <ToolButton label="Lista puntata" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}><List size={18} /></ToolButton>
            <ToolButton label="Lista numerata" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered size={18} /></ToolButton>
            <ToolButton onContextMenu={openShapes} label="Checklist" active={editor.isActive("taskList")} onClick={() => editor.chain().focus().toggleTaskList().run()}><ListTodo size={18} /></ToolButton>
            <ToolButton label="Blocco codice" active={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()}><Code2 size={18} /></ToolButton>
            <TableMenu editor={editor} />
            <input ref={imageInput} type="file" hidden multiple accept="image/png,image/jpeg,image/webp,image/gif,image/bmp" onChange={e => { props.onInsertImages([...e.target.files ?? []]); e.target.value = ""; }} />
            <ToolButton label="Inserisci immagine" onClick={() => imageInput.current?.click()}><ImagePlus size={18} /></ToolButton>
            <ToolButton label="Inserisci divisore" active={editor.isActive("horizontalRule")} onContextMenu={e => { e.preventDefault(); showAnchoredPopover(e.currentTarget, ruleMenu.current); }} onClick={() => insertRule(props.ruleThickness)}><Minus size={18} /></ToolButton>
          </div>
        </RibbonGroup>

        <RibbonGroup label="Nota">
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

        <RibbonGroup label="Strumenti">
          <div className="ribbon-tools-row">
            <button type="button" className={props.findOpen ? "toolbar-tool is-active" : "toolbar-tool"} aria-label="Trova e sostituisci" onClick={() => props.onFindOpenChange(!props.findOpen)} title="Trova e sostituisci (Ctrl+F)"><Search size={18} /><span>Trova</span></button>
            <button type="button" className={props.outlineOpen ? "toolbar-tool is-active" : "toolbar-tool"} aria-label="Indice" onClick={props.onToggleOutline} title="Mostra l’indice della nota"><PanelRightOpen size={18} /><span>Indice</span></button>
          </div>
        </RibbonGroup>
      </div>
      <div ref={shapeMenu} className="paper-color-popover" popover="auto" role="menu" aria-label="Forma checkbox"><ShapePicker value={props.checkboxShape} onSelect={(id, global) => { props.onShapeChange(id, global); shapeMenu.current?.hidePopover(); }} onReset={() => { props.onShapeChange(null, false); shapeMenu.current?.hidePopover(); }} /></div>
      <div ref={ruleMenu} popover="auto" className="paper-color-popover" role="menu" aria-label="Spessore divisore"><RuleThicknessMenu value={props.ruleThickness} onSelect={insertRule} /></div>
      {props.findOpen && <FindReplaceBar editor={editor} onClose={() => props.onFindOpenChange(false)} />}
    </div>
  );
}

const TABLE_MAX_ROWS = 8;
const TABLE_MAX_COLS = 10;

/** Word-style size picker: hover the grid to choose rows × columns, click to insert (first row is the header). */
function TableMenu({ editor }: { editor: Editor }) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ rows: 0, cols: 0 });
  const insert = (rows: number, cols: number) => {
    menuRef.current?.hidePopover();
    editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run();
  };
  return <div className="toolbar-table">
    <button ref={triggerRef} type="button" className={editor.isActive("table") ? "toolbar-button is-active" : "toolbar-button"} aria-label="Inserisci tabella" title="Inserisci tabella" aria-haspopup="menu" onClick={() => { setSize({ rows: 0, cols: 0 }); showAnchoredPopover(triggerRef.current, menuRef.current); }}><Table2 size={18} /></button>
    <div ref={menuRef} className="paper-color-popover table-size-menu" popover="auto" role="menu" aria-label="Dimensione tabella">
      <div className="table-size-grid" style={{ "--table-cols": TABLE_MAX_COLS } as React.CSSProperties} onPointerLeave={() => setSize({ rows: 0, cols: 0 })}>
        {Array.from({ length: TABLE_MAX_ROWS * TABLE_MAX_COLS }, (_, index) => {
          const rows = Math.floor(index / TABLE_MAX_COLS) + 1;
          const cols = (index % TABLE_MAX_COLS) + 1;
          return <button key={index} type="button" role="menuitem" aria-label={`Tabella ${rows} righe × ${cols} colonne`} className={rows <= size.rows && cols <= size.cols ? "is-selected" : undefined} onPointerEnter={() => setSize({ rows, cols })} onFocus={() => setSize({ rows, cols })} onClick={() => insert(rows, cols)} />;
        })}
      </div>
      <p aria-live="polite">{size.rows ? `${size.rows} × ${size.cols}` : "Righe × colonne"}</p>
    </div>
  </div>;
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

export function PaperColorMenu({ value, onChange, dark }: { dark: boolean; value: PaperColor; onChange: (value: PaperColor) => void }) {
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
  return <button type="button" className={active ? "style-button is-active" : "style-button"} aria-label={label} title={label} aria-pressed={active} onClick={onClick}><strong>{sample}</strong><small>{label}</small></button>;
}

export function ExportSelect({ value, onExport }: { value: ExportFormat; onExport: (format: ExportFormat) => void }) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  return <div className="toolbar-export"><button ref={triggerRef} type="button" className="paper-color-trigger" aria-label="Esporta nota" aria-haspopup="menu" onClick={() => showAnchoredPopover(triggerRef.current, menuRef.current)}><Download size={16} /><span>Esporta</span><ChevronDown size={12} /></button><div ref={menuRef} className="paper-color-popover export-menu" role="menu" aria-label="Esporta nota" popover="auto">{EXPORT_FORMATS.map((format) => <button key={format.id} type="button" role="menuitem" onClick={() => { menuRef.current?.hidePopover(); onExport(format.id); }}>{format.label}{format.id === value ? " (predefinito)" : ""}</button>)}</div></div>;
}
