PRAGMA foreign_keys = OFF;
BEGIN IMMEDIATE;
CREATE TABLE notes_new (
    id INTEGER PRIMARY KEY,
    folder_id INTEGER REFERENCES folders(id) ON DELETE SET NULL,
    title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 200),
    subtitle TEXT NOT NULL DEFAULT '' CHECK (length(subtitle) <= 300),
    content_json TEXT NOT NULL,
    plain_text TEXT NOT NULL DEFAULT '',
    paper_color TEXT NOT NULL DEFAULT 'cream' CHECK (paper_color IN ('cream', 'warm-white', 'peach', 'sage', 'sky', 'lavender', 'lemon', 'mint', 'teal', 'ocean', 'lilac', 'rose', 'coral', 'sand', 'stone', 'slate')),
    line_spacing INTEGER NOT NULL DEFAULT 2 CHECK (line_spacing BETWEEN 1 AND 5),
    pinned INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0, 1)),
    revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
    archived_at INTEGER,
    origin_folder_name TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    trashed_at INTEGER,
    position INTEGER NOT NULL DEFAULT 0,
    paper_width INTEGER NOT NULL DEFAULT 1080 CHECK (paper_width BETWEEN 720 AND 1280),
    needs_attention INTEGER NOT NULL DEFAULT 0 CHECK (needs_attention IN (0, 1)),
    -- Shape identifiers are validated by the Rust command boundary.
    bullet_shape TEXT,
    checkbox_shape TEXT
);
INSERT INTO notes_new (id, folder_id, title, subtitle, content_json, plain_text, paper_color, line_spacing, pinned, revision, archived_at, origin_folder_name, created_at, updated_at, trashed_at, position, paper_width, needs_attention) SELECT id, folder_id, title, subtitle, content_json, plain_text, paper_color, line_spacing, pinned, revision, archived_at, origin_folder_name, created_at, updated_at, trashed_at, position, paper_width, needs_attention FROM notes;
DROP TABLE notes;
ALTER TABLE notes_new RENAME TO notes;
CREATE INDEX idx_notes_folder_updated ON notes(folder_id, updated_at DESC);
CREATE INDEX idx_notes_archived ON notes(archived_at, updated_at DESC);
CREATE INDEX idx_notes_trashed ON notes(trashed_at);
CREATE INDEX idx_notes_folder_position ON notes(folder_id, pinned DESC, position, updated_at DESC);
CREATE INDEX idx_notes_active_updated ON notes(trashed_at, archived_at, pinned DESC, updated_at DESC);
ALTER TABLE settings ADD COLUMN bullet_shape TEXT NOT NULL DEFAULT 'circle';
ALTER TABLE settings ADD COLUMN checkbox_shape TEXT NOT NULL DEFAULT 'square';
ALTER TABLE settings ADD COLUMN custom_colors TEXT NOT NULL DEFAULT '[]';
PRAGMA user_version = 10;
COMMIT;
PRAGMA foreign_keys = ON;
