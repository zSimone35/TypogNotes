import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Archive, ArchiveRestore, BookOpen, CheckSquare2, Folder, MoreHorizontal, Trash2, X } from "lucide-react";
import type { Folder as FolderModel, NoteSummary } from "../api/types";
import { BulkActions } from "./BulkActions";
import { placeMenu } from "../ui/placeMenu";

type Kind = "archive" | "trash";

/** Archive / Trash home: every note as a card, managed from its menu (right click or ⋯). */
export function CollectionView({ kind, notes, folders, onOpen, onRestore, onDelete, onBulk }: {
  kind: Kind;
  notes: NoteSummary[];
  folders: FolderModel[];
  onOpen: (note: NoteSummary) => void;
  onRestore: (note: NoteSummary) => void;
  onDelete: (note: NoteSummary) => void;
  onBulk: (ids: number[], action: "restore" | "delete", folderId?: number) => void;
}) {
  const [menu, setMenu] = useState<{ note: NoteSummary; x: number; y: number } | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const menuRef = useRef<HTMLDivElement>(null);
  const title = kind === "archive" ? "Archivio" : "Cestino";

  useLayoutEffect(() => {
    if (!menu) return;
    const place = () => {
      const element = menuRef.current;
      if (!element) return;
      const position = placeMenu(menu.x, menu.y, element.offsetWidth, element.scrollHeight);
      Object.assign(element.style, { left: `${position.left}px`, top: `${position.top}px`, maxHeight: `${position.maxHeight}px` });
    };
    place();
    const close = () => setMenu(null);
    window.addEventListener("resize", place);
    window.addEventListener("pointerdown", close);
    return () => { window.removeEventListener("resize", place); window.removeEventListener("pointerdown", close); };
  }, [menu]);

  const toggle = (id: number) => setSelected((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const run = (action: () => void) => { setMenu(null); action(); };

  return <section className="dashboard-shell collection-shell thin-scrollbar" aria-label={title}>
    <header className="collection-header">
      <div><h1>{title}</h1><p>{kind === "archive" ? "Le note archiviate: aprile in sola lettura o ripristinale in una cartella." : "Le note eliminate: ripristinale oppure eliminale definitivamente."}</p></div>
      {notes.length > 0 && <button type="button" className="secondary-action" aria-pressed={selecting} onClick={() => { setSelecting(!selecting); setSelected(new Set()); }}><CheckSquare2 size={16} />{selecting ? "Fine" : "Seleziona"}</button>}
    </header>
    {selecting && <div className="strip-selection-bar collection-selection">
      <button type="button" className="select-all-button" onClick={() => setSelected(selected.size === notes.length ? new Set() : new Set(notes.map((note) => note.id)))}>{selected.size === notes.length ? "Deseleziona" : "Tutte"}</button>
      {selected.size > 0 ? <BulkActions view={kind} folders={folders} count={selected.size} onMove={(folderId) => { onBulk([...selected], "restore", folderId); setSelected(new Set()); }} onTrash={() => undefined} onDelete={() => { onBulk([...selected], "delete"); setSelected(new Set()); }} onNewFolder={() => undefined} /> : <span className="strip-selection-hint">Seleziona le note da ripristinare o eliminare</span>}
    </div>}
    {notes.length ? <div className="recent-notes grid">{notes.map((note) => (
      <article key={note.id} className={`dashboard-note-card grid${selected.has(note.id) ? " is-selected" : ""}`} style={{ "--note-color": `var(--swatch-note-${note.paperColor})`, "--tab-paper": `var(--paper-${note.paperColor})` } as React.CSSProperties} onContextMenu={(event) => { if (selecting) return; event.preventDefault(); setMenu({ note, x: event.clientX, y: event.clientY }); }}>
        {selecting && <input type="checkbox" className="dashboard-note-select" aria-label={`Seleziona ${note.title}`} checked={selected.has(note.id)} onChange={() => toggle(note.id)} />}
        <button type="button" className="dashboard-note-open" title={selecting ? undefined : "Apri in sola lettura"} onClick={() => selecting ? toggle(note.id) : onOpen(note)}>
          <span className="dashboard-note-icon">{kind === "archive" ? <Archive size={17} /> : <Trash2 size={17} />}</span>
          <div className="dashboard-note-copy">
            <div className="dashboard-note-title"><h3>{note.title || "Senza titolo"}</h3></div>
            <p>{note.subtitle || note.preview || "Nota vuota"}</p>
            <footer><span><Folder size={12} /> {note.folderName ?? note.originFolderName ?? "Senza cartella"}</span><time>{shortDate((kind === "archive" ? note.archivedAt : note.trashedAt) ?? note.updatedAt)}</time></footer>
          </div>
        </button>
        {!selecting && <button type="button" className="dashboard-note-menu" aria-label={`Azioni per ${note.title}`} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { const rect = event.currentTarget.getBoundingClientRect(); setMenu(menu?.note.id === note.id ? null : { note, x: rect.right - 200, y: rect.bottom + 4 }); }}><MoreHorizontal size={17} /></button>}
      </article>
    ))}</div> : <div className="dashboard-empty">{kind === "archive" ? <Archive size={24} /> : <Trash2 size={24} />}<h2>{kind === "archive" ? "Archivio vuoto" : "Cestino vuoto"}</h2><p>{kind === "archive" ? "Le note archiviate compariranno qui." : "Qui troverai le note eliminate."}</p></div>}
    {menu && createPortal(<div ref={menuRef} className="note-card-menu" role="menu" aria-label={`Azioni per ${menu.note.title}`} style={{ left: menu.x, top: menu.y }} onPointerDown={(event) => event.stopPropagation()} onKeyDown={(event) => { if (event.key === "Escape") setMenu(null); }}>
      <button type="button" onClick={() => run(() => onOpen(menu.note))}><BookOpen size={14} />Apri</button>
      <button type="button" onClick={() => run(() => onRestore(menu.note))}><ArchiveRestore size={14} />{kind === "archive" ? "Ripristina nella Scrivania" : "Ripristina"}</button>
      <button type="button" className="danger-text" onClick={() => run(() => onDelete(menu.note))}><Trash2 size={14} />Elimina definitivamente</button>
    </div>, document.body)}
  </section>;
}

/** Tabs for Archive / Trash: the collection itself first, then the notes opened from it. */
export function CollectionTabs({ kind, notes, activeId, onHome, onSelect, onClose }: {
  kind: Kind;
  notes: NoteSummary[];
  activeId: number | null;
  onHome: () => void;
  onSelect: (id: number) => void;
  onClose: (id: number) => void;
}) {
  return <section className="note-strip" aria-label={kind === "archive" ? "Schede Archivio" : "Schede Cestino"}>
    <div className="note-list thin-scrollbar" onWheel={(event) => { if (event.deltaX === 0) event.currentTarget.scrollLeft += event.deltaY; }}>
      <article className={`note-card collection-home-tab${activeId === null ? " is-active" : ""}`} style={{ "--note-color": "var(--md-primary)" } as React.CSSProperties}>
        <button type="button" className="note-card-main" aria-current={activeId === null ? "page" : undefined} onClick={onHome}><strong>{kind === "archive" ? <Archive size={14} /> : <Trash2 size={14} />}{kind === "archive" ? "Archivio" : "Cestino"}</strong><span className="note-card-meta"><time>Tutte le note</time></span></button>
      </article>
      {notes.map((note) => (
        <article key={note.id} className={`note-card${note.id === activeId ? " is-active" : ""}`} style={{ "--note-color": `var(--swatch-note-${note.paperColor})`, "--tab-paper": `var(--paper-${note.paperColor})` } as React.CSSProperties}>
          <button type="button" className="note-card-main" aria-current={note.id === activeId ? "page" : undefined} onClick={() => onSelect(note.id)}><strong>{note.title}</strong><span className="note-card-meta"><time>Sola lettura</time></span></button>
          <button type="button" className="note-menu-trigger" aria-label={`Chiudi ${note.title}`} title="Chiudi scheda" onClick={() => onClose(note.id)}><X size={14} /></button>
        </article>
      ))}
    </div>
  </section>;
}

function shortDate(timestamp: number): string {
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(timestamp));
}
