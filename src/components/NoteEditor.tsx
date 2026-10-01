import { ImageNode } from "../editor/imageNode";
import type { ShapeId } from "../ui/materialShapes";
import { ThickHorizontalRule } from "../editor/horizontalRule";
import { RuleThicknessMenu } from "./RuleThicknessMenu";
import { createPortal } from "react-dom";
import { placeMenu } from "../ui/placeMenu";
import { recentColorsRow, rememberColor } from "../ui/recentColors";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { CodeBlockLowlight } from "@tiptap/extension-code-block-lowlight";
import Highlight from "@tiptap/extension-highlight";
import FindAndReplace from "@tiptap/extension-find-and-replace";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import TextAlign from "@tiptap/extension-text-align";
import { TableKit } from "@tiptap/extension-table";
import type { ChainedCommands } from "@tiptap/core";
import { Color, FontFamily, TextStyle } from "@tiptap/extension-text-style";
import { Extension, Node, mergeAttributes } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { EditorContent, NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer, useEditor, type NodeViewProps } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import bash from "highlight.js/lib/languages/bash";
import css from "highlight.js/lib/languages/css";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import markdown from "highlight.js/lib/languages/markdown";
import powershell from "highlight.js/lib/languages/powershell";
import python from "highlight.js/lib/languages/python";
import rust from "highlight.js/lib/languages/rust";
import sql from "highlight.js/lib/languages/sql";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import { createLowlight } from "lowlight";
import { Ban, BookOpen, ChevronDown, ChevronRight, ClipboardPaste, ClipboardType, Copy, Eraser, Highlighter, Palette, PlusCircle, Scissors, Table2, X } from "lucide-react";
import { api, errorMessage } from "../api/commands";
import type {
  AppSettings,
  ExportFormat,
  LineSpacing,
  NoteDetail,
  PaperColor,
  SaveReceipt,
  SaveStatus,
  NoteContent,
  TiptapDocument,
} from "../api/types";
import { DICTIONARY_LANGUAGES, EDITOR_FONTS, COLLAPSIBLE_COLORS, toHex, editorLeadingPx, fontCss } from "../options";
import { CodeBlockView } from "./CodeBlockView";
import { EditorToolbar, showAnchoredPopover } from "./EditorToolbar";
import { MultiSelection, clearTextSelections, runForTextSelections } from "../editor/multiSelection";
import { SpellcheckDecorations, setSpellcheckRanges, wordsInDocument } from "../editor/spellcheck";
import { HeadingFold } from "../editor/headingFold";
import { checkRuledLines, computeBaselineShifts, type RuledLineError } from "../editor/ruledLines";

const lowlight = createLowlight();
lowlight.register("bash", bash);
lowlight.register("powershell", powershell);
lowlight.register("javascript", javascript);
lowlight.register("jsx", javascript);
lowlight.register("typescript", typescript);
lowlight.register("tsx", typescript);
lowlight.register("html", xml);
lowlight.register("css", css);
lowlight.register("json", json);
lowlight.register("rust", rust);
lowlight.register("python", python);
lowlight.register("sql", sql);
lowlight.register("markdown", markdown);

const CodeBlock = CodeBlockLowlight.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockView);
  },
  addKeyboardShortcuts() {
    return {
      Tab: () => {
        if (!this.editor.isActive(this.name)) return false;
        return this.editor.commands.insertContent("  ");
      },
      "Shift-Tab": () => {
        if (!this.editor.isActive(this.name)) return false;
        return this.editor.commands.command(({ state, tr }) => {
          const { from, empty } = state.selection;
          if (!empty || from < 2) return false;
          const before = state.doc.textBetween(Math.max(0, from - 2), from);
          const spaces = before.endsWith("  ") ? 2 : before.endsWith(" ") ? 1 : 0;
          if (spaces === 0) return false;
          tr.delete(from - spaces, from);
          return true;
        });
      },
    };
  },
}).configure({ lowlight, defaultLanguage: "plaintext" });

const VerticalAlign = Extension.create({
  name: "verticalAlign",
  addGlobalAttributes() {
    return [{
      types: ["textStyle"],
      attributes: {
        verticalAlign: {
          default: null,
          parseHTML: (element) => element.style.verticalAlign || null,
          renderHTML: (attributes) => attributes.verticalAlign
            ? { style: `vertical-align: ${attributes.verticalAlign}` }
            : {},
        },
      },
    }];
  },
});

const FontSize = Extension.create({
  name: "fontSize",
  addGlobalAttributes() {
    return [{
      types: ["textStyle"],
      attributes: {
        fontSize: {
          default: null,
          parseHTML: (element) => element.style.fontSize || null,
          renderHTML: (attributes) => attributes.fontSize
            ? { style: `font-size: ${attributes.fontSize}` }
            : {},
        },
      },
    }];
  },
});

// Inside a list Tab/Shift-Tab are always consumed: when the item cannot move
// (first item, top level) nothing happens instead of focus leaving the editor.
const ListKeyboard = Extension.create({
  name: "listKeyboard",
  addKeyboardShortcuts() {
    const moveItem = (direction: "sink" | "lift") => {
      const type = this.editor.isActive("taskItem") ? "taskItem" : this.editor.isActive("listItem") ? "listItem" : null;
      if (!type) return false;
      if (direction === "sink") this.editor.commands.sinkListItem(type);
      else this.editor.commands.liftListItem(type);
      return true;
    };
    return {
      Tab: () => moveItem("sink"),
      "Shift-Tab": () => moveItem("lift"),
    };
  },
});

