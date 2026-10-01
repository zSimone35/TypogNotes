BEGIN IMMEDIATE;

ALTER TABLE notes ADD COLUMN kind TEXT NOT NULL DEFAULT 'text'
    CHECK (kind IN ('text', 'drawing'));

PRAGMA user_version = 11;
COMMIT;
