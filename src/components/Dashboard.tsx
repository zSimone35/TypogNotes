import { useEffect, useRef, useState } from "react";
import { Archive, CircleAlert, FilePlus2, Folder, FolderPlus, Grid2X2, List, MoreHorizontal, PenLine, Pin, Search, StickyNote, Trash2 } from "lucide-react";
import type { DashboardOverview, DashboardView, Folder as FolderModel, NoteCondition, NoteKind, NoteOrder, NoteSummary } from "../api/types";
import { folderColorCss } from "./FolderDialog";
import { showAnchoredPopover } from "./EditorToolbar";
import { BulkActions } from "./BulkActions";
interface Props {
  folders: FolderModel[];
  notes: NoteSummary[];
  overview: DashboardOverview | null;
  query: string;
  folderId: number | null;
  condition: NoteCondition;
  order: NoteOrder;
  viewMode: DashboardView;
  onQueryChange: (value: string) => void;
  onFolderChange: (folderId: number | null) => void;
  onConditionChange: (condition: NoteCondition) => void;
  onOrderChange: (order: NoteOrder) => void;
  onViewModeChange: (view: DashboardView) => void;
  onCreateNote: (folderId?: number, kind?: NoteKind) => void;
  onOpenFolder: (id: number) => void;
  onEditFolder: (folder: FolderModel) => void;
  onDeleteFolder: (folder: FolderModel) => void;
  onArchive: () => void; onTrash: () => void;
  onMoveNote: (id: number, folderId: number) => void;
  onArchiveNote: (note: NoteSummary) => void;
  onTrashNote: (note: NoteSummary) => void;
  onBulkAction: (ids: number[], action: "move" | "trash" | "delete", folderId?: number) => Promise<number[]>;
  onCreateFolder: () => void;
  onOpenNote: (id: number) => void;
  onTogglePin: (note: NoteSummary) => void;
  onToggleAttention: (note: NoteSummary) => void;
}

