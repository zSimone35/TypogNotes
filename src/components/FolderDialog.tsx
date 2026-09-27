import { useState } from "react";
import {
  Archive,
  BookOpen,
  Bookmark,
  Briefcase,
  Code2,
  Folder,
  GraduationCap,
  Heart,
  Lightbulb,
  Notebook,
  PenLine,
  Star,
  X,
} from "lucide-react";
import type { Folder as FolderModel, FolderColor } from "../api/types";
import { Modal } from "./Modal";

export const FOLDER_ICONS = [
  { id: "folder", label: "Cartella", icon: Folder },
  { id: "book-open", label: "Libro", icon: BookOpen },
  { id: "notebook", label: "Taccuino", icon: Notebook },
  { id: "lightbulb", label: "Idee", icon: Lightbulb },
  { id: "briefcase", label: "Lavoro", icon: Briefcase },
  { id: "graduation-cap", label: "Studio", icon: GraduationCap },
  { id: "heart", label: "Cuore", icon: Heart },
  { id: "star", label: "Stella", icon: Star },
  { id: "bookmark", label: "Segnalibro", icon: Bookmark },
  { id: "code-2", label: "Codice", icon: Code2 },
  { id: "pen-line", label: "Scrittura", icon: PenLine },
  { id: "archive", label: "Archivio", icon: Archive },
] as const;

interface Props {
  folder?: FolderModel | null;
  onClose: () => void;
  onSave: (name: string, icon: string, color: FolderColor) => void;
  onDelete?: () => void;
}

export function FolderDialog({ folder, onClose, onSave, onDelete }: Props) {
  const [name, setName] = useState(folder?.name ?? "");
  const [icon, setIcon] = useState(folder?.icon ?? "folder");
  const [color, setColor] = useState<FolderColor>(folder?.color ?? "sand");
  const [touched, setTouched] = useState(false);
  const nameError = touched && !name.trim();
  return (
    <Modal className="folder-dialog" labelledBy="folder-dialog-title" onClose={onClose}>
        <header className="dialog-header"><div><span className="eyebrow">Organizzazione</span><h2 id="folder-dialog-title">{folder ? "Modifica cartella" : "Nuova cartella"}</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Chiudi"><X size={18} /></button></header>
        <label className={`settings-field${nameError ? " has-error" : ""}`}><span>Nome</span><input data-autofocus value={name} maxLength={80} aria-invalid={nameError} aria-describedby="folder-name-help" onChange={(event) => setName(event.target.value)} onBlur={() => setTouched(true)} placeholder="Nome della cartella" /><small className="field-supporting" id="folder-name-help"><span>{nameError ? "Il nome è obbligatorio" : "Obbligatorio"}</span><span aria-hidden="true">{name.length}/80</span></small></label>
        <fieldset className="icon-picker"><legend>Icona</legend>{FOLDER_ICONS.map((item) => { const Icon = item.icon; return <button type="button" key={item.id} className={icon === item.id ? "is-active" : ""} title={item.label} aria-label={item.label} aria-pressed={icon === item.id} onClick={() => setIcon(item.id)}><Icon size={18} /></button>; })}</fieldset>
        <fieldset className="folder-color-picker"><legend>Colore</legend>{FOLDER_COLORS.map((item) => <button type="button" key={item.id} className={color === item.id ? "is-active" : ""} style={{ "--folder-color": folderColorCss(item.id) } as React.CSSProperties} title={item.label} aria-label={item.label} aria-pressed={color === item.id} onClick={() => setColor(item.id)} />)}</fieldset>
        <footer className="dialog-footer">{folder && onDelete && <button type="button" className="danger-action" onClick={onDelete}>Elimina cartella</button>}<span className="dialog-footer-spacer" /><button type="button" className="secondary-action" onClick={onClose}>Annulla</button><button type="button" className="primary-action" disabled={!name.trim()} onClick={() => onSave(name.trim(), icon, color)}>{folder ? "Salva" : "Crea cartella"}</button></footer>
    </Modal>
  );
}

export const FOLDER_COLORS: ReadonlyArray<{ id: FolderColor; label: string }> = [
  { id: "sand", label: "Sabbia" },
  { id: "peach", label: "Pesca" },
  { id: "sage", label: "Salvia" },
  { id: "sky", label: "Cielo" },
  { id: "lavender", label: "Lavanda" },
  { id: "rose", label: "Rosa" },
];

export function folderColorCss(color: FolderColor): string {
  return `var(--swatch-folder-${color})`;
}

export function FolderGlyph({ icon, size = 16 }: { icon: string; size?: number }) {
  const Glyph = FOLDER_ICONS.find((item) => item.id === icon)?.icon ?? Folder;
  return <Glyph size={size} />;
}
