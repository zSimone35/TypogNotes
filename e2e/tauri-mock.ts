import type { Page } from "@playwright/test";

export async function installTauriMock(page: Page) {
  await page.addInitScript(() => {
    const query = new URLSearchParams(location.search);
    const now = Date.now();
    const folder = { id: 1, name: "Progetti", icon: "folder", color: "sage", position: 0, noteCount: 2, createdAt: now, updatedAt: now, trashedAt: null };
    const content = { schemaVersion: 1, type: "doc", content: [
      { type: "paragraph", content: [{ type: "text", text: "Un paragrafo lungo che continua su più righe del foglio per controllare che ogni riga resti allineata anche quando il testo va a capo. ".repeat(3) }] },
      { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Titolo principale su due righe con altre parole" }] },
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Titolo secondo" }] },
      { type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: "Titolo terzo" }] },
      { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Primo punto elenco" }] }, { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Punto annidato" }] }] }] }] }] },
      { type: "taskList", content: [{ type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph", content: [{ type: "text", text: "Attività da completare" }] }] }] },
      { type: "codeBlock", attrs: { language: "javascript" }, content: [{ type: "text", text: "const answer = 42;\nconsole.log(answer);" }] },
      { type: "collapsibleBlock", attrs: { title: "Sezione", open: true }, content: [{ type: "paragraph", content: [{ type: "text", text: "Testo nella sezione comprimibile" }] }] },
      { type: "horizontalRule" },
      { type: "paragraph", content: [{ type: "text", text: "Testo normale e " }, { type: "text", text: "grande", marks: [{ type: "textStyle", attrs: { fontSize: "28px" } }] }, { type: "text", text: " sulla stessa riga." }] },
    ] };
    const realContent = { schemaVersion: 1, type: "doc", content: [
      { type: "paragraph", content: [{ type: "text", text: "Introduzione alla lista dei problemi con una riga di testo abbastanza lunga da andare a capo nel foglio." }] },
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Cose da migliorare:", marks: [{ type: "underline" }, { type: "highlight", attrs: { color: "#f5d98f" } }] }] },
      { type: "taskList", content: [
        { type: "taskItem", attrs: { checked: true }, content: [{ type: "paragraph", content: [{ type: "text", text: "Una attività già completata con tanto testo che continua oltre la larghezza disponibile e richiede più righe sulla pagina. ".repeat(3) }] }] },
        { type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph", content: [{ type: "text", text: "Una seconda attività ancora aperta con parole colorate " }, { type: "text", text: "Mattone", marks: [{ type: "textStyle", attrs: { color: "#8a3f32" } }] }, { type: "text", text: " e testo evidenziato " }, { type: "text", text: "giallo", marks: [{ type: "highlight", attrs: { color: "#f5d98f" } }] }] }] },
      ] },
      { type: "horizontalRule" },
      { type: "collapsibleBlock", attrs: { title: "Problemi aperti", open: true }, content: [
        { type: "paragraph", content: [{ type: "text", text: "Il contenuto del blocco aperto con dettagli e parole che proseguono sulla seconda riga quando lo spazio è poco. ".repeat(2) }] },
        { type: "taskList", content: [{ type: "taskItem", attrs: { checked: true }, content: [{ type: "paragraph", content: [{ type: "text", text: "Attività barrata nel blocco con testo lungo e una seconda riga per controllare la baseline del foglio. ".repeat(2) }] }] }] },
      ] },
      { type: "collapsibleBlock", attrs: { title: "Problemi chiusi", open: false }, content: [{ type: "paragraph", content: [{ type: "text", text: "Contenuto nascosto" }] }] },
      { type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: "Titolo conclusivo", marks: [{ type: "underline" }, { type: "highlight", attrs: { color: "#b9ddee" } }] }] },
      { type: "paragraph", content: [{ type: "text", text: "Un paragrafo finale dopo tutti i blocchi." }] },
    ] };
    const colorContent = { schemaVersion: 1, type: "doc", content: [
      ...["#f5d98f", "#f4b89f", "#bfe3c0", "#b9ddee", "#d8c7ed", "#bca7ee", "#f19a7d", "#f2b04f", "#ead9bf", "#c9c9c7", "#ffffff"].map((color) => ({ type: "paragraph", content: [{ type: "text", text: `Evidenziato ${color}`, marks: [{ type: "highlight", attrs: { color } }] }] })),
      ...["#3b3029", "#8a3f32", "#2f664f", "#315f7a", "#654f86", "#9a641f"].map((color) => ({ type: "paragraph", content: [{ type: "text", text: `Colorato ${color}`, marks: [{ type: "textStyle", attrs: { color } }] }] })),
    ] };
    if (query.has("typos")) content.content = [
      { type: "paragraph", content: [{ type: "text", text: "erore sbaliato" }] },
      { type: "codeBlock", attrs: { language: "plaintext" }, content: [{ type: "text", text: "erore sbaliato" }] },
      { type: "paragraph", content: [{ type: "text", text: "erore", marks: [{ type: "code" }] }] },
    ] as any;
    const note = { bulletShape: null, checkboxShape: null, id: 1, folderId: 1, folderName: "Progetti", title: "Nota di prova", subtitle: "", preview: "Un paragrafo lungo", paperColor: "cream", lineSpacing: Number(query.get("spacing") ?? 2), paperWidth: 1080, position: 0, pinned: false, needsAttention: false, tags: [], attachmentCount: 0, revision: 1, archivedAt: null, originFolderName: null, createdAt: now, updatedAt: now, trashedAt: null, content: query.has("colors") ? colorContent : query.has("real") ? realContent : content, attachments: [] };
    const notes = [note, { ...note, id: 2, title: "Seconda nota", paperColor: "sky", position: 1 }];
    if (query.has("archivedImage")) {
      Object.assign(note, { archivedAt: now, attachments: [{ id: 50, noteId: 1, mimeType: "image/png", fileName: "test.png", sizeBytes: 68, image: true, createdAt: now }], content: { schemaVersion: 1, type: "doc", content: [{ type: "paragraph", content: [{ type: "image", attrs: { attachmentId: 50, width: 160 } }] }] } });
    }
    if (query.has("many")) notes.push(...Array.from({ length: 100 }, (_, i) => ({ ...note, id: i + 3, title: `Nota ${i + 3}`, position: i + 2 })));
    const folders = [folder, ...(query.has("many") ? [{ ...folder, id: 2, name: "Idee", noteCount: 0 }] : [])];
    const settings = { bulletShape: "circle", checkboxShape: "square", customColors: [], theme: "soft", interfaceFont: "jakarta", editorFont: query.get("font") ?? "jakarta", editorFontSize: Number(query.get("size") ?? 16), monospaceFont: "jetbrains", defaultLineSpacing: 2, layoutDensity: "balanced", sidebarWidth: 260, spellcheck: query.has("typos"), defaultExportFormat: "markdown", lastView: "dashboard", lastFolderId: 1, lastNoteId: 1, dashboardView: "grid", dictionaryLanguage: "it", toolbarCharacterWidth: 226, toolbarParagraphWidth: 220, toolbarStylesWidth: 220, toolbarNoteWidth: 220, toolbarToolsWidth: 104 };
    const calls: Array<{ command: string; args: unknown }> = [];
    Object.assign(window, { __mockCalls: calls, __TAURI_INTERNALS__: {
      transformCallback: () => 1,
      invoke: async (command: string, args: Record<string, any> = {}) => {
        calls.push({ command, args });
        if (command === "add_attachment" || command === "copy_attachment") {
          if ((window as any).__attachmentDelay) await new Promise(resolve => setTimeout(resolve, (window as any).__attachmentDelay));
          return { id: 500 + calls.length, noteId: args.input?.noteId ?? 1, fileName: "immagine.png", mimeType: "image/png", sizeBytes: 68, image: true, createdAt: now };
        }
        if (command === "read_attachment") return Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0r8AAAAASUVORK5CYII="), c => c.charCodeAt(0)).buffer;
        if (command === "bootstrap_app") return { folders, tags: [], settings, recentNote: note, pinnedNotes: [] };
        if (command === "list_notes") {
          if (args.input?.scope === "trash") return query.has("trash") ? [{ ...note, id: 9, title: "Nota nel cestino", trashedAt: now }] : [];
          return args.input?.scope === "archive" ? (query.has("archivedImage") ? [note] : []) : notes;
        }
        if (command === "create_folder") return { ...folder, id: 100 + calls.length, name: args.input?.name ?? "Nuova", icon: args.input?.icon ?? "folder", color: args.input?.color ?? "sand", noteCount: 0 };
        if (command === "update_folder") return { ...folder, ...args.input };
        if (command === "create_note") {
          const drawing = args.input?.kind === "drawing";
          return { ...note, id: 200 + calls.length, title: "Senza titolo", folderId: args.input?.folderId ?? 1, kind: drawing ? "drawing" : "text", revision: 1, content: drawing ? { schemaVersion: 1, type: "drawing", background: "lines", height: 1414, strokes: [] } : note.content };
        }
        if (command === "get_note") return args.input?.id === 9 ? { ...note, id: 9, title: "Nota nel cestino", trashedAt: now } : notes.find((item) => item.id === args.input?.id) ?? note;
        if (command === "dashboard_overview") return { totalActive: 2, recentlyUpdated: 2, needsAttentionCount: 0, pinnedCount: 0, archiveCount: 0, trashCount: 0, recentActivity: [], mostUsedFolders: [], needsAttentionNotes: [] };
        if (command === "check_spelling") return query.has("typos") ? args.input.words.filter((w: string) => ["erore", "sbaliato"].includes(w) && !args.input.ignored.includes(w)).map((word: string) => ({ word, suggestions: [] })) : [];
        if (command === "update_settings") {
          if ((window as any).__rejectSettings) throw new Error("Impossibile salvare le impostazioni");
          return Object.assign(settings, args.input);
        }
        if (command === "save_note" && (window as any).__rejectSave) throw new Error("disco pieno");
        if (command === "save_note") { const saved = notes.find((item) => item.id === args.input.id) ?? note; Object.assign(saved, args.input); return { noteId: saved.id, revision: ++saved.revision, updatedAt: Date.now() }; }
        if (command === "plugin:event|listen") return 1;
        return null;
      },
    } });
  });
}
