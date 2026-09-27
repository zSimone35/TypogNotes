import { closeHistory } from "@tiptap/pm/history";
import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlignLeft, AlignRight, BringToFront, Check, Maximize2, SendToBack, SeparatorHorizontal, TextCursorInput, Trash2, WrapText, type LucideIcon } from "lucide-react";
import { api } from "../api/commands";
import { placeMenu } from "../ui/placeMenu";

// ponytail: cache for the whole session; revoke URLs if memory ever matters.
const urls = new Map<number, Promise<string>>();
function attachmentUrl(id: number) {
  if (!urls.has(id)) urls.set(id, api.readAttachment(id).then(bytes => URL.createObjectURL(new Blob([bytes]))).catch(error => { urls.delete(id); throw error; }));
  return urls.get(id)!;
}
export const IMAGE_WRAPS = { inline: "In linea", square: "Testo a capo", break: "Interrompi testo", behind: "Dietro al testo", front: "Davanti al testo" } as const;
const WRAP_ICONS: Record<keyof typeof IMAGE_WRAPS, LucideIcon> = { inline: TextCursorInput, square: WrapText, break: SeparatorHorizontal, behind: SendToBack, front: BringToFront };

export const ImageNode = Node.create({
  name: "image", group: "inline", inline: true, atom: true, draggable: true, selectable: true,
  addAttributes() {
    return Object.fromEntries(Object.entries({ attachmentId: 0, wrap: "inline", align: "left", width: null, x: 0, y: 0, alt: "" }).map(([name, value]) => [name, {
      default: value,
      parseHTML: (el: HTMLElement) => {
        const raw = el.getAttribute(`data-${name === "attachmentId" ? "attachment-id" : name}`);
        if (raw === null) return value;
        return ["attachmentId", "width", "x", "y"].includes(name) ? Number(raw) : raw;
      },
      renderHTML: (a: Record<string, unknown>) => a[name] === null ? {} : { [`data-${name === "attachmentId" ? "attachment-id" : name}`]: a[name] },
    }]));
  },
  parseHTML() { return [{ tag: "img[data-attachment-id]" }]; },
  renderHTML({ HTMLAttributes }) { return ["img", mergeAttributes(HTMLAttributes, { alt: HTMLAttributes["data-alt"] ?? "" })]; },
  addNodeView() { return ReactNodeViewRenderer(ImageView); },
});

