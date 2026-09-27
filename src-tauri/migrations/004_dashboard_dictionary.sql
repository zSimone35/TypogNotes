PRAGMA foreign_keys = OFF;
BEGIN IMMEDIATE;

ALTER TABLE settings ADD COLUMN dashboard_view TEXT NOT NULL DEFAULT 'grid'
    CHECK (dashboard_view IN ('grid', 'list'));
ALTER TABLE settings ADD COLUMN dictionary_language TEXT NOT NULL DEFAULT 'it'
    CHECK (dictionary_language IN ('it', 'en', 'fr', 'es', 'de'));

ALTER TABLE dictionary_words RENAME TO dictionary_words_v3;
CREATE TABLE dictionary_words (
    language TEXT NOT NULL CHECK (language IN ('it', 'en', 'fr', 'es', 'de')),
    word TEXT NOT NULL COLLATE NOCASE CHECK (length(trim(word)) BETWEEN 1 AND 64),
    created_at INTEGER NOT NULL,
    PRIMARY KEY (language, word)
);
INSERT OR IGNORE INTO dictionary_words (language, word, created_at)
SELECT 'it', lower(trim(word)), created_at FROM dictionary_words_v3 WHERE trim(word) <> '';
DROP TABLE dictionary_words_v3;

PRAGMA user_version = 4;
COMMIT;
PRAGMA foreign_keys = ON;
