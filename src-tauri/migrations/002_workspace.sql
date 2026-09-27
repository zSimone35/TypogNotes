PRAGMA foreign_keys = OFF;
BEGIN IMMEDIATE;

ALTER TABLE notes RENAME TO notes_v1;
ALTER TABLE note_tags RENAME TO note_tags_v1;
ALTER TABLE attachments RENAME TO attachments_v1;
ALTER TABLE settings RENAME TO settings_v1;

CREATE TABLE notes (
    id INTEGER PRIMARY KEY,
    folder_id INTEGER REFERENCES folders(id) ON DELETE SET NULL,
    title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 200),
    subtitle TEXT NOT NULL DEFAULT '' CHECK (length(subtitle) <= 300),
    content_json TEXT NOT NULL,
    plain_text TEXT NOT NULL DEFAULT '',
    paper_color TEXT NOT NULL DEFAULT 'cream' CHECK (paper_color IN ('cream', 'warm-white', 'peach', 'sage', 'sky', 'lavender')),
    line_spacing INTEGER NOT NULL DEFAULT 2 CHECK (line_spacing BETWEEN 1 AND 5),
    pinned INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0, 1)),
    revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
    archived_at INTEGER,
    origin_folder_name TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    trashed_at INTEGER
);

INSERT INTO notes (
    id, folder_id, title, subtitle, content_json, plain_text, paper_color,
    line_spacing, pinned, revision, archived_at, origin_folder_name,
    created_at, updated_at, trashed_at
)
SELECT
    id, folder_id, title, '', content_json, plain_text, 'cream',
    2, pinned, revision, NULL, NULL, created_at, updated_at, trashed_at
FROM notes_v1;

CREATE TABLE note_tags (
    note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (note_id, tag_id)
);

INSERT INTO note_tags (note_id, tag_id)
SELECT note_id, tag_id FROM note_tags_v1;

CREATE TABLE attachments (
    id INTEGER PRIMARY KEY,
    note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL CHECK (size_bytes BETWEEN 0 AND 26214400),
    data BLOB NOT NULL,
    created_at INTEGER NOT NULL
);

INSERT INTO attachments (id, note_id, file_name, mime_type, size_bytes, data, created_at)
SELECT id, note_id, file_name, mime_type, size_bytes, data, created_at FROM attachments_v1;

CREATE TABLE settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    theme TEXT NOT NULL DEFAULT 'soft' CHECK (theme IN ('soft', 'dark', 'atelier')),
    interface_font TEXT NOT NULL DEFAULT 'segoe' CHECK (interface_font IN ('segoe', 'calibri', 'arial', 'tahoma', 'verdana')),
    editor_font TEXT NOT NULL DEFAULT 'segoe' CHECK (editor_font IN ('segoe', 'calibri', 'arial', 'tahoma', 'verdana', 'georgia', 'cambria', 'times', 'cascadia', 'consolas')),
    monospace_font TEXT NOT NULL DEFAULT 'cascadia' CHECK (monospace_font IN ('cascadia', 'consolas')),
    default_line_spacing INTEGER NOT NULL DEFAULT 2 CHECK (default_line_spacing BETWEEN 1 AND 5),
    layout_density TEXT NOT NULL DEFAULT 'balanced' CHECK (layout_density IN ('compact', 'balanced', 'spacious')),
    sidebar_width INTEGER NOT NULL DEFAULT 260 CHECK (sidebar_width BETWEEN 220 AND 420),
    spellcheck INTEGER NOT NULL DEFAULT 1 CHECK (spellcheck IN (0, 1)),
    default_export_format TEXT NOT NULL DEFAULT 'markdown' CHECK (default_export_format IN ('markdown', 'html', 'pdf')),
    last_view TEXT NOT NULL DEFAULT 'dashboard' CHECK (last_view IN ('dashboard', 'editor', 'archive')),
    last_folder_id INTEGER REFERENCES folders(id) ON DELETE SET NULL,
    last_note_id INTEGER REFERENCES notes(id) ON DELETE SET NULL
);

INSERT INTO settings (
    id, theme, interface_font, editor_font, monospace_font,
    default_line_spacing, layout_density, sidebar_width, spellcheck,
    default_export_format, last_view, last_folder_id, last_note_id
)
SELECT
    id, theme, 'segoe',
    CASE editor_font
        WHEN 'playfair' THEN 'georgia'
        WHEN 'jetbrains' THEN 'cascadia'
        ELSE 'segoe'
    END,
    'cascadia', 2, 'balanced', 260, 1, 'markdown',
    CASE WHEN last_view IN ('dashboard', 'editor') THEN last_view ELSE 'dashboard' END,
    last_folder_id, last_note_id
FROM settings_v1;

DROP TABLE attachments_v1;
DROP TABLE note_tags_v1;
DROP TABLE settings_v1;
DROP TABLE notes_v1;

CREATE INDEX idx_notes_folder_updated ON notes(folder_id, updated_at DESC);
CREATE INDEX idx_notes_archived ON notes(archived_at, updated_at DESC);
CREATE INDEX idx_notes_trashed ON notes(trashed_at);

PRAGMA user_version = 2;
COMMIT;
PRAGMA foreign_keys = ON;