function ImageView({ node, editor, selected, updateAttributes, deleteNode, getPos }: NodeViewProps) {
  const root = useRef<HTMLSpanElement>(null), menu = useRef<HTMLDivElement>(null);
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null);
  const [src, setSrc] = useState(""), [error, setError] = useState(false);
  const [natural, setNatural] = useState({ width: 240, height: 160 });
  const [leading, setLeading] = useState(28);
  const [available, setAvailable] = useState(600);
  useEffect(() => {
    let cancelled = false; setError(false); setSrc("");
    void attachmentUrl(Number(node.attrs.attachmentId)).then(url => { if (!cancelled) setSrc(url); }).catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [node.attrs.attachmentId]);
  useEffect(() => {
    const body = root.current?.closest<HTMLElement>(".paper-body");
    if (!body) return;
    const measure = () => { setLeading(parseFloat(getComputedStyle(body).getPropertyValue("--editor-leading")) || 28); setAvailable(body.clientWidth); };
    const observer = new ResizeObserver(measure); observer.observe(body); measure();
    return () => observer.disconnect();
  }, []);
  // The menu lives on document.body: inside the image it inherited line-height 0 and the image width.
  useLayoutEffect(() => {
    if (!menuAt) return;
    const place = () => {
      const element = menu.current;
      if (!element) return;
      const position = placeMenu(menuAt.x, menuAt.y, element.offsetWidth, element.scrollHeight);
      Object.assign(element.style, { left: `${position.left}px`, top: `${position.top}px`, maxHeight: `${position.maxHeight}px` });
    };
    place();
    const close = () => setMenuAt(null);
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    window.addEventListener("resize", place); window.addEventListener("pointerdown", close); window.addEventListener("keydown", escape);
    requestAnimationFrame(() => menu.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus());
    return () => { window.removeEventListener("resize", place); window.removeEventListener("pointerdown", close); window.removeEventListener("keydown", escape); };
  }, [menuAt]);
  const choose = (attrs: Record<string, unknown>) => { updateAttributes(attrs); setMenuAt(null); };
  const width = Math.min(available, Math.max(24, Number(node.attrs.width) || natural.width));
  const height = Math.ceil((width * natural.height / natural.width) / leading) * leading;
  const floating = node.attrs.wrap === "behind" || node.attrs.wrap === "front";
  const drag = (event: React.PointerEvent<HTMLElement>, resize: boolean) => {
    if (!editor.isEditable || event.button !== 0 || (!resize && !floating)) return;
    event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId);
    const startX = event.clientX, startY = event.clientY, x = Number(node.attrs.x), y = Number(node.attrs.y);
    const target = event.currentTarget;
    const move = (e: PointerEvent) => updateAttributes(resize ? { width: Math.round(Math.max(24, Math.min(1280, width + e.clientX - startX))) } : { x: Math.round(Math.max(-4000, Math.min(40000, x + e.clientX - startX))), y: Math.round(Math.max(-4000, Math.min(40000, y + e.clientY - startY))) });
    const stop = () => { target.removeEventListener("pointermove", move); target.removeEventListener("pointerup", stop); target.removeEventListener("pointercancel", stop); };
    target.addEventListener("pointermove", move); target.addEventListener("pointerup", stop); target.addEventListener("pointercancel", stop);
  };
  return <NodeViewWrapper as="span" ref={root} className={`note-image wrap-${node.attrs.wrap} align-${node.attrs.align}${selected ? " is-selected" : ""}`} contentEditable={false} style={{ width, height, ...(floating ? { left: Number(node.attrs.x), top: Number(node.attrs.y) } : {}) }} onPointerDown={(e: React.PointerEvent<HTMLElement>) => drag(e, false)} onContextMenu={(e: React.MouseEvent<HTMLElement>) => { e.preventDefault(); e.stopPropagation(); if (!editor.isEditable) return; const box = root.current!.getBoundingClientRect(); setMenuAt(e.clientX || e.clientY ? { x: e.clientX, y: e.clientY } : { x: box.left, y: box.bottom }); }}>
    {error ? <span className="image-error">Immagine non disponibile</span> : src && <img src={src} alt={String(node.attrs.alt)} draggable={!floating} onClick={() => { const pos = getPos(); if (editor.isEditable && typeof pos === "number") editor.commands.setNodeSelection(pos); }} onError={() => setError(true)} onLoad={e => setNatural({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight })} />}
    {editor.isEditable && <button type="button" className="image-resize" aria-label="Ridimensiona immagine" onPointerDown={e => drag(e, true)} onKeyDown={e => { if (["ArrowLeft", "ArrowRight"].includes(e.key)) { e.preventDefault(); e.stopPropagation(); updateAttributes({ width: Math.max(24, Math.min(1280, width + (e.key === "ArrowLeft" ? -16 : 16))) }); } }} />}
    {menuAt && createPortal(<div ref={menu} className="note-card-menu image-menu" role="menu" aria-label="Disposizione immagine" style={{ left: menuAt.x, top: menuAt.y }} onPointerDown={e => e.stopPropagation()}>
      {(Object.keys(IMAGE_WRAPS) as Array<keyof typeof IMAGE_WRAPS>).map(wrap => { const Icon = WRAP_ICONS[wrap]; return <button key={wrap} type="button" role="menuitemradio" aria-checked={node.attrs.wrap === wrap} onClick={() => choose({ wrap })}><Icon size={18} aria-hidden="true" /><span>{IMAGE_WRAPS[wrap]}</span>{node.attrs.wrap === wrap && <Check className="image-menu-check" size={16} aria-hidden="true" />}</button>; })}
      {node.attrs.wrap === "square" && <div className="image-menu-align" role="group" aria-label="Lato dell'immagine">{(["left", "right"] as const).map(align => <button key={align} type="button" role="menuitemradio" aria-checked={node.attrs.align === align} onClick={() => choose({ align })}>{align === "left" ? <AlignLeft size={16} aria-hidden="true" /> : <AlignRight size={16} aria-hidden="true" />}{align === "left" ? "Sinistra" : "Destra"}</button>)}</div>}
      <hr />
      <button type="button" onClick={() => choose({ width: null })}><Maximize2 size={18} aria-hidden="true" /><span>Dimensione originale</span></button>
      <button type="button" className="danger-text" onClick={() => { setMenuAt(null); editor.view.dispatch(closeHistory(editor.state.tr)); deleteNode(); }}><Trash2 size={18} aria-hidden="true" /><span>Elimina</span></button>
    </div>, document.body)}
  </NodeViewWrapper>;
}
