BEGIN IMMEDIATE;

ALTER TABLE settings ADD COLUMN toolbar_character_width INTEGER NOT NULL DEFAULT 226
    CHECK (toolbar_character_width BETWEEN 90 AND 420);
ALTER TABLE settings ADD COLUMN toolbar_paragraph_width INTEGER NOT NULL DEFAULT 220
    CHECK (toolbar_paragraph_width BETWEEN 90 AND 420);
ALTER TABLE settings ADD COLUMN toolbar_styles_width INTEGER NOT NULL DEFAULT 220
    CHECK (toolbar_styles_width BETWEEN 90 AND 420);
ALTER TABLE settings ADD COLUMN toolbar_note_width INTEGER NOT NULL DEFAULT 220
    CHECK (toolbar_note_width BETWEEN 90 AND 420);
ALTER TABLE settings ADD COLUMN toolbar_tools_width INTEGER NOT NULL DEFAULT 104
    CHECK (toolbar_tools_width BETWEEN 90 AND 420);

PRAGMA user_version = 6;
COMMIT;
