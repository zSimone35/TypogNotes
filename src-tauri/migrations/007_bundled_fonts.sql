PRAGMA foreign_keys = OFF;
BEGIN IMMEDIATE;

-- Nunito Sans, Playfair Display e JetBrains Mono ora sono inclusi nell'app:
-- diventano i font predefiniti e sostituiscono i vecchi predefiniti di sistema.
ALTER TABLE settings RENAME TO settings_v6;
CREATE TABLE settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    theme TEXT NOT NULL DEFAULT 'soft' CHECK (theme IN ('soft', 'dark', 'atelier')),
    interface_font TEXT NOT NULL DEFAULT 'nunito' CHECK (interface_font IN ('nunito', 'segoe', 'calibri', 'arial', 'tahoma', 'verdana')),
    editor_font TEXT NOT NULL DEFAULT 'nunito' CHECK (editor_font IN ('nunito', 'playfair', 'segoe', 'calibri', 'arial', 'tahoma', 'verdana', 'georgia', 'cambria', 'times', 'jetbrains', 'cascadia', 'consolas')),
    editor_font_size INTEGER NOT NULL DEFAULT 16 CHECK (editor_font_size BETWEEN 12 AND 28),
    monospace_font TEXT NOT NULL DEFAULT 'jetbrains' CHECK (monospace_font IN ('jetbrains', 'cascadia', 'consolas')),
    default_line_spacing INTEGER NOT NULL DEFAULT 2 CHECK (default_line_spacing BETWEEN 1 AND 5),
    layout_density TEXT NOT NULL DEFAULT 'balanced' CHECK (layout_density IN ('compact', 'balanced', 'spacious')),
    sidebar_width INTEGER NOT NULL DEFAULT 260 CHECK (sidebar_width BETWEEN 220 AND 420),
    spellcheck INTEGER NOT NULL DEFAULT 1 CHECK (spellcheck IN (0, 1)),
    default_export_format TEXT NOT NULL DEFAULT 'markdown' CHECK (default_export_format IN ('markdown', 'html', 'pdf')),
    last_view TEXT NOT NULL DEFAULT 'dashboard' CHECK (last_view IN ('dashboard', 'editor', 'archive', 'trash')),
    last_folder_id INTEGER REFERENCES folders(id) ON DELETE SET NULL,
    last_note_id INTEGER REFERENCES notes(id) ON DELETE SET NULL,
    dashboard_view TEXT NOT NULL DEFAULT 'grid' CHECK (dashboard_view IN ('grid', 'list')),
    dictionary_language TEXT NOT NULL DEFAULT 'it' CHECK (dictionary_language IN ('it', 'en', 'fr', 'es', 'de')),
    toolbar_character_width INTEGER NOT NULL DEFAULT 226 CHECK (toolbar_character_width BETWEEN 90 AND 420),
    toolbar_paragraph_width INTEGER NOT NULL DEFAULT 220 CHECK (toolbar_paragraph_width BETWEEN 90 AND 420),
    toolbar_styles_width INTEGER NOT NULL DEFAULT 220 CHECK (toolbar_styles_width BETWEEN 90 AND 420),
    toolbar_note_width INTEGER NOT NULL DEFAULT 220 CHECK (toolbar_note_width BETWEEN 90 AND 420),
    toolbar_tools_width INTEGER NOT NULL DEFAULT 104 CHECK (toolbar_tools_width BETWEEN 90 AND 420)
);

INSERT INTO settings (
    id, theme, interface_font, editor_font, editor_font_size, monospace_font,
    default_line_spacing, layout_density, sidebar_width, spellcheck,
    default_export_format, last_view, last_folder_id, last_note_id,
    dashboard_view, dictionary_language, toolbar_character_width,
    toolbar_paragraph_width, toolbar_styles_width, toolbar_note_width, toolbar_tools_width
)
SELECT
    id, theme,
    CASE interface_font WHEN 'segoe' THEN 'nunito' ELSE interface_font END,
    CASE editor_font WHEN 'segoe' THEN 'nunito' ELSE editor_font END,
    editor_font_size,
    CASE monospace_font WHEN 'cascadia' THEN 'jetbrains' ELSE monospace_font END,
    default_line_spacing, layout_density, sidebar_width, spellcheck,
    default_export_format, last_view, last_folder_id, last_note_id,
    dashboard_view, dictionary_language, toolbar_character_width,
    toolbar_paragraph_width, toolbar_styles_width, toolbar_note_width, toolbar_tools_width
FROM settings_v6;

DROP TABLE settings_v6;

-- Elenco "tutte le note attive" e conteggi della Bacheca.
CREATE INDEX IF NOT EXISTS idx_notes_active_updated ON notes(trashed_at, archived_at, pinned DESC, updated_at DESC);

PRAGMA user_version = 7;
COMMIT;
PRAGMA foreign_keys = ON;
