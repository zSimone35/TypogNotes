import type { Folder as FolderModel } from "../api/types";
export function BulkActions({ view, folders, count, onMove, onTrash, onDelete, onNewFolder }: {
  view: "dashboard" | "editor" | "archive" | "trash";
  folders: FolderModel[];
  count: number;
  onMove: (folderId: number) => void;
  onTrash: () => void;
  onDelete: () => void;
  onNewFolder: () => void;
}) {
  const restoring = view === "archive" || view === "trash";
  return (
    <div className="bulk-actions" aria-label={`Azioni per ${count} note selezionate`}>
      <strong>{count} selezionate</strong>
      <select aria-label={restoring ? "Ripristina in" : "Sposta in"} defaultValue="" onChange={(event) => { if (event.target.value) onMove(Number(event.target.value)); event.target.value = ""; }}><option value="">{restoring ? "Ripristina in…" : "Sposta in…"}</option>{folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select>
      {view === "editor" && <button type="button" onClick={onNewFolder}>Nuova cartella</button>}
      {!restoring && <button type="button" onClick={onTrash}>Cestino</button>}
      <button type="button" className="danger-text" onClick={onDelete}>Elimina definitivamente</button>
    </div>
  );
}