const CollapsibleBlock = Node.create({
  name: "collapsibleBlock",
  group: "block",
  content: "block+",
  defining: true,
  isolating: true,
  draggable: true,
  addAttributes() {
    return {
      title: { default: "Sezione" },
      open: { default: true, parseHTML: (element) => element.getAttribute("open") !== "false" },
      color: { default: null, parseHTML: (element) => COLLAPSIBLE_COLORS.find((item) => item.id === element.getAttribute("color"))?.id ?? null },
    };
  },
  parseHTML() {
    return [{ tag: "section[data-collapsible-block]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["section", mergeAttributes(HTMLAttributes, { "data-collapsible-block": "" }), 0];
  },
  addNodeView() {
    return ReactNodeViewRenderer(CollapsibleBlockView);
  },
});

function CollapsibleBlockView({ node, updateAttributes, selected, editor, getPos, deleteNode }: NodeViewProps) {
  const headerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [clipboardError, setClipboardError] = useState("");
  const color = COLLAPSIBLE_COLORS.find((item) => item.id === node.attrs.color);
  const openMenu = () => {
    if (!editor.isEditable) return;
    setClipboardError("");
    showAnchoredPopover(headerRef.current, menuRef.current);
    requestAnimationFrame(() => menuRef.current?.querySelector<HTMLButtonElement>("button")?.focus());
  };
  const cut = async () => {
    const pos = getPos();
    if (pos === undefined) return;
    try {
      const { dom, text } = editor.view.serializeForClipboard(editor.state.doc.slice(pos, pos + node.nodeSize));
      await navigator.clipboard.write([new ClipboardItem({
        "text/html": new Blob([dom.innerHTML], { type: "text/html" }),
        "text/plain": new Blob([text], { type: "text/plain" }),
      })]);
      if (editor.isDestroyed) return;
      const currentPos = getPos();
      if (currentPos === undefined || !editor.state.doc.nodeAt(currentPos)?.eq(node)) return;
      menuRef.current?.hidePopover();
      deleteNode();
      editor.commands.focus();
    } catch (cause) {
      setClipboardError(`Non è possibile tagliare il blocco: ${errorMessage(cause)}`);
    }
  };
  const open = node.attrs.open as boolean;
  const toggle = () => updateAttributes({ open: !open });
  return (
    <NodeViewWrapper className={`collapsible-block${selected ? " ProseMirror-selectednode" : ""}`} data-open={open}>
      <div
        ref={headerRef}
        className="collapsible-header"
        style={color ? { background: color.swatch } : undefined}
        onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); openMenu(); }}
        contentEditable={false}
        role="button"
        tabIndex={0}
        aria-label={open ? "Nascondi contenuto" : "Mostra contenuto"}
        aria-expanded={open}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          if (event.target instanceof HTMLInputElement && document.activeElement === event.target) return;
          toggle();
        }}
        onKeyDown={(event) => {
          if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) { event.preventDefault(); openMenu(); return; }
          if (event.target !== event.currentTarget || (event.key !== "Enter" && event.key !== " ")) return;
          event.preventDefault();
          toggle();
        }}
      >
        <input readOnly={!editor.isEditable} aria-label="Titolo blocco a scomparsa" value={String(node.attrs.title ?? "Sezione")} maxLength={200} onChange={(event) => updateAttributes({ title: event.target.value || "Sezione" })} />
        <span className="collapsible-chevron" aria-hidden="true">{open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</span>
      </div>
      <div ref={menuRef} className="paper-color-popover collapsible-menu" popover="auto" role="menu" aria-label="Azioni blocco a scomparsa" contentEditable={false} onPointerDown={(event) => event.stopPropagation()}>
        <button type="button" role="menuitem" onClick={cut}>Taglia</button>
        <button type="button" role="menuitem" onClick={() => { menuRef.current?.hidePopover(); deleteNode(); }}>Elimina</button>
        <details><summary>Cambia colore</summary><div className="context-color-row">{COLLAPSIBLE_COLORS.map((item) => <button key={item.id} type="button" aria-label={item.label} title={item.label} style={{ "--context-color": item.swatch } as React.CSSProperties} onClick={() => { updateAttributes({ color: item.id }); menuRef.current?.hidePopover(); }} />)}</div></details>
        {clipboardError && <p role="alert">{clipboardError}</p>}
      </div>
      <NodeViewContent className="collapsible-content" />
    </NodeViewWrapper>
  );
}

const extensions = [
  StarterKit.configure({ codeBlock: false, horizontalRule: false, heading: { levels: [1, 2, 3] } }),
  Highlight.extend({
    addAttributes() { return { color: { default: null, parseHTML: el => toHex(el.getAttribute("data-color") || el.style.backgroundColor), renderHTML: a => a.color ? { "data-color": a.color, style: `background-color: ${a.color}; --tn-highlight: ${a.color}; color: inherit` } : {} } }; },
  }).configure({ multicolor: true }),
  ThickHorizontalRule,
  ImageNode,
  TaskList,
  TaskItem.configure({ nested: true }),
  CodeBlock,
  CollapsibleBlock,
  TableKit.configure({ table: { resizable: true } }),
  TextStyle,
  FontSize,
  Color.extend({
    addGlobalAttributes() { return [{ types: ["textStyle"], attributes: { color: { default: null, parseHTML: el => toHex(el.style.color), renderHTML: a => a.color ? { style: `color: ${a.color}; --tn-color: ${a.color}` } : {} } } }]; },
  }).configure({ types: ["textStyle"] }),
  FontFamily.configure({ types: ["textStyle"] }),
  TextAlign.configure({ types: ["heading", "paragraph"], alignments: ["left", "center", "right", "justify"] }),
  VerticalAlign,
  ListKeyboard,
  MultiSelection,
  SpellcheckDecorations,
  HeadingFold,
  FindAndReplace.configure({ injectCSS: false, searchDebounceMs: 100 }),
];

/** Headings, title and collapsible titles use the Material type scale (Roboto), whatever the body font. */
const HEADING_FONT = 'Roboto, "Segoe UI", sans-serif';

const noteViewStates = new Map<number, { scrollTop: number; from: number; to: number }>();

export interface NoteEditorHandle {
  flush: () => Promise<boolean>;
}

export interface SavedDraft {
  bulletShape: ShapeId | null;
  checkboxShape: ShapeId | null;
  title: string;
  subtitle: string;
  paperColor: PaperColor;
  lineSpacing: LineSpacing;
  paperWidth: number;
  content: NoteContent;
}