export function Dashboard(props: Props) {
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  useEffect(() => { setSelected(new Set()); }, [props.folderId, props.query, props.condition]);
  const toggle = (id: number) => setSelected(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const bulk = async (action: "move" | "trash" | "delete", folderId?: number) => { setSelected(new Set(await props.onBulkAction([...selected], action, folderId))); };
  const folder = props.folders.find(f => f.id === props.folderId);
  const stats = [
    ["all", "Note totali", props.overview?.totalActive],
    ["recent", "Modificate di recente", props.overview?.recentlyUpdated],
    ["attention", "Da sistemare", props.overview?.needsAttentionCount],
    ["pinned", "In evidenza", props.overview?.pinnedCount],
  ] as const;
  return <section className="dashboard-shell thin-scrollbar">
    <nav className="dashboard-breadcrumb" aria-label="Percorso Bacheca"><button type="button" onClick={() => props.onFolderChange(null)}>Bacheca</button>{folder && <><span aria-hidden="true">›</span><strong>{folder.name}</strong></>}</nav>
      <div className="dashboard-filters">
        <label className="search-field"><Search size={16} aria-hidden="true" /><span className="sr-only">Cerca nelle note</span><input type="search" value={props.query} onChange={(event) => props.onQueryChange(event.target.value)} placeholder="Cerca tra titolo, sottotitolo e contenuto" /></label>
        <label className="settings-field"><span>Cartella</span><select aria-label="Filtra per cartella" value={props.folderId ?? "all"} onChange={(event) => props.onFolderChange(event.target.value === "all" ? null : Number(event.target.value))}><option value="all">Tutte le cartelle</option>{props.folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select></label>
        <label className="settings-field"><span>Condizione</span><select aria-label="Filtra per condizione" value={props.condition} onChange={(event) => props.onConditionChange(event.target.value as NoteCondition)}><option value="all">Tutte le note</option><option value="recent">Modificate di recente</option><option value="attention">Da sistemare</option><option value="pinned">In evidenza</option></select></label>
        <label className="settings-field"><span>Ordina per</span><select aria-label="Ordina note" value={props.order} onChange={(event) => props.onOrderChange(event.target.value as NoteOrder)}><option value="recent">Più recenti</option><option value="oldest">Meno recenti</option><option value="title">Titolo A-Z</option></select></label>
        <div className="dashboard-view-toggle" aria-label="Visualizzazione note"><button type="button" className={props.viewMode === "grid" ? "is-active" : ""} aria-label="Vista griglia" title="Vista griglia" onClick={() => props.onViewModeChange("grid")}><Grid2X2 size={16} /></button><button type="button" className={props.viewMode === "list" ? "is-active" : ""} aria-label="Vista lista" title="Vista lista" onClick={() => props.onViewModeChange("list")}><List size={16} /></button></div>
      </div>

    <div className="dashboard-stats">{stats.map(([condition, label, count]) => <button type="button" className="dashboard-stat" key={condition} aria-pressed={props.condition === condition} onClick={() => props.onConditionChange(condition)}><span>{count ?? 0}</span>{label}</button>)}</div>
    {props.folderId === null && <section aria-label="Cartelle" className="dashboard-folders"><h2>Cartelle</h2><div className="folder-tiles">{props.folders.map(f => <FolderTile key={f.id} folder={f} props={props} />)}<button type="button" className="folder-tile" onClick={props.onCreateFolder}><FolderPlus size={24} />Nuova cartella</button><button type="button" className="folder-tile" onClick={props.onArchive}><Archive size={24} />Archivio</button><button type="button" className="folder-tile" onClick={props.onTrash}><Trash2 size={24} />Cestino</button></div></section>}
    <section className="recent-notes-panel" aria-label="Note">
      <header className="dashboard-section-header"><h2>Note</h2><div><button type="button" className="secondary-action" aria-pressed={selecting} onClick={() => { setSelecting(!selecting); setSelected(new Set()); }}>{selecting ? "Fine" : "Seleziona"}</button><button type="button" className="secondary-action" onClick={() => props.onCreateNote(undefined, "drawing")}><PenLine size={16} />Disegno</button><button type="button" className="primary-action" onClick={() => props.onCreateNote()}><FilePlus2 size={16} />Nuova nota</button></div></header>
      {selected.size > 0 && <BulkActions view="dashboard" folders={props.folders} count={selected.size} onMove={id => void bulk("move", id)} onTrash={() => void bulk("trash")} onDelete={() => void bulk("delete")} onNewFolder={props.onCreateFolder} />}
      <p className="sr-only" role="status">{props.notes.length} note trovate</p>
      <div className={`recent-notes ${props.viewMode}`}>{props.notes.map(note => <NoteCard key={note.id} note={note} folder={props.folders.find(f => f.id === note.folderId)} view={props.viewMode} onOpen={() => props.onOpenNote(note.id)} onTogglePin={() => props.onTogglePin(note)} onToggleAttention={() => props.onToggleAttention(note)} selecting={selecting} selected={selected.has(note.id)} onSelect={() => toggle(note.id)} props={props} />)}</div>
      {!props.notes.length && <div className="dashboard-empty"><Search size={22} /><h2>Nessuna nota trovata</h2><p>Modifica i filtri oppure crea una nuova nota.</p></div>}
    </section>
  </section>;
}

function FolderTile({ folder, props }: { folder: FolderModel; props: Props }) {
  const menu = useRef<HTMLDivElement>(null);
  return <article className="folder-tile" style={{ "--folder-color": folderColorCss(folder.color) } as React.CSSProperties} onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }} onDrop={e => { e.preventDefault(); const id = Number(e.dataTransfer.getData("text/plain")); if (id) props.onMoveNote(id, folder.id); }}>
    <button type="button" className="folder-tile-open" onClick={() => props.onFolderChange(folder.id)}><span className="folder-icon" data-shape="cookie4Sided"><Folder size={22} /></span><strong>{folder.name}</strong><small>{folder.noteCount} note</small></button>
    <button type="button" className="folder-tile-menu" aria-label={`Azioni cartella ${folder.name}`} onClick={e => showAnchoredPopover(e.currentTarget, menu.current)}><MoreHorizontal size={18} /></button>
    <div ref={menu} popover="auto" className="paper-color-popover" role="menu" aria-label={`Azioni cartella ${folder.name}`} onClick={() => menu.current?.hidePopover()}><button type="button" onClick={() => props.onOpenFolder(folder.id)}>Apri nella Scrivania</button><button type="button" onClick={() => props.onCreateNote(folder.id)}>Nuova nota qui</button><button type="button" onClick={() => props.onEditFolder(folder)}>Modifica</button><button type="button" onClick={() => props.onDeleteFolder(folder)}>Elimina</button></div>
  </article>;
}
function NoteCard({ note, folder, view, onOpen, onTogglePin, onToggleAttention, selecting, selected, onSelect, props }: { note: NoteSummary; folder?: FolderModel; view: DashboardView; onOpen: () => void; onTogglePin: () => void; onToggleAttention: () => void; selecting: boolean; selected: boolean; onSelect: () => void; props: Props }) {
  const menu = useRef<HTMLDivElement>(null);
  return <article draggable={!selecting} onDragStart={e => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(note.id)); }} className={`dashboard-note-card paper-accent-${note.paperColor} ${view}`} style={{ "--note-color": `var(--swatch-note-${note.paperColor})`, "--folder-color": folder ? folderColorCss(folder.color) : "var(--border)" } as React.CSSProperties}>{selecting && <input type="checkbox" className="dashboard-note-select" aria-label={`Seleziona ${note.title}`} checked={selected} onChange={onSelect} />}<button type="button" className="dashboard-note-open" onClick={selecting ? onSelect : onOpen}><span className="dashboard-note-icon">{note.kind === "drawing" ? <PenLine size={17} /> : <StickyNote size={17} />}</span><div className="dashboard-note-copy"><div className="dashboard-note-title">{note.pinned && <Pin size={13} aria-label="Nota in evidenza" />}{note.needsAttention && <CircleAlert size={13} aria-label="Nota da sistemare" />}<h3>{note.title || "Senza titolo"}</h3></div><p>{note.subtitle || note.preview || (note.kind === "drawing" ? "Disegno a mano" : "Nota vuota")}</p><footer><span><span className="dashboard-folder-dot" /> <Folder size={12} /> {note.folderName ?? "Senza cartella"}</span><time>{shortDate(note.updatedAt)}</time></footer></div></button><button type="button" className="dashboard-note-menu" aria-label={`Azioni per ${note.title}`} onClick={e => showAnchoredPopover(e.currentTarget, menu.current)}><MoreHorizontal size={17} /></button><div ref={menu} className="paper-color-popover" popover="auto" role="menu" aria-label={`Azioni per ${note.title}`}><button type="button" onClick={() => { menu.current?.hidePopover(); onOpen(); }}>Apri nota</button><button type="button" onClick={() => { menu.current?.hidePopover(); onTogglePin(); }}>{note.pinned ? "Rimuovi evidenza" : "Metti in evidenza"}</button><button type="button" onClick={() => { menu.current?.hidePopover(); onToggleAttention(); }}>{note.needsAttention ? "Rimuovi da sistemare" : "Segna da sistemare"}</button><label>Sposta in<select aria-label={`Sposta ${note.title}`} defaultValue="" onChange={e => { if (e.target.value) props.onMoveNote(note.id, Number(e.target.value)); menu.current?.hidePopover(); }}><option value="" disabled>Scegli cartella…</option>{props.folders.filter(f => f.id !== note.folderId).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label><button type="button" onClick={() => { menu.current?.hidePopover(); props.onArchiveNote(note); }}>Archivia</button><button type="button" onClick={() => { menu.current?.hidePopover(); props.onTrashNote(note); }}>Sposta nel Cestino</button></div></article>;
}

function shortDate(timestamp: number): string {
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(timestamp));
}
