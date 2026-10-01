import type { ShapeId } from "../ui/materialShapes";
import { invoke } from "@tauri-apps/api/core";
import type {
  AttachmentMeta,
  BootstrapPayload,
  AppSettings,
  DashboardOverview,
  DictionaryLanguage,
  ExportFormat,
  ExportReceipt,
  Folder,
  LineSpacing,
  MisspelledWord,
  NoteDetail,
  NoteSummary,
  PaperColor,
  NoteCondition,
  NoteOrder,
  SaveReceipt,
  NoteContent,
  NoteKind,
} from "./types";

export const api = {
  addAttachment: (noteId: number, bytes: Uint8Array) => invoke<AttachmentMeta>("add_attachment", bytes, { headers: { "x-note-id": String(noteId) } }),
  readAttachment: (id: number) => invoke<ArrayBuffer>("read_attachment", { input: { id } }),
  copyAttachment: (id: number, noteId: number) => invoke<AttachmentMeta>("copy_attachment", { input: { id, noteId } }),
  bootstrap: () => invoke<BootstrapPayload>("bootstrap_app"),

  listNotes: (input: {
    scope: "all" | "folder" | "archive" | "trash";
    folderId?: number | null;
    query?: string;
    condition?: NoteCondition;
    order?: NoteOrder;
  }) => invoke<NoteSummary[]>("list_notes", { input }),

  dashboardOverview: () => invoke<DashboardOverview>("dashboard_overview"),

  listDictionaryWords: (language: DictionaryLanguage) =>
    invoke<string[]>("list_dictionary_words", { input: { language } }),

  addDictionaryWord: (language: DictionaryLanguage, word: string) =>
    invoke<void>("add_dictionary_word", { input: { language, word } }),

  checkSpelling: (language: DictionaryLanguage, words: string[], ignored: string[]) =>
    invoke<MisspelledWord[]>("check_spelling", { input: { language, words, ignored } }),

  createFolder: (name: string, icon: string, color: Folder["color"] = "sand") =>
    invoke<Folder>("create_folder", { input: { name, icon, color } }),

  updateFolder: (id: number, name: string, icon: string, color: Folder["color"]) =>
    invoke<Folder>("update_folder", { input: { id, name, icon, color } }),

  deleteFolder: (id: number) =>
    invoke<void>("delete_folder", { input: { id } }),

  createNote: (folderId: number, kind: NoteKind = "text") =>
    invoke<NoteDetail>("create_note", { input: { folderId, kind } }),

  getNote: (id: number) =>
    invoke<NoteDetail>("get_note", { input: { id } }),

  saveNote: (input: {
    bulletShape: ShapeId | null;
    checkboxShape: ShapeId | null;
    id: number;
    title: string;
    subtitle: string;
    paperColor: PaperColor;
    lineSpacing: LineSpacing;
    paperWidth: number;
    content: NoteContent;
    expectedRevision: number;
  }) => invoke<SaveReceipt>("save_note", { input }),

  moveNote: (id: number, folderId: number) =>
    invoke<void>("move_note", { input: { id, folderId } }),

  archiveNote: (id: number) =>
    invoke<void>("archive_note", { input: { id } }),

  restoreNote: (id: number, folderId?: number | null) =>
    invoke<void>("restore_note", { input: { id, folderId: folderId ?? null } }),

  trashNote: (id: number) => invoke<void>("trash_note", { input: { id } }),

  restoreTrashedNote: (id: number, folderId?: number | null) =>
    invoke<void>("restore_trashed_note", { input: { id, folderId: folderId ?? null } }),

  deleteNote: (id: number) => invoke<void>("delete_note", { input: { id } }),

  pinNote: (id: number, pinned: boolean) =>
    invoke<void>("pin_note", { input: { id, pinned } }),

  setNoteAttention: (id: number, needsAttention: boolean) =>
    invoke<void>("set_note_attention", { input: { id, needsAttention } }),

  reorderNotes: (folderId: number, noteIds: number[]) =>
    invoke<void>("reorder_notes", { input: { folderId, noteIds } }),

  updateSettings: (input: Partial<AppSettings>) =>
    invoke<AppSettings>("update_settings", { input: Object.fromEntries(Object.entries(input).map(([key, value]) => [key, typeof value === "number" ? Math.round(value) : value])) }),

  exportNote: (id: number, format: Exclude<ExportFormat, "pdf">) =>
    invoke<ExportReceipt>("export_note", { input: { id, format } }),

  printWindow: () => invoke<void>("window_print"),
  closeWindow: () => invoke<void>("window_close"),
};

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
