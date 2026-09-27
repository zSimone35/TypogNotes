import { NoteStrip } from "./components/NoteStrip";
import { CollectionTabs, CollectionView } from "./components/CollectionView";
import { ShapeDefs } from "./components/ShapeDefs";
import { useEffect, useMemo, useRef, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  Archive,
  BookOpen,
  CircleAlert,
  FilePlus2,
  FolderCog,
  FolderPlus,
  LayoutDashboard,
  LoaderCircle,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Sun,
  Trash2,
  X,
} from "lucide-react";
import { api, errorMessage } from "./api/commands";
import type {
  AppSettings,
  DashboardOverview,
  ExportFormat,
  Folder as FolderModel,
  FolderColor,
  NoteDetail,
  NoteSummary,
  NoteCondition,
  NoteOrder,
  SaveReceipt,
  SaveStatus,
} from "./api/types";
import { Dashboard } from "./components/Dashboard";
import { FolderDialog, FolderGlyph, folderColorCss } from "./components/FolderDialog";
import { Modal } from "./components/Modal";
import { NoteEditor, type NoteEditorHandle, type SavedDraft } from "./components/NoteEditor";
import { SettingsDialog } from "./components/SettingsDialog";
import { fontCss } from "./options";
import logoUrl from "./assets/brand/logo-ui.png";

type AppView = "dashboard" | "editor" | "archive" | "trash";
type ConfirmRequest = { eyebrow: string; title: string; text: string; confirmLabel: string; resolve: (confirmed: boolean) => void };

const RAIL_KEY = "typognotes.sidebarRail";

const FALLBACK_SETTINGS: AppSettings = {
  customColors: [], bulletShape: "circle", checkboxShape: "square",
  theme: "soft",
  interfaceFont: "roboto",
  editorFont: "roboto",
  editorFontSize: 16,
  monospaceFont: "jetbrains",
  defaultLineSpacing: 2,
  layoutDensity: "balanced",
  sidebarWidth: 260,
  spellcheck: true,
  defaultExportFormat: "markdown",
  lastView: "dashboard",
  lastFolderId: null,
  lastNoteId: null,
  dashboardView: "grid",
  dictionaryLanguage: "it",
  toolbarCharacterWidth: 226,
  toolbarParagraphWidth: 220,
  toolbarStylesWidth: 220,
  toolbarNoteWidth: 220,
  toolbarToolsWidth: 104,
};

