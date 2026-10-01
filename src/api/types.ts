import type { ShapeId } from "../ui/materialShapes";
import type { JSONContent } from "@tiptap/core";

export type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";
export type PaperColor = "cream" | "warm-white" | "peach" | "sage" | "sky" | "lavender" | "lemon" | "mint" | "teal" | "ocean" | "lilac" | "rose" | "coral" | "sand" | "stone" | "slate";
export type LineSpacing = 1 | 2 | 3 | 4 | 5;
export type LayoutDensity = "compact" | "balanced" | "spacious";
export type ExportFormat = "markdown" | "html" | "pdf";
export type InterfaceFont = "roboto" | "jakarta" | "segoe" | "calibri" | "arial" | "tahoma" | "verdana";
export type MonospaceFont = "jetbrains" | "cascadia" | "consolas";
export type EditorFont = InterfaceFont | MonospaceFont | "playfair" | "georgia" | "cambria" | "times";
export type FolderColor = "sand" | "peach" | "sage" | "sky" | "lavender" | "rose";
export type DashboardView = "grid" | "list";
export type DictionaryLanguage = "it" | "en" | "fr" | "es" | "de";
export type NoteCondition = "all" | "recent" | "attention" | "pinned";
export type NoteOrder = "recent" | "oldest" | "title";

export type NoteKind = "text" | "drawing";
export type DrawingTool = "pen" | "highlighter";
export type DrawingBackground = "blank" | "lines" | "grid";

/** A point is [x, y, pressure] in page units: the page is 1000 units wide. */
export interface DrawingStroke {
  tool: DrawingTool;
  /** null = the theme's ink colour */
  color: string | null;
  size: number;
  points: Array<[number, number, number]>;
}

export interface DrawingDocument {
  schemaVersion: 1;
  type: "drawing";
  background: DrawingBackground;
  height: number;
  strokes: DrawingStroke[];
}

export type NoteContent = TiptapDocument | DrawingDocument;

export interface TiptapDocument extends JSONContent {
  schemaVersion: 1;
  type: "doc";
}

export interface Folder {
  id: number;
  name: string;
  icon: string;
  color: FolderColor;
  position: number;
  noteCount: number;
  createdAt: number;
  updatedAt: number;
  trashedAt: number | null;
}

export interface Tag {
  id: number;
  name: string;
  color: string;
}

export interface AttachmentMeta {
  id: number;
  noteId: number;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  image: boolean;
  createdAt: number;
}

export interface NoteSummary {
  kind: NoteKind;
  bulletShape: ShapeId | null;
  checkboxShape: ShapeId | null;
  id: number;
  folderId: number | null;
  folderName: string | null;
  title: string;
  subtitle: string;
  preview: string;
  paperColor: PaperColor;
  lineSpacing: LineSpacing;
  paperWidth: number;
  position: number;
  pinned: boolean;
  needsAttention: boolean;
  tags: Tag[];
  attachmentCount: number;
  revision: number;
  archivedAt: number | null;
  originFolderName: string | null;
  createdAt: number;
  updatedAt: number;
  trashedAt: number | null;
}

export interface NoteDetail extends NoteSummary {
  content: NoteContent;
  attachments: AttachmentMeta[];
}

export interface AppSettings {
  bulletShape: ShapeId;
  checkboxShape: ShapeId;
  customColors: string[];
  theme: "soft" | "dark" | "atelier";
  interfaceFont: InterfaceFont;
  editorFont: EditorFont;
  editorFontSize: number;
  monospaceFont: MonospaceFont;
  defaultLineSpacing: LineSpacing;
  layoutDensity: LayoutDensity;
  sidebarWidth: number;
  spellcheck: boolean;
  defaultExportFormat: ExportFormat;
  lastView: "dashboard" | "editor" | "archive" | "trash";
  lastFolderId: number | null;
  lastNoteId: number | null;
  dashboardView: DashboardView;
  dictionaryLanguage: DictionaryLanguage;
  toolbarCharacterWidth: number;
  toolbarParagraphWidth: number;
  toolbarStylesWidth: number;
  toolbarNoteWidth: number;
  toolbarToolsWidth: number;
}

export interface DashboardActivity {
  kind: "note-created" | "note-updated" | "note-archived" | "folder-created";
  label: string;
  occurredAt: number;
}

export interface FolderUsage {
  id: number;
  name: string;
  count: number;
}

export interface DashboardOverview {
  totalActive: number;
  recentlyUpdated: number;
  needsAttentionCount: number;
  pinnedCount: number;
  archiveCount: number;
  trashCount: number;
  recentActivity: DashboardActivity[];
  mostUsedFolders: FolderUsage[];
  needsAttentionNotes: NoteSummary[];
}

export interface MisspelledWord {
  word: string;
  suggestions: string[];
}

export interface BootstrapPayload {
  folders: Folder[];
  tags: Tag[];
  settings: AppSettings;
  recentNote: NoteSummary | null;
  pinnedNotes: NoteSummary[];
}

export interface SaveReceipt {
  noteId: number;
  revision: number;
  updatedAt: number;
}

export interface ExportReceipt {
  cancelled: boolean;
  path: string | null;
}