export interface NoteEditorProps {
  note: NoteDetail;
  settings: AppSettings;
  readOnly?: boolean;
  onSaved: (receipt: SaveReceipt, draft: SavedDraft) => void;
  onSaveStatus: (status: SaveStatus, message?: string) => void;
  onArchive: () => void;
  onTrash: () => void;
  onRestore: () => void;
  onToggleAttention: () => void;
  onExport: (format: ExportFormat) => void;
  onSettingsChange: (settings: Partial<AppSettings>) => void;
  onError: (message: string) => void;
}

export const NoteEditor = forwardRef<NoteEditorHandle, NoteEditorProps>(function NoteEditor(
  {
    note,
    settings,
    readOnly = false,
    onSaved,
    onSaveStatus,
    onArchive,
    onTrash,
    onRestore,
    onToggleAttention,
    onExport,
    onSettingsChange,
    onError,
  },
  ref,
) {
  const [checkboxShape, setCheckboxShape] = useState(note.checkboxShape);
  const shapesRef = useRef({ bulletShape: note.bulletShape, checkboxShape: note.checkboxShape });
  const [title, setTitle] = useState(note.title);
  const [subtitle, setSubtitle] = useState(note.subtitle);
  const [paperColor, setPaperColor] = useState(note.paperColor);
  const [lineSpacing, setLineSpacing] = useState(note.lineSpacing);
  const [paperWidth, setPaperWidth] = useState(note.paperWidth);
  const [ruleThickness, setRuleThickness] = useState(1);
  const [ruleMenu, setRuleMenu] = useState<{ x: number; y: number; pos: number } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; selectionMisspelled: string[]; word: string; misspelled: boolean; suggestions: string[]; from: number; to: number } | null>(null);
  const [findOpen, setFindOpen] = useState(false);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const debugLines = import.meta.env.DEV && (new URLSearchParams(window.location.search).has("debugLines") || localStorage.getItem("debugRuledLines") === "1");
  const [shifts, setShifts] = useState({ body: 0, h1: 0, h2: 0, h3: 0, collapsible: 0, code: 0 });
  const [lineErrors, setLineErrors] = useState<RuledLineError[]>([]);
  const outlineOpenRef = useRef(false);
  const [headings, setHeadings] = useState<HeadingItem[]>([]);
  const titleRef = useRef(note.title);
  const subtitleRef = useRef(note.subtitle);
  const paperColorRef = useRef(note.paperColor);
  const lineSpacingRef = useRef(note.lineSpacing);
  const paperWidthRef = useRef(note.paperWidth);
  const revisionRef = useRef(note.revision);
  // App renders NoteEditor only for text notes.
  const contentRef = useRef(note.content as TiptapDocument);
  const changeVersionRef = useRef(0);
  const savedVersionRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const queueRef = useRef<Promise<boolean>>(Promise.resolve(true));
  const paperScrollRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLElement>(null);
  const spellTimerRef = useRef<number | null>(null);
  const spellRequestRef = useRef(0);
  const spellEnabledRef = useRef(settings.spellcheck);
  const spellLanguageRef = useRef(settings.dictionaryLanguage);
  const ignoredWordsRef = useRef<Set<string>>(new Set());
  const spellingSuggestionsRef = useRef<Record<string, string[]>>({});
  const misspelledWordsRef = useRef<Set<string>>(new Set());

  const knownAttachments = useRef(new Set(note.attachments.map(a => a.id)));
  const pendingUploads = useRef(new Set<Promise<void>>());
  const pendingCopies = useRef(new Map<number, Promise<void>>());
  const editor = useEditor({
    extensions,
    content: editorDocument(contentRef.current),
    editable: !readOnly,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "note-prose",
        spellcheck: "false",
        lang: DICTIONARY_LANGUAGES.find((item) => item.id === settings.dictionaryLanguage)?.locale ?? "it-IT",
        "aria-label": "Contenuto della nota",
      },
      handlePaste: (_view, event) => {
        if (readOnly) return false;
        const files = [...event.clipboardData?.files ?? []].filter(f => f.type.startsWith("image/"));
        if (!files.length) return false;
        void insertImages(files); return true;
      },
      handleDOMEvents: {
        mousedown: (view, event) => {
          const mouse = event as MouseEvent;
          if (mouse.button !== 2 || view.state.selection.empty) return false;
          const position = view.posAtCoords({ left: mouse.clientX, top: mouse.clientY })?.pos;
          if (position === undefined || position < view.state.selection.from || position > view.state.selection.to) return false;
          event.preventDefault();
          return true;
        },
        contextmenu: (view, event) => {
          if (readOnly) return false;
          event.preventDefault();
          const mouse = event as MouseEvent;
          const hr = (event.target as HTMLElement).closest("hr");
          if (hr) { setRuleMenu({ x: mouse.clientX, y: mouse.clientY, pos: view.posAtDOM(hr, 0) }); setContextMenu(null); return true; }
          setRuleMenu(null);
          // Table actions follow the caret: a right-click in a cell moves it there unless the click is inside the selection.
          if ((event.target as HTMLElement).closest("td, th")) {
            const pos = view.posAtCoords({ left: mouse.clientX, top: mouse.clientY })?.pos;
            const { from, to } = view.state.selection;
            if (pos !== undefined && (pos < from || pos > to)) view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, pos)));
          }
          const word = contextWord(view, mouse.clientX, mouse.clientY);
          const { from, to } = view.state.selection;
          const normalized = word.toLocaleLowerCase(spellLanguageRef.current);
          setContextMenu({
            x: mouse.clientX,
            y: mouse.clientY,
            selectionMisspelled: editor && from !== to ? [...new Set(wordsInDocument(editor, { from, to }).map(w => w.word.toLocaleLowerCase(spellLanguageRef.current)).filter(w => misspelledWordsRef.current.has(w)))] : [],
            word,
            misspelled: misspelledWordsRef.current.has(normalized),
            suggestions: spellingSuggestionsRef.current[normalized] ?? [],
            from,
            to,
          });
          return true;
        },
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      if (readOnly) return;
      currentEditor.state.doc.descendants(node => {
        if (node.type.name !== "image") return;
        const id = Number(node.attrs.attachmentId);
        if (knownAttachments.current.has(id) || pendingCopies.current.has(id)) return;
        const copy = api.copyAttachment(id, note.id).then(meta => {
          knownAttachments.current.add(meta.id);
          if (currentEditor.isDestroyed || !currentEditor.isEditable) return;
          const tr = currentEditor.state.tr;
          currentEditor.state.doc.descendants((image, pos) => { if (image.type.name === "image" && image.attrs.attachmentId === id) tr.setNodeMarkup(pos, undefined, { ...image.attrs, attachmentId: meta.id }); });
          currentEditor.view.dispatch(tr);
        }).catch(cause => { onError(`Immagine non copiata: ${errorMessage(cause)}`); throw cause; }).finally(() => pendingCopies.current.delete(id));
        pendingCopies.current.set(id, copy);
        void copy.catch(() => {});
      });
      const json = currentEditor.getJSON();
      contentRef.current = persistedDocument(json);
      if (outlineOpenRef.current) setHeadings(extractHeadings(json));
      queueSpellcheck(currentEditor);
      markDirty();
    },
  });

  useEffect(() => {
    // emitUpdate=false: otherwise TipTap fires onUpdate and merely opening a note saves it.
    editor?.setEditable(!readOnly, false);
  }, [editor, readOnly]);

  useEffect(() => {
    spellEnabledRef.current = settings.spellcheck;
    spellLanguageRef.current = settings.dictionaryLanguage;
    if (!editor) return;
    editor.view.dom.setAttribute("lang", DICTIONARY_LANGUAGES.find((item) => item.id === settings.dictionaryLanguage)?.locale ?? "it-IT");
    queueSpellcheck(editor);
    if (!settings.spellcheck) setSpellcheckRanges(editor, []);
    return () => {
      if (spellTimerRef.current !== null) window.clearTimeout(spellTimerRef.current);
    };
  }, [editor, settings.dictionaryLanguage, settings.spellcheck]);

  useEffect(() => {
    if (!editor) return;
    const saved = noteViewStates.get(note.id);
    let cancelled = false;
    const restore = () => {
      if (!cancelled && saved) paperScrollRef.current?.scrollTo({ top: saved.scrollTop, behavior: "instant" });
    };
    if (saved) editor.commands.setTextSelection({ from: Math.min(saved.from, editor.state.doc.content.size), to: Math.min(saved.to, editor.state.doc.content.size) });
    const frame = requestAnimationFrame(restore);
    void document.fonts.ready.then(restore);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      noteViewStates.set(note.id, {
        scrollTop: noteViewStates.get(note.id)?.scrollTop ?? saved?.scrollTop ?? 0,
        from: editor.state.selection.from,
        to: editor.state.selection.to,
      });
    };
  }, [editor, note.id]);

  useEffect(() => {
    if (!editor || readOnly) return;
    const handleFind = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        setFindOpen(true);
      }
      if (event.key === "Escape" && findOpen) {
        editor.commands.clearSearch();
        setFindOpen(false);
      }
    };
    window.addEventListener("keydown", handleFind);
    return () => window.removeEventListener("keydown", handleFind);
  }, [editor, findOpen, readOnly]);

  useEffect(() => {
    let cancelled = false;
    const bodyFont = fontCss(settings.editorFont, "editor");
    const monoFont = fontCss(settings.monospaceFont, "mono");
    void Promise.all([
      document.fonts.load(`${settings.editorFontSize}px ${bodyFont}`),
      document.fonts.load(`${settings.editorFontSize * 1.75}px ${HEADING_FONT}`),
      document.fonts.load(`500 14px ${HEADING_FONT}`),
      document.fonts.load(`${settings.editorFontSize * .85}px ${monoFont}`),
    ]).then(() => {
      if (!cancelled) setShifts(computeBaselineShifts({ leading: editorLeadingPx(lineSpacing, settings.editorFontSize), bodyFont, headingFont: HEADING_FONT, monoFont, fontSize: settings.editorFontSize }));
    });
    return () => { cancelled = true; };
  }, [lineSpacing, settings.editorFont, settings.editorFontSize, settings.monospaceFont]);

  useEffect(() => {
    if (!import.meta.env.DEV || !editor) return;
    const root = paperRef.current;
    if (!root) return;
    let timer: number;
    const inspect = () => {
      const errors = checkRuledLines(root);
      if (debugLines) {
        setLineErrors(errors);
        if (errors.length) console.table(errors);
      }
      return errors;
    };
    const schedule = () => { window.clearTimeout(timer); timer = window.setTimeout(inspect, 120); };
    const devWindow = window as Window & { __checkRuledLines?: () => RuledLineError[] };
    devWindow.__checkRuledLines = inspect;
    editor.on("update", schedule);
    window.addEventListener("resize", schedule);
    schedule();
    return () => { window.clearTimeout(timer); editor.off("update", schedule); window.removeEventListener("resize", schedule); delete devWindow.__checkRuledLines; };
  }, [editor, shifts, lineSpacing, settings.editorFont, settings.editorFontSize, debugLines]);

  useEffect(() => {
    if (!contextMenu && !ruleMenu) return;
    const close = () => { setContextMenu(null); setRuleMenu(null); };
    const keydown = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    window.addEventListener("keydown", keydown);
    window.addEventListener("pointerdown", close, { once: true });
    window.addEventListener("blur", close, { once: true });
    return () => { window.removeEventListener("keydown", keydown); window.removeEventListener("pointerdown", close); window.removeEventListener("blur", close); };
  }, [contextMenu, ruleMenu]);

  useEffect(() => {
    outlineOpenRef.current = outlineOpen;
    if (outlineOpen) setHeadings(extractHeadings(editorDocument(contentRef.current)));
  }, [outlineOpen]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (spellTimerRef.current !== null) window.clearTimeout(spellTimerRef.current);
      // Edits typed after the parent's flush (while it switches note) are still saved.
      if (savedVersionRef.current < changeVersionRef.current) void enqueueSave();
      else if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  function queueSpellcheck(currentEditor: NonNullable<typeof editor>) {
    if (spellTimerRef.current !== null) window.clearTimeout(spellTimerRef.current);
    if (!spellEnabledRef.current) {
      spellingSuggestionsRef.current = {};
      misspelledWordsRef.current = new Set();
      setSpellcheckRanges(currentEditor, []);
      return;
    }
    spellTimerRef.current = window.setTimeout(() => {
      const ranges = wordsInDocument(currentEditor);
      const language = spellLanguageRef.current;
      const requestId = ++spellRequestRef.current;
      const words = [...new Set(ranges.map((range) => range.word))];
      void api.checkSpelling(language, words, [...ignoredWordsRef.current]).then((misspelled) => {
        if (requestId !== spellRequestRef.current) return;
        const suggestions = Object.fromEntries(misspelled.map((item) => [item.word, item.suggestions]));
        const incorrect = new Set(misspelled.map((item) => item.word));
        const misspellings = ranges.filter((range) => incorrect.has(range.word.toLocaleLowerCase(language)));
        spellingSuggestionsRef.current = suggestions;
        misspelledWordsRef.current = incorrect;
        setSpellcheckRanges(currentEditor, misspellings);
      }).catch((cause) => {
        if (requestId !== spellRequestRef.current) return;
        spellingSuggestionsRef.current = {};
        misspelledWordsRef.current = new Set();
        setSpellcheckRanges(currentEditor, []);
        onError(`Controllo ortografico non disponibile: ${errorMessage(cause)}`);
      });
    }, 220);
  }

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
      try { await Promise.all(pendingUploads.current); await Promise.all(pendingCopies.current.values()); } catch { return false; }
      while (savedVersionRef.current < changeVersionRef.current) {
        const targetVersion = changeVersionRef.current;
        const snapshot: SavedDraft = {
          ...shapesRef.current,
          title: titleRef.current.trim() || "Senza titolo",
          subtitle: subtitleRef.current.trim(),
          paperColor: paperColorRef.current,
          lineSpacing: lineSpacingRef.current,
          paperWidth: paperWidthRef.current,
          content: contentRef.current,
        };
        onSaveStatus("saving");
        try {
          const receipt = await api.saveNote({
            id: note.id,
            ...snapshot,
            expectedRevision: revisionRef.current,
          });
          revisionRef.current = receipt.revision;
          savedVersionRef.current = targetVersion;
          onSaved(receipt, snapshot);
        } catch (cause) {
          onSaveStatus("error", errorMessage(cause));
          // Retry on its own: a transient failure must not wait for the next keystroke.
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

  const updateTitle = (value: string) => {
    setTitle(value);
    titleRef.current = value;
    markDirty();
  };
  const updateSubtitle = (value: string) => {
    setSubtitle(value);
    subtitleRef.current = value;
    markDirty();
  };
  const updatePaperColor = (value: PaperColor) => {
    setPaperColor(value);
    paperColorRef.current = value;
    markDirty();
  };
  const updateLineSpacing = (value: LineSpacing) => {
    setLineSpacing(value);
    lineSpacingRef.current = value;
    markDirty();
  };
  const updatePaperWidth = (value: number) => {
    const width = Math.min(1280, Math.max(720, Math.round(value)));
    setPaperWidth(width);
    paperWidthRef.current = width;
    markDirty();
  };

  const resizePaperWithKeyboard = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    updatePaperWidth(paperWidthRef.current + (event.key === "ArrowLeft" ? -40 : 40));
  };

  const beginPaperResize = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const startX = event.clientX;
    const startWidth = paperWidthRef.current;
    const onMove = (move: PointerEvent) => updatePaperWidth(startWidth + (move.clientX - startX) * 2);
    const onUp = () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
  };

  function insertImages(files: File[]): Promise<void> {
    if (!editor || readOnly || !editor.isEditable) return Promise.resolve();
    const currentEditor = editor;
    const upload = (async () => {
      for (const file of files) {
        try {
          if (file.size > 20 * 1024 * 1024) throw new Error("L'immagine supera 20 MB.");
          const meta = await api.addAttachment(note.id, new Uint8Array(await file.arrayBuffer()));
          knownAttachments.current.add(meta.id);
          if (currentEditor.isDestroyed || !currentEditor.isEditable) return;
          currentEditor.chain().focus().insertContent({ type: "image", attrs: { attachmentId: meta.id, alt: file.name.slice(0, 300) } }).run();
        } catch (cause) { onError(`Immagine non inserita: ${errorMessage(cause)}`); }
      }
    })();
    pendingUploads.current.add(upload);
    void upload.finally(() => pendingUploads.current.delete(upload));
    return upload;
  }

  const addCustomColor = (hex: string) => onSettingsChange({ customColors: [hex, ...settings.customColors.filter(c => c !== hex)].slice(0, 10) });

  if (!editor) return <div className="editor-loading">Preparazione della nota...</div>;

  return (
    <section className="editor-panel">
      <EditorToolbar
        editor={editor}
        onInsertImages={files => void insertImages(files)}
        ruleThickness={ruleThickness}
        onRuleThicknessChange={setRuleThickness}
        checkboxShape={checkboxShape ?? settings.checkboxShape}
        noteId={note.id}
        onShapeChange={(id, global) => {
          if (global && id) onSettingsChange({ checkboxShape: id });
          else { shapesRef.current.checkboxShape = id; setCheckboxShape(id); markDirty(); }
        }}
        customColors={settings.customColors}
        onAddCustom={addCustomColor}
        dark={settings.theme === "dark"}
        lineSpacing={lineSpacing}
        paperColor={paperColor}
        readOnly={readOnly}
        defaultExportFormat={settings.defaultExportFormat}
        onLineSpacingChange={updateLineSpacing}
        onPaperColorChange={updatePaperColor}
        onArchive={onArchive}
        onTrash={onTrash}
        onRestore={onRestore}
        trashed={note.trashedAt !== null}
        needsAttention={note.needsAttention}
        onToggleAttention={onToggleAttention}
        onExport={onExport}
        editorFont={settings.editorFont}
        editorFontSize={settings.editorFontSize}
        findOpen={findOpen}
        outlineOpen={outlineOpen}
        onFindOpenChange={setFindOpen}
        onToggleOutline={() => setOutlineOpen((current) => !current)}
        onEditorFontChange={(editorFont) => onSettingsChange({ editorFont })}
        onEditorFontSizeChange={(editorFontSize) => onSettingsChange({ editorFontSize })}
      />
      <div className="editor-body">
      <div ref={paperScrollRef} className="paper-scroll thin-scrollbar" onScroll={(event) => noteViewStates.set(note.id, { scrollTop: event.currentTarget.scrollTop, from: editor?.state.selection.from ?? 1, to: editor?.state.selection.to ?? 1 })}>
        <article
          ref={paperRef}
          className={`paper paper-${paperColor}${readOnly ? " is-readonly" : ""}`}
          style={{ "--checkbox-clip": `url(#m3-${checkboxShape ?? settings.checkboxShape})`, "--editor-leading": `${editorLeadingPx(lineSpacing, settings.editorFontSize)}px`, "--paper-width": `${paperWidth}px`, "--shift-body": `${shifts.body}px`, "--shift-h1": `${shifts.h1}px`, "--shift-h2": `${shifts.h2}px`, "--shift-h3": `${shifts.h3}px`, "--shift-collapsible": `${shifts.collapsible}px`, "--shift-code": `${shifts.code}px` } as React.CSSProperties}
        >
          <div className="paper-margin" aria-hidden="true" />
          <div className="paper-content">
            <input
              className="note-title"
              value={title}
              readOnly={readOnly}
              aria-label="Titolo della nota"
              placeholder="Senza titolo"
              onChange={(event) => updateTitle(event.target.value)}
            />
            <input
              className="note-subtitle"
              value={subtitle}
              readOnly={readOnly}
              aria-label="Sottotitolo della nota"
              placeholder="Aggiungi un sottotitolo"
              onChange={(event) => updateSubtitle(event.target.value)}
            />
            <div className="note-meta">
              {readOnly ? (note.trashedAt !== null ? "Nel Cestino dal" : "Archiviata") : "Ultima modifica"} {longDate(readOnly ? note.trashedAt ?? note.archivedAt ?? note.updatedAt : note.updatedAt)}
              {readOnly && note.originFolderName ? ` · Cartella: ${note.originFolderName}` : ""}
            </div>
            <div className="paper-body">
              <EditorContent editor={editor} />
            </div>
          </div>
          {debugLines && lineErrors.length > 0 && <div className="ruled-line-overlay" aria-hidden="true">{lineErrors.map((error, index) => <span key={index} style={{ top: `${(paperRef.current?.querySelector(".paper-body")?.getBoundingClientRect().top ?? 0) - (paperRef.current?.getBoundingClientRect().top ?? 0) + error.actual - 8}px` }} title={`${error.block}: ${error.text}`} />)}</div>}
          {!readOnly && <button type="button" className="paper-resize-handle" title={`Larghezza foglio: ${paperWidth} px (trascina o usa le frecce)`} aria-label={`Ridimensiona il foglio, larghezza attuale ${paperWidth} pixel. Usa le frecce sinistra e destra.`} onPointerDown={beginPaperResize} onKeyDown={resizePaperWithKeyboard} />}
        </article>
      </div>
      {outlineOpen && <aside className="note-outline-drawer" aria-label="In questa nota"><header><BookOpen size={16} /><strong>In questa nota</strong><button type="button" aria-label="Chiudi indice" onClick={() => setOutlineOpen(false)}><X size={15} /></button></header>{headings.length ? <nav><OutlineBranch headings={headings} onOpen={(index) => openOutlineHeading(editor, index, paperScrollRef.current)} /></nav> : <p>Aggiungi un titolo H1, H2 o H3 per creare l’indice.</p>}</aside>}
      </div>
      {ruleMenu && createPortal(<div className="paper-color-popover rule-context-menu" role="menu" style={placeMenu(ruleMenu.x, ruleMenu.y, 180, 260)} onPointerDown={e => e.stopPropagation()}><RuleThicknessMenu value={Number(editor.state.doc.nodeAt(ruleMenu.pos)?.attrs.thickness ?? 1)} onSelect={n => { const node = editor.state.doc.nodeAt(ruleMenu.pos); if (node?.type.name === "horizontalRule") editor.view.dispatch(editor.state.tr.setNodeMarkup(ruleMenu.pos, undefined, { ...node.attrs, thickness: n })); setRuleThickness(n); setRuleMenu(null); }} /></div>, document.body)}
      {contextMenu && <EditorContextMenu noteId={note.id} onInsertImages={insertImages} onIgnoreMany={words => { words.forEach(word => ignoredWordsRef.current.add(word)); queueSpellcheck(editor); }} editor={editor} menu={contextMenu} settings={settings} onError={onError} onIgnore={(word) => { ignoredWordsRef.current.add(word.toLocaleLowerCase(settings.dictionaryLanguage)); queueSpellcheck(editor); }} onAddDictionary={async (word) => { await api.addDictionaryWord(settings.dictionaryLanguage, word); queueSpellcheck(editor); }} onClose={() => setContextMenu(null)} />}
    </section>
  );
});

