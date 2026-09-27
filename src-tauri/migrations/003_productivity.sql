PRAGMA foreign_keys = OFF;
BEGIN IMMEDIATE;

ALTER TABLE folders ADD COLUMN color TEXT NOT NULL DEFAULT 'sand'
    CHECK (color IN ('sand', 'peach', 'sage', 'sky', 'lavender', 'rose'));

ALTER TABLE notes ADD COLUMN position INTEGER NOT NULL DEFAULT 0;
ALTER TABLE notes ADD COLUMN paper_width INTEGER NOT NULL DEFAULT 1080
    CHECK (paper_width BETWEEN 720 AND 1280);
UPDATE notes SET position = id WHERE position = 0;

ALTER TABLE settings RENAME TO settings_v2;
CREATE TABLE settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    theme TEXT NOT NULL DEFAULT 'soft' CHECK (theme IN ('soft', 'dark', 'atelier')),
    interface_font TEXT NOT NULL DEFAULT 'segoe' CHECK (interface_font IN ('segoe', 'calibri', 'arial', 'tahoma', 'verdana')),
    editor_font TEXT NOT NULL DEFAULT 'segoe' CHECK (editor_font IN ('segoe', 'calibri', 'arial', 'tahoma', 'verdana', 'georgia', 'cambria', 'times', 'cascadia', 'consolas')),
    editor_font_size INTEGER NOT NULL DEFAULT 16 CHECK (editor_font_size BETWEEN 12 AND 28),
    monospace_font TEXT NOT NULL DEFAULT 'cascadia' CHECK (monospace_font IN ('cascadia', 'consolas')),
    default_line_spacing INTEGER NOT NULL DEFAULT 2 CHECK (default_line_spacing BETWEEN 1 AND 5),
    layout_density TEXT NOT NULL DEFAULT 'balanced' CHECK (layout_density IN ('compact', 'balanced', 'spacious')),
    sidebar_width INTEGER NOT NULL DEFAULT 260 CHECK (sidebar_width BETWEEN 220 AND 420),
    spellcheck INTEGER NOT NULL DEFAULT 1 CHECK (spellcheck IN (0, 1)),
    default_export_format TEXT NOT NULL DEFAULT 'markdown' CHECK (default_export_format IN ('markdown', 'html', 'pdf')),
    last_view TEXT NOT NULL DEFAULT 'dashboard' CHECK (last_view IN ('dashboard', 'editor', 'archive', 'trash')),
    last_folder_id INTEGER REFERENCES folders(id) ON DELETE SET NULL,
    last_note_id INTEGER REFERENCES notes(id) ON DELETE SET NULL
);

INSERT INTO settings (
    id, theme, interface_font, editor_font, editor_font_size, monospace_font,
    default_line_spacing, layout_density, sidebar_width, spellcheck,
    default_export_format, last_view, last_folder_id, last_note_id
)
SELECT
    id, theme, interface_font, editor_font, 16, monospace_font,
    default_line_spacing, layout_density, sidebar_width, spellcheck,
    default_export_format, last_view, last_folder_id, last_note_id
FROM settings_v2;

DROP TABLE settings_v2;

CREATE INDEX idx_notes_folder_position ON notes(folder_id, pinned DESC, position, updated_at DESC);

PRAGMA user_version = 3;
COMMIT;
PRAGMA foreign_keys = ON;
