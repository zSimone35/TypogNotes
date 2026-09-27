PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS folders (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 80),
    icon TEXT NOT NULL DEFAULT 'folder',
    position INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    trashed_at INTEGER
);

CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY,
    folder_id INTEGER NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
    title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 200),
    content_json TEXT NOT NULL,
    plain_text TEXT NOT NULL DEFAULT '',
    pinned INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0, 1)),
    revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    trashed_at INTEGER
);

CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK (length(trim(name)) BETWEEN 1 AND 40),
    color TEXT NOT NULL CHECK (length(color) BETWEEN 4 AND 9)
);

CREATE TABLE IF NOT EXISTS note_tags (
    note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (note_id, tag_id)
);

CREATE TABLE IF NOT EXISTS attachments (
    id INTEGER PRIMARY KEY,
    note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL CHECK (size_bytes BETWEEN 0 AND 26214400),
    data BLOB NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    theme TEXT NOT NULL CHECK (theme IN ('soft', 'dark', 'atelier')),
    editor_font TEXT NOT NULL CHECK (editor_font IN ('nunito', 'playfair', 'jetbrains')),
    line_spacing INTEGER NOT NULL CHECK (line_spacing BETWEEN 1 AND 5),
    last_view TEXT NOT NULL CHECK (last_view IN ('dashboard', 'editor')),
    last_folder_id INTEGER REFERENCES folders(id) ON DELETE SET NULL,
    last_note_id INTEGER REFERENCES notes(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS dictionary_words (
    word TEXT PRIMARY KEY COLLATE NOCASE,
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_folders_position ON folders(position);
CREATE INDEX IF NOT EXISTS idx_notes_folder_updated ON notes(folder_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_notes_trashed ON notes(trashed_at);

PRAGMA user_version = 1;