function EditorContextMenu({ noteId, onInsertImages, editor, menu, settings, onIgnoreMany, onError, onIgnore, onAddDictionary, onClose }: {
  noteId: number;
  editor: NonNullable<ReturnType<typeof useEditor>>;
  menu: { x: number; y: number; selectionMisspelled: string[]; word: string; misspelled: boolean; suggestions: string[]; from: number; to: number };
  settings: AppSettings;
  onError: (message: string) => void;
  onInsertImages: (files: File[]) => Promise<void>;
  onIgnoreMany: (words: string[]) => void;
  onIgnore: (word: string) => void;
  onAddDictionary: (word: string) => Promise<void>;
  onClose: () => void;
}) {
  const [selectionFontSize, setSelectionFontSize] = useState(() => {
    const value = Number.parseInt(String(editor.getAttributes("textStyle").fontSize ?? ""), 10);
    return Number.isFinite(value) ? value : settings.editorFontSize;
  });
  const changeSelectionFontSize = (delta: number) => {
    const value = Math.min(28, Math.max(12, selectionFontSize + delta));
    setSelectionFontSize(value);
    runForTextSelections(editor, () => {
      editor.chain().focus().setMark("textStyle", { fontSize: `${value}px` }).run();
    });
  };
  const runClipboardCommand = (command: "cut" | "copy") => {
    editor.chain().focus().setTextSelection({ from: menu.from, to: menu.to }).run();
    document.execCommand(command);
    onClose();
  };
  const paste = async (plainText: boolean) => {
    try {
      let content = "";
      if (!plainText && navigator.clipboard.read) {
        const items = await navigator.clipboard.read();
        const images: File[] = [];
        for (const item of items) { const type = item.types.find(t => t.startsWith("image/")); if (type) images.push(new File([await item.getType(type)], "Immagine incollata", { type })); }
        if (images.length) { await onInsertImages(images); return; }
        const rich = items.find((item) => item.types.includes("text/html"));
        if (rich) content = await (await rich.getType("text/html")).text();
      }
      if (!content) content = await navigator.clipboard.readText();
      if (plainText) editor.chain().focus().insertContent({ type: "text", text: content }).run();
      else editor.chain().focus().insertContent(content).run();
    } catch (cause) {
      onError(`Non è possibile incollare: ${errorMessage(cause)}`);
    } finally {
      onClose();
    }
  };
  const [selectionFont, setSelectionFont] = useState(() => EDITOR_FONTS.find((font) => font.label === editor.getAttributes("textStyle").fontFamily)?.id ?? settings.editorFont);
  const language = DICTIONARY_LANGUAGES.find((item) => item.id === settings.dictionaryLanguage)?.label ?? "Italiano";
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(placeMenu(menu.x, menu.y, 300, 500));
  useLayoutEffect(() => {
    const place = () => { const el = menuRef.current; if (el) setPosition(placeMenu(menu.x, menu.y, el.offsetWidth, el.scrollHeight)); };
    place(); window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [menu]);
  return createPortal(
    <div ref={menuRef} className="editor-context-menu" style={position} role="menu" onPointerDown={(event) => event.stopPropagation()}>
      <div className="context-clipboard">
        <button type="button" aria-label="Taglia" title="Taglia" onClick={() => runClipboardCommand("cut")}><Scissors size={22} /></button>
        <button type="button" aria-label="Copia" title="Copia" onClick={() => runClipboardCommand("copy")}><Copy size={22} /></button>
        <button type="button" aria-label="Incolla" title="Incolla" onClick={() => void paste(false)}><ClipboardPaste size={22} /></button>
        <button type="button" aria-label="Incolla solo testo" title="Solo testo" onClick={() => void paste(true)}><ClipboardType size={22} /></button>
        {menu.from !== menu.to && <button type="button" aria-label="Deseleziona" title="Deseleziona" onClick={() => { editor.chain().focus().setTextSelection(menu.to).run(); clearTextSelections(editor); onClose(); }}><X size={22} /></button>}
      </div>
      {menu.selectionMisspelled.length > 0 && <div className="context-correction-actions"><button type="button" onClick={() => { onIgnoreMany(menu.selectionMisspelled); onClose(); }}><Ban size={19} />Ignora {menu.selectionMisspelled.length} correzioni nella selezione</button></div>}
      {menu.word && menu.misspelled && <section className="context-section context-dictionary"><h3><BookOpen size={17} /> Dizionario {language}: “{menu.word}”</h3>{menu.suggestions.map((word) => <button type="button" className="context-suggestion" key={word} onClick={() => { editor.chain().focus().insertContent(word).run(); onClose(); }}>{word}<ChevronRight size={16} /></button>)}{menu.suggestions.length === 0 && <p>Nessun suggerimento disponibile.</p>}</section>}
      {menu.word && menu.misspelled && <div className="context-correction-actions"><button type="button" onClick={() => { onIgnore(menu.word); onClose(); }}><Ban size={19} /> Ignora correzione</button><button type="button" onClick={() => { void onAddDictionary(menu.word).catch((cause) => onError(`Parola non aggiunta al dizionario: ${errorMessage(cause)}`)).finally(onClose); }}><PlusCircle size={19} /> Aggiungi al dizionario</button></div>}
      {editor.isActive("table") && <section className="context-section context-table">
        <h3><Table2 size={17} /> Tabella</h3>
        <div className="context-format-buttons">{TABLE_ACTIONS.map(([label, command]) => <button key={label} type="button" className={label === "Elimina tabella" ? "danger-text" : undefined} disabled={!command(editor.can().chain().focus()).run()} onClick={() => { command(editor.chain().focus()).run(); onClose(); }}>{label}</button>)}</div>
      </section>}
      <section className="context-section context-formatting">
        <h3><span className="context-aa">AA</span> Formattazione testo</h3>
        <label className="context-field"><span>Font</span><select value={selectionFont} onChange={(event) => { const font = EDITOR_FONTS.find((item) => item.id === event.target.value); if (!font) return; setSelectionFont(font.id); runForTextSelections(editor, () => { editor.chain().focus().setFontFamily(font.label).run(); }); }}>{EDITOR_FONTS.map((font) => <option key={font.id} value={font.id}>{font.label}</option>)}</select></label>
        <div className="context-stepper"><span>Dimensione</span><button type="button" aria-label="Riduci dimensione selezione" onClick={() => changeSelectionFontSize(-1)}>−</button><strong>{selectionFontSize}</strong><button type="button" aria-label="Aumenta dimensione selezione" onClick={() => changeSelectionFontSize(1)}>+</button></div>
        <div className="context-format-buttons"><button type="button" className={editor.isActive("bold") ? "is-active" : ""} onClick={() => runForTextSelections(editor, () => { editor.chain().focus().toggleBold().run(); })}><strong>B</strong> Grassetto</button><button type="button" className={editor.isActive("italic") ? "is-active" : ""} onClick={() => runForTextSelections(editor, () => { editor.chain().focus().toggleItalic().run(); })}><em>I</em> Corsivo</button></div>
        <button type="button" className="context-clear-format" onClick={() => { runForTextSelections(editor, () => { editor.chain().focus().unsetAllMarks().setTextAlign("left").run(); }); onClose(); }}><Eraser size={15} /> Cancella formattazione</button>
      </section>
      <section className="context-section context-colors">{([["text", "Colore testo"], ["highlight", "Evidenziatore"]] as const).map(([kind, label]) => <div key={kind}><h3>{kind === "highlight" ? <Highlighter size={17} /> : <Palette size={17} />}{label}</h3><div className="context-color-row" role="group" aria-label={`${label}: ultimi colori usati`}>{recentColorsRow(kind, noteId, editor.state.doc).map((hex) => <button type="button" key={hex} aria-label={hex} title={hex} data-color={hex} style={{ "--context-color": hex } as React.CSSProperties} onClick={() => { rememberColor(kind, noteId, editor.state.doc, hex); runForTextSelections(editor, () => { const chain = editor.chain().focus(); (kind === "highlight" ? chain.setHighlight({ color: hex }) : chain.setColor(hex)).run(); }); onClose(); }} />)}<button type="button" className="context-color-clear" aria-label={`Ripristina ${label.toLocaleLowerCase("it")}`} title={`Ripristina ${label.toLocaleLowerCase("it")}`} onClick={() => { runForTextSelections(editor, () => { const chain = editor.chain().focus(); (kind === "highlight" ? chain.unsetHighlight() : chain.unsetColor()).run(); }); onClose(); }}><X size={13} /></button></div></div>)}</section>
    </div>, document.body
  );
}

const TABLE_ACTIONS: ReadonlyArray<readonly [string, (chain: ChainedCommands) => ChainedCommands]> = [
  ["Riga sopra", (chain) => chain.addRowBefore()],
  ["Riga sotto", (chain) => chain.addRowAfter()],
  ["Colonna a sinistra", (chain) => chain.addColumnBefore()],
  ["Colonna a destra", (chain) => chain.addColumnAfter()],
  ["Elimina riga", (chain) => chain.deleteRow()],
  ["Elimina colonna", (chain) => chain.deleteColumn()],
  ["Unisci celle", (chain) => chain.mergeCells()],
  ["Dividi cella", (chain) => chain.splitCell()],
  ["Intestazione", (chain) => chain.toggleHeaderRow()],
  ["Elimina tabella", (chain) => chain.deleteTable()],
];

/** Puts the caret on the heading first, so a folded section containing it opens, then scrolls to it. */
function openOutlineHeading(editor: NonNullable<ReturnType<typeof useEditor>>, index: number, scroller: HTMLElement | null) {
  let seen = -1;
  let target: number | null = null;
  editor.state.doc.descendants((node, pos) => {
    if (target !== null) return false;
    if (node.type.name === "heading" && ++seen === index) target = pos + 1;
  });
  if (target !== null) editor.commands.setTextSelection(target);
  requestAnimationFrame(() => scroller?.querySelectorAll(".note-prose h1, .note-prose h2, .note-prose h3")[index]?.scrollIntoView({ behavior: "smooth", block: "center" }));
}

function contextWord(view: EditorView, x: number, y: number): string {
  const { from, to, empty } = view.state.selection;
  if (!empty) {
    const selected = view.state.doc.textBetween(from, to, " ").trim();
    return /^[\p{L}'’-]+$/u.test(selected) ? selected : "";
  }
  const position = view.posAtCoords({ left: x, top: y })?.pos;
  if (position === undefined) return "";
  const resolved = view.state.doc.resolve(position);
  const text = resolved.parent.textContent;
  let start = Math.min(resolved.parentOffset, text.length);
  let end = start;
  while (start > 0 && /[\p{L}'’-]/u.test(text[start - 1]!)) start -= 1;
  while (end < text.length && /[\p{L}'’-]/u.test(text[end]!)) end += 1;
  if (start === end) return "";
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, resolved.start() + start, resolved.start() + end)));
  return text.slice(start, end);
}

interface HeadingItem {
  level: number;
  text: string;
  index: number;
  children: HeadingItem[];
}

function OutlineBranch({ headings, onOpen }: { headings: HeadingItem[]; onOpen: (index: number) => void }) {
  return <ul>{headings.map((heading) => <li key={`${heading.index}-${heading.text}`}><button type="button" className={`heading-level-${heading.level}`} onClick={() => onOpen(heading.index)}>{heading.text}</button>{heading.children.length > 0 && <OutlineBranch headings={heading.children} onOpen={onOpen} />}</li>)}</ul>;
}

function extractHeadings(document: Record<string, unknown>): HeadingItem[] {
  const flat: HeadingItem[] = [];
  const visit = (node: Record<string, unknown>) => {
    if (node.type === "heading") {
      const content = Array.isArray(node.content) ? node.content as Array<Record<string, unknown>> : [];
      flat.push({ level: Number((node.attrs as Record<string, unknown> | undefined)?.level ?? 1), text: content.map((child) => String(child.text ?? "")).join("") || "Titolo senza testo", index: flat.length, children: [] });
    }
    if (Array.isArray(node.content)) (node.content as Array<Record<string, unknown>>).forEach(visit);
  };
  visit(document);
  const roots: HeadingItem[] = [];
  const stack: HeadingItem[] = [];
  for (const heading of flat) {
    while (stack.length && stack.at(-1)!.level >= heading.level) stack.pop();
    (stack.at(-1)?.children ?? roots).push(heading);
    stack.push(heading);
  }
  return roots;
}

function editorDocument(document: TiptapDocument) {
  const { schemaVersion: _schemaVersion, ...editorJson } = document;
  return editorJson;
}

function persistedDocument(document: Record<string, unknown>): TiptapDocument {
  return { ...document, schemaVersion: 1, type: "doc" } as TiptapDocument;
}

function longDate(timestamp: number): string {
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}
