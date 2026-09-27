import { useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Archive, CheckSquare2, CircleAlert, GripVertical, MoreHorizontal, Pin, PinOff, Trash2, X } from "lucide-react";
import type { Folder as FolderModel, NoteSummary } from "../api/types";
import { BulkActions } from "./BulkActions";
import { placeMenu } from "../ui/placeMenu";
interface Props {
  folders: FolderModel[];
  activeNote: NoteSummary | null;
  organizeNotes: boolean;
  setOrganizeNotes: React.Dispatch<React.SetStateAction<boolean>>;
  selectedNoteIds: Set<number>;
  setSelectedNoteIds: React.Dispatch<React.SetStateAction<Set<number>>>;
  noteMenuId: number | null;
  setNoteMenuId: (id: number | null) => void;
  visibleList: NoteSummary[];
  dragOverNoteId: number | null;
  setDragOverNoteId: (id: number | null) => void;
  canReorder: boolean;
  noteMenuPosition: { left: number; top: number };
  openNoteMenu: (id: number, x: number, y: number) => void;
  moveNoteWithKeyboard: (e: React.KeyboardEvent, id: number) => void;
  openNote: (id: number) => void;
  reorderNote: (id: number, target: number) => void;
  togglePin: (note: NoteSummary) => void;
  toggleAttention: (note: NoteSummary) => void;
  moveNote: (id: number, folder: number) => void;
  archiveNote: (note: NoteSummary) => void;
  trashNote: (note: NoteSummary) => void;
  runBulkAction: (action: "move" | "trash" | "delete" | "restore", folderId?: number) => void;
  createFolderForSelection: () => void;
}
export function NoteStrip({ folders, activeNote, organizeNotes, setOrganizeNotes, selectedNoteIds, setSelectedNoteIds, noteMenuId, setNoteMenuId, visibleList, dragOverNoteId, setDragOverNoteId, canReorder, noteMenuPosition, openNoteMenu, moveNoteWithKeyboard, openNote, reorderNote, togglePin, toggleAttention, moveNote, archiveNote, trashNote, runBulkAction, createFolderForSelection }: Props) {
  const stripRef = useRef<HTMLElement>(null);
  useEffect(() => { stripRef.current?.querySelector(".note-card.is-active")?.scrollIntoView({ inline: "nearest", block: "nearest" }); }, [activeNote?.id]);
  useLayoutEffect(() => {
    if (noteMenuId === null) return;
    const place = () => {
      const menu = document.querySelector<HTMLElement>(".note-card-menu");
      if (!menu) return;
      const p = placeMenu(noteMenuPosition.left, noteMenuPosition.top, menu.offsetWidth, menu.scrollHeight);
      Object.assign(menu.style, { left: `${p.left}px`, top: `${p.top}px`, maxHeight: `${p.maxHeight}px`, overflowY: "auto" });
    };
    place(); window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [noteMenuId, noteMenuPosition]);
  return <><section className="note-strip" ref={stripRef} aria-label="Note della cartella">
                  <div className="note-list thin-scrollbar" onWheel={e => { if (e.deltaX === 0) e.currentTarget.scrollLeft += e.deltaY; }}>
                    {visibleList.map((note) => (
                      <article key={note.id} className={`${note.id === activeNote?.id ? "note-card is-active" : "note-card"}${note.pinned ? " is-pinned" : ""}${selectedNoteIds.has(note.id) ? " is-selected" : ""}${dragOverNoteId === note.id ? " is-drag-over" : ""}${canReorder && !note.pinned ? " is-reorderable" : ""}`} style={{ "--note-color": `var(--swatch-note-${note.paperColor})`, "--tab-paper": `var(--paper-${note.paperColor})` } as React.CSSProperties} draggable={canReorder && !note.pinned} onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", String(note.id)); event.currentTarget.classList.add("is-dragging"); }} onDragEnd={(event) => { event.currentTarget.classList.remove("is-dragging"); setDragOverNoteId(null); }} onContextMenu={(event) => { if (organizeNotes) return; event.preventDefault(); openNoteMenu(note.id, event.clientX, event.clientY); }} onDragEnter={(event) => { event.preventDefault(); if (canReorder && !note.pinned) setDragOverNoteId(note.id); }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragOverNoteId(null); }} onDragOver={(event) => { if (canReorder && !note.pinned) { event.preventDefault(); event.dataTransfer.dropEffect = "move"; } }} onDrop={(event) => { event.preventDefault(); setDragOverNoteId(null); const id = Number(event.dataTransfer.getData("text/plain")); if (id) void reorderNote(id, note.id); }}>
                        {canReorder && !note.pinned && <button type="button" className="note-drag-handle" title="Trascina la scheda oppure usa le frecce sinistra/destra" aria-label={`Riordina ${note.title}: frecce sinistra e destra`} onKeyDown={(event) => moveNoteWithKeyboard(event, note.id)}><GripVertical size={14} /></button>}
                        {organizeNotes && <input className="note-select" type="checkbox" aria-label={`Seleziona ${note.title}`} checked={selectedNoteIds.has(note.id)} onChange={() => setSelectedNoteIds((current) => { const next = new Set(current); if (next.has(note.id)) next.delete(note.id); else next.add(note.id); return next; })} />}
                        <button type="button" className="note-card-main" onClick={() => { if (organizeNotes) { setSelectedNoteIds((current) => { const next = new Set(current); if (next.has(note.id)) next.delete(note.id); else next.add(note.id); return next; }); } else void openNote(note.id); }}>
                          <span className="note-card-meta"><time>{shortDate(note.updatedAt)}</time>{note.pinned && <span className="note-status" title="In evidenza"><Pin size={12} /><span className="sr-only">In evidenza</span></span>}{note.needsAttention && <span className="note-status needs-attention" title="Da sistemare"><CircleAlert size={12} /><span className="sr-only">Da sistemare</span></span>}</span>
                          <strong>{note.title}</strong>
                          <span className="note-preview">{note.subtitle || note.preview || "Nota vuota"}</span>
                        </button>
                        {!organizeNotes && <button type="button" className="note-menu-trigger" aria-label={`Azioni per ${note.title}`} aria-expanded={noteMenuId === note.id} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { if (noteMenuId === note.id) { setNoteMenuId(null); return; } const rect = event.currentTarget.getBoundingClientRect(); openNoteMenu(note.id, rect.right - 190, rect.bottom + 4); }}><MoreHorizontal size={16} /></button>}
                        {noteMenuId === note.id && createPortal(<div className="note-card-menu" role="menu" aria-label={`Azioni per ${note.title}`} style={noteMenuPosition} onPointerDown={(event) => event.stopPropagation()} onKeyDown={(event) => { if (event.key === "Escape") setNoteMenuId(null); }}>
                          <><button type="button" onClick={() => void togglePin(note)}>{note.pinned ? <PinOff size={14} /> : <Pin size={14} />}{note.pinned ? "Rimuovi evidenza" : "Metti in evidenza"}</button><button type="button" onClick={() => void toggleAttention(note)}><CircleAlert size={14} />{note.needsAttention ? "Segna come sistemata" : "Da sistemare"}</button><label><span>Sposta in</span><select aria-label={`Sposta ${note.title}`} defaultValue="" onChange={(event) => { if (event.target.value) void moveNote(note.id, Number(event.target.value)); setNoteMenuId(null); }}><option value="" disabled>Scegli cartella…</option>{folders.filter((folder) => folder.id !== note.folderId).map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select></label><button type="button" onClick={() => void archiveNote(note)}><Archive size={14} />Archivia</button><button type="button" className="danger-text" onClick={() => void trashNote(note)}><Trash2 size={14} />Sposta nel Cestino</button></>
                          <button type="button" onClick={() => { setOrganizeNotes(true); setSelectedNoteIds(new Set([note.id])); setNoteMenuId(null); }}><CheckSquare2 size={14} />Seleziona più note</button>
                        </div>, document.body)}
                      </article>
                    ))}
                    {visibleList.length === 0 && <p className="sidebar-empty" role="status">Questa cartella è vuota.</p>}
                  </div>
                </section>
                {organizeNotes && <div className="strip-selection-bar" role="toolbar" aria-label="Selezione note">
                  <button type="button" className="select-all-button" onClick={() => setSelectedNoteIds((current) => current.size === visibleList.length ? new Set() : new Set(visibleList.map((note) => note.id)))}>{selectedNoteIds.size === visibleList.length ? "Deseleziona" : "Tutte"}</button>
                  {selectedNoteIds.size > 0 ? <BulkActions view="editor" folders={folders} count={selectedNoteIds.size} onMove={(folderId) => void runBulkAction("move", folderId)} onTrash={() => void runBulkAction("trash")} onDelete={() => void runBulkAction("delete")} onNewFolder={createFolderForSelection} /> : <span className="strip-selection-hint">Seleziona le schede da organizzare</span>}
                  <button type="button" className="icon-button" aria-label="Fine selezione" title="Fine selezione" onClick={() => { setOrganizeNotes(false); setSelectedNoteIds(new Set()); }}><X size={18} /></button>
                </div>}</>;
}
function shortDate(timestamp: number): string {
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(timestamp));
}
