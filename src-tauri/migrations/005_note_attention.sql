BEGIN IMMEDIATE;

ALTER TABLE notes ADD COLUMN needs_attention INTEGER NOT NULL DEFAULT 0
    CHECK (needs_attention IN (0, 1));

UPDATE notes
SET needs_attention = 1
WHERE trim(title) = ''
   OR lower(trim(title)) = 'senza titolo'
   OR trim(plain_text) = '';

PRAGMA user_version = 5;
COMMIT;