export default function App() {
  const [folders, setFolders] = useState<FolderModel[]>([]);
  const [folderNotes, setFolderNotes] = useState<NoteSummary[]>([]);
  const [dashboardNotes, setDashboardNotes] = useState<NoteSummary[]>([]);
  const [archiveNotes, setArchiveNotes] = useState<NoteSummary[]>([]);
  const [trashNotes, setTrashNotes] = useState<NoteSummary[]>([]);
  // Notes opened read-only from Archive / Trash, shown as tabs after the collection tab.
  const [collectionTabs, setCollectionTabs] = useState<Record<"archive" | "trash", number[]>>({ archive: [], trash: [] });
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [dashboardFolderId, setDashboardFolderId] = useState<number | null>(null);
  const [dashboardQuery, setDashboardQuery] = useState("");
  const [dashboardCondition, setDashboardCondition] = useState<NoteCondition>("all");
  const [dashboardOrder, setDashboardOrder] = useState<NoteOrder>("recent");
  const [dashboardOverview, setDashboardOverview] = useState<DashboardOverview | null>(null);
  const [activeNote, setActiveNote] = useState<NoteDetail | null>(null);
  const [settings, setSettings] = useState<AppSettings>(FALLBACK_SETTINGS);
  const [view, setView] = useState<AppView>("dashboard");
  const [focusMode, setFocusMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null);
  const [folderForSelection, setFolderForSelection] = useState(false);
  const [railMode, setRailMode] = useState(() => { try { return localStorage.getItem(RAIL_KEY) === "1"; } catch { return false; } });
  const [folderDialog, setFolderDialog] = useState<FolderModel | "new" | null>(null);
  const [deleteFolder, setDeleteFolder] = useState<FolderModel | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [restoreNote, setRestoreNote] = useState<NoteDetail | null>(null);
  const [restoreTargetId, setRestoreTargetId] = useState<number | null>(null);
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<number>>(new Set());
  const [dragOverNoteId, setDragOverNoteId] = useState<number | null>(null);
  const [organizeNotes, setOrganizeNotes] = useState(false);
  const [noteMenuId, setNoteMenuId] = useState<number | null>(null);
  const [noteMenuPosition, setNoteMenuPosition] = useState({ left: 0, top: 0 });
  const editorRef = useRef<NoteEditorHandle>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const closingRef = useRef(false);

  useEffect(() => {
    void loadApplication();
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme === "dark" ? "dark" : "light";
  }, [settings.theme]);

  useEffect(() => {
    setOrganizeNotes(false);
    setSelectedNoteIds(new Set());
    setNoteMenuId(null);
  }, [selectedFolderId, view]);

  useEffect(() => {
    if (noteMenuId === null) return;
    const close = () => setNoteMenuId(null);
    window.addEventListener("pointerdown", close, { once: true });
    return () => window.removeEventListener("pointerdown", close);
  }, [noteMenuId]);

  useEffect(() => {
    const blockInspector = (event: KeyboardEvent) => {
      const shortcut = event.ctrlKey || event.metaKey;
      if (event.key === "F12" || event.key === "F5" || (shortcut && event.key.toLowerCase() === "r") || (shortcut && event.shiftKey && ["I", "J", "C"].includes(event.key.toUpperCase()))) {
        event.preventDefault();
      }
    };
    const blockExternalDrop = (event: DragEvent) => {
      if (event.dataTransfer?.types.includes("Files")) event.preventDefault();
    };
    window.addEventListener("keydown", blockInspector, true);
    window.addEventListener("dragover", blockExternalDrop, true);
    window.addEventListener("drop", blockExternalDrop, true);
    return () => {
      window.removeEventListener("keydown", blockInspector, true);
      window.removeEventListener("dragover", blockExternalDrop, true);
      window.removeEventListener("drop", blockExternalDrop, true);
    };
  }, []);

  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | undefined;
    void getCurrentWindow().onCloseRequested(async (event) => {
      if (closingRef.current) return;
      event.preventDefault();
      if (!((await editorRef.current?.flush()) ?? true)) return;
      closingRef.current = true;
      try {
        await api.closeWindow();
      } catch (cause) {
        closingRef.current = false;
        setError(errorMessage(cause));
      }
    }).then((dispose) => { unlisten = dispose; }).catch((cause) => setError(errorMessage(cause)));
    return () => unlisten?.();
  }, []);

  useEffect(() => {
    if (loading) return;
    const timer = window.setTimeout(() => {
      void loadDashboardNotes(dashboardQuery, dashboardFolderId, dashboardCondition, dashboardOrder);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [dashboardCondition, dashboardFolderId, dashboardOrder, dashboardQuery, loading]);

  const loadApplication = async () => {
    try {
      const bootstrap = await api.bootstrap();
      setFolders(bootstrap.folders);
      setSettings(bootstrap.settings);
      const folderId = bootstrap.settings.lastFolderId ?? bootstrap.folders.at(0)?.id ?? null;
      setSelectedFolderId(folderId);
      const [current, all, archived, trashed, overview] = await Promise.all([
        folderId === null ? Promise.resolve([]) : api.listNotes({ scope: "folder", folderId }),
        api.listNotes({ scope: "all" }),
        api.listNotes({ scope: "archive" }),
        api.listNotes({ scope: "trash" }),
        api.dashboardOverview(),
      ]);
      setFolderNotes(current);
      setDashboardNotes(all);
      setArchiveNotes(archived);
      setTrashNotes(trashed);
      setDashboardOverview(overview);
      syncFolderCounts(all);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  };

  const syncFolderCounts = (allNotes: NoteSummary[]) => {
    setFolders((current) => current.map((folder) => ({
      ...folder,
      noteCount: allNotes.filter((note) => note.folderId === folder.id).length,
    })));
  };

  const refreshLists = async (folderId = selectedFolderId) => {
    const [current, all, archived, trashed] = await Promise.all([
      folderId === null ? Promise.resolve([]) : api.listNotes({ scope: "folder", folderId }),
      api.listNotes({ scope: "all" }),
      api.listNotes({ scope: "archive" }),
      api.listNotes({ scope: "trash" }),
    ]);
    setFolderNotes(current);
    setArchiveNotes(archived);
    setTrashNotes(trashed);
    syncFolderCounts(all);
    await Promise.all([
      loadDashboardNotes(dashboardQuery, dashboardFolderId, dashboardCondition, dashboardOrder),
      api.dashboardOverview().then(setDashboardOverview),
    ]);
    return current;
  };

  const loadDashboardNotes = async (query: string, folderId: number | null, condition: NoteCondition, order: NoteOrder) => {
    try {
      const loaded = await api.listNotes({
        scope: folderId === null ? "all" : "folder",
        folderId,
        query: query.trim() || undefined,
        condition,
        order,
      });
      setDashboardNotes(loaded);
    } catch (cause) {
      setError(errorMessage(cause));
    }
  };

  const askConfirm = (request: Omit<ConfirmRequest, "resolve">) => new Promise<boolean>((resolve) => setConfirmRequest({ ...request, resolve }));
  const settleConfirm = (confirmed: boolean) => {
    confirmRequest?.resolve(confirmed);
    setConfirmRequest(null);
  };

  const toggleRail = () => setRailMode((current) => {
    try { localStorage.setItem(RAIL_KEY, current ? "0" : "1"); } catch { /* the choice lasts for this session */ }
    return !current;
  });

  const toggleTheme = () => {
    const theme = settings.theme === "dark" ? "soft" : "dark";
    setSettings((current) => ({ ...current, theme }));
    void api.updateSettings({ theme }).catch((cause) => setError(errorMessage(cause)));
  };

  const flushEditor = async () => (await editorRef.current?.flush()) ?? true;

  const openFolder = async (folderId: number) => {
    if (!(await flushEditor())) return;
    try {
      setSelectedFolderId(folderId);
      const loaded = await api.listNotes({ scope: "folder", folderId });
      setFolderNotes(loaded);
      const selected = loaded.find((note) => note.id === activeNote?.id) ?? loaded.at(0);
      setActiveNote(selected ? await api.getNote(selected.id) : null);
      setView("editor");
    } catch (cause) {
      setError(errorMessage(cause));
    }
  };

  const openNote = async (id: number) => {
    if (activeNote?.id === id && view === "editor") return;
    if (!(await flushEditor())) return;
    try {
      const detail = await api.getNote(id);
      if (detail.folderId !== null && detail.folderId !== selectedFolderId) {
        setSelectedFolderId(detail.folderId);
        setFolderNotes(await api.listNotes({ scope: "folder", folderId: detail.folderId }));
      }
      setActiveNote(detail);
      setView(detail.archivedAt === null ? "editor" : "archive");
      if (detail.archivedAt !== null) addCollectionTab("archive", detail.id);
    } catch (cause) {
      setError(errorMessage(cause));
    }
  };

  const createNote = async (targetFolderId = selectedFolderId) => {
    if (targetFolderId === null || !(await flushEditor())) return;
    try {
      const created = await api.createNote(targetFolderId);
      setSelectedFolderId(targetFolderId);
      setActiveNote(created);
      setView("editor");
      await refreshLists(targetFolderId);
    } catch (cause) {
      setError(errorMessage(cause));
    }
  };

  const showDashboard = async () => {
    if (!(await flushEditor())) return;
    setView("dashboard");
  };

  const showEditor = async () => {
    if (!(await flushEditor())) return;
    if (activeNote && activeNote.archivedAt === null && activeNote.folderId === selectedFolderId) {
      setView("editor");
      return;
    }
    const first = folderNotes.at(0);
    setActiveNote(first ? await api.getNote(first.id) : null);
    setView("editor");
  };

  const showArchive = async () => {
    if (!(await flushEditor())) return;
    setView("archive");
    setActiveNote(null);
  };

  const addCollectionTab = (kind: "archive" | "trash", id: number) =>
    setCollectionTabs((current) => current[kind].includes(id) ? current : { ...current, [kind]: [...current[kind], id] });

  const openCollectionNote = async (kind: "archive" | "trash", id: number) => {
    try {
      setActiveNote(await api.getNote(id));
      addCollectionTab(kind, id);
    } catch (cause) {
      setError(errorMessage(cause));
    }
  };

  const closeCollectionTab = (kind: "archive" | "trash", id: number) => {
    setCollectionTabs((current) => ({ ...current, [kind]: current[kind].filter((item) => item !== id) }));
    setActiveNote((current) => current?.id === id ? null : current);
  };

  const showTrash = async () => {
    if (!(await flushEditor())) return;
    setView("trash");
    setActiveNote(null);
    setSelectedNoteIds(new Set());
  };

  const handleSaved = (receipt: SaveReceipt, draft: SavedDraft) => {
    const updateSummary = (note: NoteSummary): NoteSummary => note.id === receipt.noteId ? {
      ...note,
      ...draft,
      revision: receipt.revision,
      updatedAt: receipt.updatedAt,
    } : note;
    setFolderNotes((current) => current.map(updateSummary));
    setDashboardNotes((current) => current.map(updateSummary));
    setActiveNote((current) => current?.id === receipt.noteId ? {
      ...current,
      ...draft,
      revision: receipt.revision,
      updatedAt: receipt.updatedAt,
    } : current);
    void api.dashboardOverview().then(setDashboardOverview).catch((cause) => setError(errorMessage(cause)));
  };

  // No status bar: a failed save shows in the error banner and clears itself once a save succeeds.
  const SAVE_ERROR = "Salvataggio non riuscito";
  const handleSaveStatus = (status: SaveStatus, message?: string) => {
    if (status === "error") setError(`${SAVE_ERROR}: ${message ?? "errore sconosciuto"}`);
    else if (status === "saved") setError((current) => current?.startsWith(SAVE_ERROR) ? null : current);
  };

  const moveNote = async (noteId: number, folderId: number) => {
    if (!(await flushEditor())) return;
    try {
      await api.moveNote(noteId, folderId);
      setNoteMenuId(null);
      const loaded = await refreshLists(selectedFolderId);
      if (activeNote?.id === noteId && folderId !== selectedFolderId) {
        const first = loaded.at(0);
        setActiveNote(first ? await api.getNote(first.id) : null);
      }
    } catch (cause) {
      setError(errorMessage(cause));
    }
  };

  const archiveNote = async (note: NoteSummary) => {
    if (activeNote?.id === note.id && !(await flushEditor())) return;
    try {
      await api.archiveNote(note.id);
      await refreshLists(selectedFolderId);
      if (activeNote?.id === note.id) setActiveNote(null);
      setNoteMenuId(null);
    } catch (cause) {
      setError(errorMessage(cause));
    }
  };

  const archiveActiveNote = async () => {
    if (activeNote) await archiveNote(activeNote);
  };

  const trashNote = async (note: NoteSummary) => {
    if (activeNote?.id === note.id && !(await flushEditor())) return;
    try {
      await api.trashNote(note.id);
      await refreshLists(selectedFolderId);
      if (activeNote?.id === note.id) setActiveNote(null);
      setNoteMenuId(null);
    } catch (cause) {
      setError(errorMessage(cause));
    }
  };

  const trashActiveNote = async () => {
    if (activeNote) await trashNote(activeNote);
  };

  const restoreListedNote = async (note: NoteSummary) => {
    const folderId = note.folderId && folders.some((folder) => folder.id === note.folderId)
      ? note.folderId
      : selectedFolderId ?? folders.at(0)?.id ?? null;
    if (folderId === null) return;
    try {
      if (view === "trash") await api.restoreTrashedNote(note.id, folderId);
      else await api.restoreNote(note.id, folderId);
      setSelectedFolderId(folderId);
      await refreshLists(folderId);
      setActiveNote(await api.getNote(note.id));
      setView("editor");
      setNoteMenuId(null);
    } catch (cause) {
      setError(errorMessage(cause));
    }
  };

  const deleteListedNote = async (note: NoteSummary) => {
    if (!(await askConfirm({ eyebrow: "Azione irreversibile", title: "Eliminare definitivamente?", text: `“${note.title}” verrà eliminata per sempre. L’operazione non può essere annullata.`, confirmLabel: "Elimina" }))) return;
    try {
      await api.deleteNote(note.id);
      await refreshLists(selectedFolderId);
      setNoteMenuId(null);
    } catch (cause) {
      setError(errorMessage(cause));
    }
  };

  const togglePin = async (note: NoteSummary) => {
    try {
      await api.pinNote(note.id, !note.pinned);
      setNoteMenuId(null);
      await refreshLists(selectedFolderId);
    } catch (cause) {
      setError(errorMessage(cause));
    }
  };

  const toggleAttention = async (note: NoteSummary) => {
    try {
      await api.setNoteAttention(note.id, !note.needsAttention);
      const update = (item: NoteSummary) => item.id === note.id ? { ...item, needsAttention: !note.needsAttention } : item;
      setFolderNotes((current) => current.map(update));
      setDashboardNotes((current) => current.map(update));
      setActiveNote((current) => current?.id === note.id ? { ...current, needsAttention: !note.needsAttention } : current);
      setDashboardOverview(await api.dashboardOverview());
      setNoteMenuId(null);
    } catch (cause) {
      setError(errorMessage(cause));
    }
  };

  const reorderNote = async (draggedId: number, targetId: number) => {
    if (draggedId === targetId || selectedFolderId === null) return;
    const movable = folderNotes.filter((note) => !note.pinned);
    const from = movable.findIndex((note) => note.id === draggedId);
    const to = movable.findIndex((note) => note.id === targetId);
    if (from < 0 || to < 0) return;
    const reordered = [...movable];
    const [dragged] = reordered.splice(from, 1);
    reordered.splice(to, 0, dragged!);
    setFolderNotes([...folderNotes.filter((note) => note.pinned), ...reordered]);
    try {
      await api.reorderNotes(selectedFolderId, reordered.map((note) => note.id));
    } catch (cause) {
      setError(errorMessage(cause));
      await refreshLists(selectedFolderId);
    }
  };

  const moveNoteWithKeyboard = (event: React.KeyboardEvent, noteId: number) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const movable = folderNotes.filter((note) => !note.pinned);
    const index = movable.findIndex((note) => note.id === noteId);
    const target = movable[index + (event.key === "ArrowLeft" ? -1 : 1)];
    if (target) void reorderNote(noteId, target.id);
  };

  const openNoteMenu = (noteId: number, left: number, top: number) => {
    setNoteMenuPosition({ left, top });
    setNoteMenuId(noteId);
  };

  const runBulkAction = async (action: "move" | "trash" | "delete" | "restore", folderId?: number, only?: number[]) => {
    const ids = only ?? [...selectedNoteIds];
    if (!ids.length) return;
    if (!(await flushEditor())) return;
    if (action === "delete") {
      const bypassesTrash = view === "trash" ? "" : " Le note non passeranno dal Cestino.";
      if (!(await askConfirm({ eyebrow: "Azione irreversibile", title: `Eliminare definitivamente ${ids.length} ${ids.length === 1 ? "nota" : "note"}?`, text: `L’operazione non può essere annullata.${bypassesTrash}`, confirmLabel: "Elimina" }))) return;
    }
    const results = await Promise.allSettled(ids.map((id) => {
      if (action === "move") return api.moveNote(id, folderId!);
      if (action === "trash") return api.trashNote(id);
      if (action === "restore") return view === "archive" ? api.restoreNote(id, folderId) : api.restoreTrashedNote(id, folderId);
      return api.deleteNote(id);
    }));
    // Some notes may have succeeded even when others failed: always resync the lists.
    const failedIds = ids.filter((_, index) => results[index]!.status === "rejected");
    const doneIds = ids.filter((id) => !failedIds.includes(id));
    setSelectedNoteIds(new Set(failedIds));
    setActiveNote((current) => current && doneIds.includes(current.id) ? null : current);
    const firstFailure = results.find((result): result is PromiseRejectedResult => result.status === "rejected");
    if (firstFailure) setError(`${failedIds.length} ${failedIds.length === 1 ? "nota non è stata elaborata" : "note non sono state elaborate"}: ${errorMessage(firstFailure.reason)}`);
    try {
      await refreshLists(selectedFolderId);
    } catch (cause) {
      setError(errorMessage(cause));
    }
  };

  const createFolderForSelection = () => {
    setFolderForSelection(true);
    setFolderDialog("new");
  };

  const requestRestore = async () => {
    if (!activeNote) return;
    if (activeNote.folderId !== null && folders.some((folder) => folder.id === activeNote.folderId)) {
      await restoreArchivedNote(activeNote, activeNote.folderId);
      return;
    }
    setRestoreNote(activeNote);
    setRestoreTargetId(selectedFolderId ?? folders.at(0)?.id ?? null);
  };

  const restoreArchivedNote = async (note: NoteDetail, folderId: number | null) => {
    if (folderId === null) return;
    try {
      await api.restoreNote(note.id, folderId);
      setRestoreNote(null);
      setSelectedFolderId(folderId);
      await refreshLists(folderId);
      setActiveNote(await api.getNote(note.id));
      setView("editor");
    } catch (cause) {
      setError(errorMessage(cause));
    }
  };

  const exportActiveNote = async (format: ExportFormat) => {
    if (!activeNote || !(await flushEditor())) return;
    try {
      if (format === "pdf") {
        document.body.classList.add("printing-note");
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        await api.printWindow();
        document.body.classList.remove("printing-note");
      } else {
        await api.exportNote(activeNote.id, format);
      }
    } catch (cause) {
      document.body.classList.remove("printing-note");
      setError(errorMessage(cause));
    }
  };

  const saveFolder = async (name: string, icon: string, color: FolderColor) => {
    try {
      if (folderDialog === "new" && folderForSelection) {
        const created = await api.createFolder(name, icon, color);
        setFolders((current) => [...current, created]);
        setFolderDialog(null);
        setFolderForSelection(false);
        await runBulkAction("move", created.id);
        return;
      } else if (folderDialog === "new") {
        const created = await api.createFolder(name, icon, color);
        setFolders((current) => [...current, created]);
        setSelectedFolderId(created.id);
        setFolderNotes([]);
        setActiveNote(null);
      } else if (folderDialog) {
        const updated = await api.updateFolder(folderDialog.id, name, icon, color);
        setFolders((current) => current.map((folder) => folder.id === updated.id ? updated : folder));
      }
      setFolderDialog(null);
    } catch (cause) {
      setError(errorMessage(cause));
    }
  };

  const requestDeleteFolder = (folder: FolderModel) => {
    if (folder.noteCount === 0) {
      void askConfirm({ eyebrow: "Cartella vuota", title: `Eliminare “${folder.name}”?`, text: "La cartella non contiene note e verrà rimossa.", confirmLabel: "Elimina" }).then((confirmed) => { if (confirmed) void removeEmptyFolder(folder.id); });
      return;
    }
    const target = folders.find((candidate) => candidate.id !== folder.id)?.id ?? null;
    setDeleteTargetId(target);
    setDeleteFolder(folder);
  };

  const removeEmptyFolder = async (folderId: number) => {
    try {
      await api.deleteFolder(folderId);
      const remaining = folders.filter((folder) => folder.id !== folderId);
      setFolders(remaining);
      if (selectedFolderId === folderId) {
        const nextId = remaining.at(0)?.id ?? null;
        setSelectedFolderId(nextId);
        setFolderNotes(nextId === null ? [] : await api.listNotes({ scope: "folder", folderId: nextId }));
        setActiveNote(null);
      }
    } catch (cause) {
      setError(errorMessage(cause));
    }
  };

  const resolveFolderDeletion = async (mode: "move" | "archive") => {
    if (!deleteFolder || (mode === "move" && deleteTargetId === null)) return;
    try {
      const notes = await api.listNotes({ scope: "folder", folderId: deleteFolder.id });
      for (const note of notes) {
        if (mode === "archive") await api.archiveNote(note.id);
        else await api.moveNote(note.id, deleteTargetId!);
      }
      await api.deleteFolder(deleteFolder.id);
      const remaining = folders.filter((folder) => folder.id !== deleteFolder.id);
      setFolders(remaining);
      const nextId = mode === "move" ? deleteTargetId : remaining.at(0)?.id ?? null;
      setSelectedFolderId(nextId);
      setActiveNote(null);
      setDeleteFolder(null);
      await refreshLists(nextId);
    } catch (cause) {
      setError(errorMessage(cause));
    }
  };

  const saveSettings = async (draft: AppSettings) => {
    setSettingsError("");
    try {
      const saved = await api.updateSettings(draft);
      setSettings(saved);
      setSettingsOpen(false);
    } catch (cause) {
      setSettingsError(errorMessage(cause));
    }
  };

  const beginResize = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const startX = event.clientX;
    const startWidth = settings.sidebarWidth;
    let width = startWidth;
    const onMove = (move: PointerEvent) => {
      width = Math.min(420, Math.max(220, Math.round(startWidth + move.clientX - startX)));
      shellRef.current?.style.setProperty("--sidebar-width", `${width}px`);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setSettings((current) => ({ ...current, sidebarWidth: width }));
      void api.updateSettings({ sidebarWidth: width }).catch((cause) => setError(errorMessage(cause)));
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
  };

  const resizeSidebarWithKeyboard = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const width = Math.min(420, Math.max(220, settings.sidebarWidth + (event.key === "ArrowLeft" ? -20 : 20)));
    setSettings((current) => ({ ...current, sidebarWidth: width }));
    void api.updateSettings({ sidebarWidth: width }).catch((cause) => setError(errorMessage(cause)));
  };

  const style = useMemo(() => ({
    "--sidebar-width": `${settings.sidebarWidth}px`,
    "--ui-font": fontCss(settings.interfaceFont, "interface"),
    "--editor-font": fontCss(settings.editorFont, "editor"),
    "--editor-font-size": `${settings.editorFontSize}px`,
    "--mono-font": fontCss(settings.monospaceFont, "mono"),
  }) as React.CSSProperties, [settings]);

  const visibleList = folderNotes;
  const collectionKind = view === "archive" || view === "trash" ? view : null;
  const collectionNotes = collectionKind === "archive" ? archiveNotes : trashNotes;
  const openCollection = collectionKind ? collectionTabs[collectionKind].flatMap((id) => collectionNotes.filter((note) => note.id === id)) : [];
  const collectionActiveId = collectionKind && activeNote && openCollection.some((note) => note.id === activeNote.id) ? activeNote.id : null;
  const canReorder = view === "editor" && !organizeNotes;

  return (
    <div ref={shellRef} className={`app-shell density-${settings.layoutDensity}${focusMode ? " focus-mode" : ""}`} style={style}>
      <ShapeDefs />
      <header className="app-nav">
        <button type="button" className="icon-button nav-toggle" aria-label={railMode ? "Espandi la barra laterale" : "Comprimi la barra laterale"} title={railMode ? "Espandi la barra laterale" : "Comprimi la barra laterale"} aria-expanded={!railMode} disabled={focusMode} onClick={toggleRail}><Menu size={20} /></button>
        <button type="button" className="focus-button" aria-pressed={focusMode} onClick={() => setFocusMode((current) => !current)}>{focusMode ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}<span>{focusMode ? "Mostra menu" : "Modalità focus"}</span></button>
        <nav className="view-tabs" aria-label="Viste principali">
          <button type="button" className={view === "dashboard" ? "view-tab is-active" : "view-tab"} onClick={() => void showDashboard()}><LayoutDashboard size={18} /> Bacheca</button>
          <button type="button" className={view === "editor" ? "view-tab is-active" : "view-tab"} onClick={() => void showEditor()}><BookOpen size={18} /> Scrivania</button>
        </nav>
        <span className="app-nav-spacer" />
        <span className="app-nav-slogan">Scrivere meglio, ogni giorno.</span>
        <button type="button" className="icon-button theme-toggle" aria-label="Modalità scura" title="Modalità scura" aria-pressed={settings.theme === "dark"} onClick={toggleTheme}>{settings.theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}</button>
      </header>

      {loading ? (
        <div className="app-loading"><LoaderCircle className="spin" /> Apertura dell’app...</div>
      ) : (
        <div className={`workspace${railMode && !focusMode ? " is-rail" : ""}`}>
          {!focusMode && (
            <aside className={`sidebar${railMode ? " is-rail" : ""}`} aria-label="Navigazione">
              <div className="sidebar-quick-actions">
                <button type="button" className="primary-action fab" title="Nuova nota" onClick={() => void createNote()} disabled={selectedFolderId === null}><FilePlus2 size={18} /><span>Nuova nota</span></button>
                <button type="button" className="secondary-action quick-folder" aria-label="Nuova cartella" title="Nuova cartella" onClick={() => setFolderDialog("new")}><FolderPlus size={20} /></button>
              </div>

              <section className="folder-section">
                <div className="section-heading"><div><Menu size={15} /><span>Cartelle</span></div><button type="button" className="section-add-button" title="Nuova cartella" aria-label="Nuova cartella" onClick={() => setFolderDialog("new")}><FolderPlus size={14} /></button></div>
                <div className="folder-list thin-scrollbar">
                  {folders.map((folder) => (
                    <div
                      key={folder.id}
                      className={folder.id === selectedFolderId && view === "editor" ? "folder-item is-active" : "folder-item"}
                      style={{ "--folder-color": folderColorCss(folder.color) } as React.CSSProperties}
                      onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; }}
                      onDrop={(event) => {
                        event.preventDefault();
                        const id = Number(event.dataTransfer.getData("text/plain"));
                        if (id) void moveNote(id, folder.id);
                      }}
                    >
                      <button type="button" className="folder-main" title={folder.name} aria-current={folder.id === selectedFolderId && view === "editor" ? "true" : undefined} onClick={() => void openFolder(folder.id)}>
                        <span data-shape="cookie4Sided" className="folder-icon"><FolderGlyph icon={folder.icon} size={15} /></span>
                        <span className="folder-copy"><strong>{folder.name}</strong><small>{folder.noteCount} {folder.noteCount === 1 ? "nota" : "note"}</small></span>
                        <span className="rail-badge" aria-hidden="true">{folder.noteCount}</span>
                      </button>
                      <button type="button" className="folder-menu-button" aria-label={`Modifica ${folder.name}`} onClick={() => setFolderDialog(folder)}><FolderCog size={14} /></button>
                    </div>
                  ))}
                </div>
              </section>


              <div className="sidebar-footer-nav">
                <button type="button" className={view === "archive" ? "is-active" : ""} title="Archivio" aria-current={view === "archive" ? "page" : undefined} onClick={() => void showArchive()}><Archive size={16} /><span>Archivio</span><small data-count={archiveNotes.length}>{archiveNotes.length}</small></button>
                <button type="button" className={view === "trash" ? "is-active" : ""} title="Cestino" aria-current={view === "trash" ? "page" : undefined} onClick={() => void showTrash()}><Trash2 size={16} /><span>Cestino</span><small data-count={trashNotes.length}>{trashNotes.length}</small></button>
                <button type="button" title="Impostazioni" onClick={() => setSettingsOpen(true)}><Settings size={16} /><span>Impostazioni</span></button>
              </div>
              <div className="sidebar-resizer" role="separator" aria-orientation="vertical" aria-label="Ridimensiona la barra laterale (frecce sinistra e destra)" aria-valuemin={220} aria-valuemax={420} aria-valuenow={settings.sidebarWidth} tabIndex={0} onPointerDown={beginResize} onKeyDown={resizeSidebarWithKeyboard} />
            </aside>
          )}

          <main className="main-area">
            {collectionKind && !focusMode && <CollectionTabs kind={collectionKind} notes={openCollection} activeId={collectionActiveId} onHome={() => setActiveNote(null)} onSelect={(id) => void openCollectionNote(collectionKind, id)} onClose={(id) => closeCollectionTab(collectionKind, id)} />}
            {view === "editor" && !focusMode && <NoteStrip folders={folders} activeNote={activeNote} organizeNotes={organizeNotes} setOrganizeNotes={setOrganizeNotes} selectedNoteIds={selectedNoteIds} setSelectedNoteIds={setSelectedNoteIds} noteMenuId={noteMenuId} setNoteMenuId={setNoteMenuId} visibleList={visibleList} dragOverNoteId={dragOverNoteId} setDragOverNoteId={setDragOverNoteId} canReorder={canReorder} noteMenuPosition={noteMenuPosition} openNoteMenu={openNoteMenu} moveNoteWithKeyboard={moveNoteWithKeyboard} openNote={openNote} reorderNote={reorderNote} togglePin={togglePin} toggleAttention={toggleAttention} moveNote={moveNote} archiveNote={archiveNote} trashNote={trashNote} runBulkAction={runBulkAction} createFolderForSelection={createFolderForSelection} />}
            {error && <div className="error-banner" role="alert"><CircleAlert size={16} /> {error}<button type="button" onClick={() => setError(null)} aria-label="Chiudi avviso"><X size={14} /></button></div>}
            {view === "dashboard" ? (
              <Dashboard
                folders={folders}
                notes={dashboardNotes}
                overview={dashboardOverview}
                query={dashboardQuery}
                folderId={dashboardFolderId}
                condition={dashboardCondition}
                order={dashboardOrder}
                viewMode={settings.dashboardView}
                onQueryChange={setDashboardQuery}
                onFolderChange={setDashboardFolderId}
                onConditionChange={setDashboardCondition}
                onOrderChange={setDashboardOrder}
                onViewModeChange={(dashboardView) => { setSettings((current) => ({ ...current, dashboardView })); void api.updateSettings({ dashboardView }).catch((cause) => setError(errorMessage(cause))); }}
                onCreateNote={(id) => void createNote(id ?? dashboardFolderId ?? selectedFolderId)}
                onOpenFolder={id => void openFolder(id)} onEditFolder={setFolderDialog} onDeleteFolder={requestDeleteFolder}
                onArchive={() => void showArchive()} onTrash={() => void showTrash()}
                onMoveNote={(id, folderId) => void moveNote(id, folderId)}
                onArchiveNote={note => void archiveNote(note)} onTrashNote={note => void trashNote(note)}
                onBulkAction={async (ids, action, folderId) => {
                  if (action === "delete" && !await askConfirm({ eyebrow: "Azione irreversibile", title: `Eliminare definitivamente ${ids.length} note?`, text: "L’operazione non può essere annullata.", confirmLabel: "Elimina" })) return ids;
                  const results = await Promise.allSettled(ids.map(id => action === "move" ? api.moveNote(id, folderId!) : action === "trash" ? api.trashNote(id) : api.deleteNote(id)));
                  if (action !== "move" && activeNote && ids.some((id, index) => id === activeNote.id && results[index]?.status === "fulfilled")) setActiveNote(null);
                  const failed = results.find((r): r is PromiseRejectedResult => r.status === "rejected");
                  if (failed) setError(errorMessage(failed.reason));
                  try { await refreshLists(selectedFolderId); } catch (cause) { setError(errorMessage(cause)); return ids; }
                  return ids.filter((_, index) => results[index]?.status === "rejected");
                }}
                onCreateFolder={() => setFolderDialog("new")}
                onOpenNote={(id) => void openNote(id)}
                onTogglePin={(note) => void togglePin(note)}
                onToggleAttention={(note) => void toggleAttention(note)}
              />
            ) : collectionKind && collectionActiveId === null ? (
              <CollectionView kind={collectionKind} notes={collectionNotes} folders={folders} onOpen={(note) => void openCollectionNote(collectionKind, note.id)} onRestore={(note) => void restoreListedNote(note)} onDelete={(note) => void deleteListedNote(note)} onBulk={(ids, action, folderId) => void runBulkAction(action, folderId, ids)} />
            ) : activeNote ? (
              <NoteEditor key={`${activeNote.id}-${activeNote.archivedAt ?? "active"}-${activeNote.trashedAt ?? ""}`} ref={editorRef} note={activeNote} settings={settings} readOnly={collectionKind !== null || activeNote.archivedAt !== null || activeNote.trashedAt !== null} onSaved={handleSaved} onSaveStatus={handleSaveStatus} onArchive={() => void archiveActiveNote()} onTrash={() => void trashActiveNote()} onRestore={() => void (view === "trash" ? restoreListedNote(activeNote) : requestRestore())} onToggleAttention={() => void toggleAttention(activeNote)} onExport={(format) => void exportActiveNote(format)} onSettingsChange={(partial) => void api.updateSettings(partial).then(setSettings).catch((cause) => setError(errorMessage(cause)))} onError={setError} />
            ) : (
              <div className="empty-state"><img data-shape="cookie7Sided" src={logoUrl} alt="Logo TypogNotes" /><h1>Scrivania pronta</h1><p>Apri una nota o creane una nuova.</p>{view === "editor" && <button type="button" onClick={() => void createNote()}><FilePlus2 size={17} /> Nuova nota</button>}</div>
            )}
          </main>
        </div>
      )}

      {settingsOpen && <SettingsDialog settings={settings} error={settingsError} onClose={() => { setSettingsOpen(false); setSettingsError(""); }} onSave={(draft) => void saveSettings(draft)} />}
      {folderDialog && <FolderDialog folder={folderDialog === "new" ? null : folderDialog} onClose={() => { setFolderDialog(null); setFolderForSelection(false); }} onSave={(name, icon, color) => void saveFolder(name, icon, color)} onDelete={folderDialog === "new" ? undefined : () => { const target = folderDialog; setFolderDialog(null); requestDeleteFolder(target); }} />}
      {deleteFolder && (
        <Modal className="confirm-dialog" labelledBy="delete-folder-title" onClose={() => setDeleteFolder(null)}><span className="eyebrow">Cartella non vuota</span><h2 id="delete-folder-title">Prima di eliminare “{deleteFolder.name}”</h2><p>Sposta le {deleteFolder.noteCount} note in un’altra cartella oppure archiviale. Le note archiviate manterranno il nome storico della cartella.</p><label className="settings-field"><span>Destinazione</span><select value={deleteTargetId ?? ""} onChange={(event) => setDeleteTargetId(Number(event.target.value))}>{folders.filter((folder) => folder.id !== deleteFolder.id).map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select></label><footer className="dialog-footer"><button type="button" className="secondary-action" onClick={() => setDeleteFolder(null)}>Annulla</button><button type="button" className="secondary-action" onClick={() => void resolveFolderDeletion("archive")}>Archivia tutte</button><button type="button" className="primary-action" disabled={deleteTargetId === null} onClick={() => void resolveFolderDeletion("move")}>Sposta ed elimina</button></footer></Modal>
      )}
      {confirmRequest && (
        <Modal className="confirm-dialog" labelledBy="confirm-title" onClose={() => settleConfirm(false)}><span className="eyebrow">{confirmRequest.eyebrow}</span><h2 id="confirm-title">{confirmRequest.title}</h2><p>{confirmRequest.text}</p><footer className="dialog-footer"><button type="button" className="secondary-action" onClick={() => settleConfirm(false)}>Annulla</button><button type="button" className="danger-action" data-autofocus onClick={() => settleConfirm(true)}>{confirmRequest.confirmLabel}</button></footer></Modal>
      )}
      {restoreNote && (
        <Modal className="confirm-dialog" labelledBy="restore-note-title" onClose={() => setRestoreNote(null)}><span className="eyebrow">Cartella originale assente</span><h2 id="restore-note-title">Dove vuoi ripristinare la nota?</h2><p>La cartella “{restoreNote.originFolderName ?? "originale"}” non esiste più. Scegli una nuova destinazione.</p><label className="settings-field"><span>Destinazione</span><select value={restoreTargetId ?? ""} onChange={(event) => setRestoreTargetId(Number(event.target.value))}>{folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select></label><footer className="dialog-footer"><button type="button" className="secondary-action" onClick={() => setRestoreNote(null)}>Annulla</button><button type="button" className="primary-action" disabled={restoreTargetId === null} onClick={() => void restoreArchivedNote(restoreNote, restoreTargetId)}>Ripristina</button></footer></Modal>
      )}
    </div>
  );
}

