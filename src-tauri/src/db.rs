use std::{
    collections::HashMap,
    fs,
    sync::Mutex,
    time::{SystemTime, UNIX_EPOCH},
};

use rusqlite::{Connection, params};
use serde_json::json;
use tauri::{AppHandle, Manager};

use crate::editor::validate_and_extract;

pub struct AppState {
    pub connection: Mutex<Connection>,
    pub dictionaries: Mutex<HashMap<String, spellbook::Dictionary>>,
}

impl AppState {
    pub fn open(app: &AppHandle) -> Result<Self, String> {
        let directory = app
            .path()
            .app_local_data_dir()
            .map_err(|error| format!("Non è possibile trovare la cartella dati: {error}"))?;
        fs::create_dir_all(&directory)
            .map_err(|error| format!("Non è possibile creare la cartella dati: {error}"))?;

        let mut connection = Connection::open(directory.join("typognotes.sqlite3"))
            .map_err(|error| format!("Non è possibile aprire il database: {error}"))?;
        connection
            .execute_batch(
                "PRAGMA foreign_keys = ON;\nPRAGMA journal_mode = WAL;\nPRAGMA busy_timeout = 5000;",
            )
            .map_err(|error| format!("Non è possibile configurare il database: {error}"))?;
        let version: i64 = connection.query_row("PRAGMA user_version", [], |row| row.get(0))
            .map_err(|error| format!("Non è possibile leggere la versione: {error}"))?;
        let backup = directory.join("typognotes.sqlite3.bak-v9");
        if version > 0 && version < 10 && !backup.exists() {
            connection.execute("VACUUM INTO ?1", [backup.to_string_lossy().as_ref()])
                .map_err(|error| format!("Non è possibile creare il backup: {error}"))?;
        }
        migrate(&mut connection)?;
        seed_first_run(&mut connection)?;
        purge_orphan_attachments(&mut connection)?;

        Ok(Self {
            connection: Mutex::new(connection),
            dictionaries: Mutex::new(HashMap::new()),
        })
    }
}

pub fn now_ms() -> Result<i64, String> {
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| format!("L'orologio di sistema non è valido: {error}"))?
        .as_millis();
    i64::try_from(millis).map_err(|_| "Il timestamp corrente non è rappresentabile.".to_string())
}

pub(crate) fn migrate(connection: &mut Connection) -> Result<(), String> {
    let mut version: i64 = connection
        .query_row("PRAGMA user_version", [], |row| row.get(0))
        .map_err(|error| format!("Non è possibile leggere la versione del database: {error}"))?;
    if version > 11 {
        return Err(
            "Il database è stato creato da una versione più recente di TypogNotes.".to_string(),
        );
    }
    if version == 0 {
        connection
            .execute_batch(include_str!("../migrations/001_initial.sql"))
            .map_err(|error| format!("Non è possibile inizializzare il database: {error}"))?;
        version = 1;
    }
    if version == 1 {
        connection
            .execute_batch(include_str!("../migrations/002_workspace.sql"))
            .map_err(|error| format!("Non è possibile aggiornare il database: {error}"))?;
        version = 2;
    }
    if version == 2 {
        connection
            .execute_batch(include_str!("../migrations/003_productivity.sql"))
            .map_err(|error| {
                format!("Non è possibile completare l'aggiornamento del database: {error}")
            })?;
        version = 3;
    }
    if version == 3 {
        connection
            .execute_batch(include_str!("../migrations/004_dashboard_dictionary.sql"))
            .map_err(|error| format!("Non è possibile aggiornare Bacheca e dizionari: {error}"))?;
        version = 4;
    }
    if version == 4 {
        connection
            .execute_batch(include_str!("../migrations/005_note_attention.sql"))
            .map_err(|error| format!("Non è possibile aggiornare lo stato delle note: {error}"))?;
        version = 5;
    }
    if version == 5 {
        connection
            .execute_batch(include_str!("../migrations/006_toolbar_widths.sql"))
            .map_err(|error| format!("Non è possibile aggiornare la toolbar: {error}"))?;
        version = 6;
    }
    if version == 6 {
        connection
            .execute_batch(include_str!("../migrations/007_bundled_fonts.sql"))
            .map_err(|error| format!("Non è possibile aggiornare i font predefiniti: {error}"))?;
        version = 7;
    }
    if version == 7 {
        connection
            .execute_batch(include_str!("../migrations/008_jakarta_font.sql"))
            .map_err(|error| format!("Non è possibile aggiornare il font Jakarta: {error}"))?;
        version = 8;
    }
    if version == 8 {
        connection
            .execute_batch(include_str!("../migrations/009_roboto_font.sql"))
            .map_err(|error| format!("Non è possibile aggiornare il font Roboto: {error}"))?;
        version = 9;
    }
    if version == 9 {
        connection.execute_batch(include_str!("../migrations/010_palette_shapes.sql"))
            .map_err(|error| format!("Non è possibile aggiornare colori e forme: {error}"))?;
        version = 10;
    }
    if version == 10 {
        connection
            .execute_batch(include_str!("../migrations/011_note_kind.sql"))
            .map_err(|error| format!("Non è possibile aggiungere le note disegno: {error}"))?;
    }
    Ok(())
}

pub(crate) fn seed_first_run(connection: &mut Connection) -> Result<(), String> {
    let folder_count: i64 = connection
        .query_row("SELECT COUNT(*) FROM folders", [], |row| row.get(0))
        .map_err(|error| format!("Non è possibile controllare il primo avvio: {error}"))?;
    if folder_count > 0 {
        return Ok(());
    }

    let now = now_ms()?;
    let document = json!({
        "schemaVersion": 1,
        "type": "doc",
        "content": [
            {"type": "heading", "attrs": {"level": 1}, "content": [{"type": "text", "text": "Benvenuto in TypogNotes"}]},
            {"type": "paragraph", "content": [{"type": "text", "text": "Questo spazio è tuo. Scrivi, organizza e ritrova ogni idea con semplicità."}]},
            {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Liste"}]},
            {"type": "bulletList", "content": [{"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Una lista puntata"}]}]}]},
            {"type": "orderedList", "attrs": {"start": 1}, "content": [{"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Una lista numerata"}]}]}]},
            {"type": "taskList", "content": [{"type": "taskItem", "attrs": {"checked": false}, "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Prova a spuntare questa attività"}]}]}]},
            {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Codice"}]},
            {"type": "codeBlock", "attrs": {"language": "rust"}, "content": [{"type": "text", "text": "fn main() {\n  println!(\"Ciao, TypogNotes!\");\n}"}]}
        ]
    });
    let plain_text = validate_and_extract(&document)?;
    let content_json = serde_json::to_string(&document)
        .map_err(|error| format!("Non è possibile creare la nota di benvenuto: {error}"))?;

    let transaction = connection
        .transaction()
        .map_err(|error| format!("Non è possibile iniziare il primo avvio: {error}"))?;
    transaction
        .execute(
            "INSERT INTO folders (name, icon, position, created_at, updated_at) VALUES (?1, ?2, 0, ?3, ?3)",
            params!["Benvenuto", "book-open", now],
        )
        .map_err(|error| format!("Non è possibile creare la cartella iniziale: {error}"))?;
    let folder_id = transaction.last_insert_rowid();
    transaction
        .execute(
            "INSERT INTO notes (folder_id, title, content_json, plain_text, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?5)",
            params![folder_id, "Benvenuto in TypogNotes", content_json, plain_text, now],
        )
        .map_err(|error| format!("Non è possibile creare la nota iniziale: {error}"))?;
    let note_id = transaction.last_insert_rowid();
    transaction
        .execute(
            "INSERT INTO settings (id, theme, interface_font, editor_font, editor_font_size, monospace_font, default_line_spacing, layout_density, sidebar_width, spellcheck, default_export_format, last_view, last_folder_id, last_note_id) VALUES (1, 'soft', 'roboto', 'roboto', 16, 'jetbrains', 2, 'balanced', 260, 1, 'markdown', 'dashboard', ?1, ?2)",
            params![folder_id, note_id],
        )
        .map_err(|error| format!("Non è possibile creare le impostazioni iniziali: {error}"))?;
    transaction
        .commit()
        .map_err(|error| format!("Non è possibile completare il primo avvio: {error}"))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{migrate, seed_first_run};
    use rusqlite::{Connection, params};

    #[test]
    fn purge_keeps_referenced_images() {
        let mut db = Connection::open_in_memory().unwrap(); migrate(&mut db).unwrap(); seed_first_run(&mut db).unwrap();
        db.execute("UPDATE notes SET content_json=?1 WHERE id=1", [r#"{"schemaVersion":1,"type":"doc","content":[{"type":"paragraph","content":[{"type":"image","attrs":{"attachmentId":1}}]}]}"#]).unwrap();
        for id in [1,2] { db.execute("INSERT INTO attachments(id,note_id,file_name,mime_type,size_bytes,data,created_at) VALUES(?1,1,'x','image/png',1,X'00',1)", [id]).unwrap(); }
        super::purge_orphan_attachments(&mut db).unwrap();
        assert_eq!(db.query_row("SELECT group_concat(id) FROM attachments", [], |r| r.get::<_,String>(0)).unwrap(), "1");
    }

    #[test]
    fn palette_migration_preserves_references() {
        let mut db = Connection::open_in_memory().unwrap();
        for sql in [include_str!("../migrations/001_initial.sql"), include_str!("../migrations/002_workspace.sql"), include_str!("../migrations/003_productivity.sql"), include_str!("../migrations/004_dashboard_dictionary.sql"), include_str!("../migrations/005_note_attention.sql"), include_str!("../migrations/006_toolbar_widths.sql"), include_str!("../migrations/007_bundled_fonts.sql"), include_str!("../migrations/008_jakarta_font.sql"), include_str!("../migrations/009_roboto_font.sql")] { db.execute_batch(sql).unwrap(); }
        db.execute_batch("INSERT INTO notes(id,title,content_json,paper_color,created_at,updated_at) VALUES(1,'Nota','{}','sky',1,1); INSERT INTO attachments(note_id,file_name,mime_type,size_bytes,data,created_at) VALUES(1,'x.png','image/png',1,X'00',1); UPDATE settings SET last_note_id=1;").unwrap();
        migrate(&mut db).unwrap();
        assert_eq!(db.query_row("SELECT paper_color FROM notes WHERE id=1", [], |r| r.get::<_,String>(0)).unwrap(), "sky");
        assert_eq!(db.query_row("SELECT count(*) FROM attachments", [], |r| r.get::<_,i64>(0)).unwrap(), 1);
        assert!(!db.prepare("PRAGMA foreign_key_check").unwrap().exists([]).unwrap());
        db.execute("UPDATE notes SET paper_color='slate'", []).unwrap();
        assert!(db.execute("UPDATE notes SET paper_color='neon'", []).is_err());
        assert_eq!(db.query_row("PRAGMA user_version", [], |r| r.get::<_,i64>(0)).unwrap(), 11);
        assert_eq!(db.query_row("SELECT kind FROM notes WHERE id=1", [], |r| r.get::<_,String>(0)).unwrap(), "text");
        assert!(db.execute("UPDATE notes SET kind='sketch'", []).is_err());
    }

    #[test]
    fn migration_and_first_run_are_idempotent() {
        let mut connection = Connection::open_in_memory().expect("in-memory database");
        migrate(&mut connection).expect("initial migration");
        migrate(&mut connection).expect("second launch migration");
        seed_first_run(&mut connection).expect("initial seed");
        seed_first_run(&mut connection).expect("second seed");

        let folder_count: i64 = connection
            .query_row("SELECT COUNT(*) FROM folders", [], |row| row.get(0))
            .expect("folder count");
        let note_count: i64 = connection
            .query_row("SELECT COUNT(*) FROM notes", [], |row| row.get(0))
            .expect("note count");
        let settings_count: i64 = connection
            .query_row("SELECT COUNT(*) FROM settings", [], |row| row.get(0))
            .expect("settings count");

        assert_eq!(folder_count, 1);
        assert_eq!(note_count, 1);
        assert_eq!(settings_count, 1);

        let version: i64 = connection
            .query_row("PRAGMA user_version", [], |row| row.get(0))
            .expect("schema version");
        let default_spacing: i64 = connection
            .query_row(
                "SELECT default_line_spacing FROM settings WHERE id = 1",
                [],
                |row| row.get(0),
            )
            .expect("default line spacing");
        let toolbar_widths: (i64, i64, i64, i64, i64) = connection
            .query_row(
                "SELECT toolbar_character_width, toolbar_paragraph_width, toolbar_styles_width, toolbar_note_width, toolbar_tools_width FROM settings WHERE id = 1",
                [],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?)),
            )
            .expect("toolbar widths");
        assert_eq!(version, 11);
        assert_eq!(default_spacing, 2);
        assert_eq!(toolbar_widths, (226, 220, 220, 220, 104));
    }

    #[test]
    fn migration_preserves_version_one_notes() {
        let mut connection = Connection::open_in_memory().expect("in-memory database");
        connection
            .execute_batch(include_str!("../migrations/001_initial.sql"))
            .expect("version one schema");
        let now = 1_700_000_000_000_i64;
        connection
            .execute(
                "INSERT INTO folders (name, icon, position, created_at, updated_at) VALUES ('Lavoro', 'briefcase', 0, ?1, ?1)",
                [now],
            )
            .expect("folder");
        let folder_id = connection.last_insert_rowid();
        connection
            .execute(
                "INSERT INTO notes (folder_id, title, content_json, plain_text, revision, created_at, updated_at) VALUES (?1, 'Da conservare', '{\"schemaVersion\":1,\"type\":\"doc\",\"content\":[]}', 'testo', 7, ?2, ?2)",
                params![folder_id, now],
            )
            .expect("note");
        connection
            .execute(
                "INSERT INTO notes (folder_id, title, content_json, plain_text, created_at, updated_at) VALUES (?1, 'Senza titolo', '{\"schemaVersion\":1,\"type\":\"doc\",\"content\":[]}', '', ?2, ?2)",
                params![folder_id, now],
            )
            .expect("empty note");
        connection
            .execute(
                "INSERT INTO settings (id, theme, editor_font, line_spacing, last_view, last_folder_id, last_note_id) VALUES (1, 'soft', 'nunito', 3, 'dashboard', ?1, NULL)",
                [folder_id],
            )
            .expect("settings");

        migrate(&mut connection).expect("upgrade");

        let attention_count: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM notes WHERE needs_attention = 1",
                [],
                |row| row.get(0),
            )
            .expect("attention migration");
        assert_eq!(attention_count, 1);

        let row: (String, i64, String, i64, i64, i64, bool) = connection
            .query_row(
                "SELECT title, revision, paper_color, line_spacing, paper_width, position, needs_attention FROM notes WHERE title = 'Da conservare'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?, row.get(5)?, row.get(6)?)),
            )
            .expect("preserved note");
        assert_eq!(
            row,
            (
                "Da conservare".to_string(),
                7,
                "cream".to_string(),
                2,
                1080,
                1,
                false
            )
        );
        let appearance: (String, i64, String, String) = connection
            .query_row(
                "SELECT f.color, s.editor_font_size, s.dashboard_view, s.dictionary_language FROM folders f CROSS JOIN settings s WHERE s.id = 1",
                [],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
            )
            .expect("version four defaults");
        assert_eq!(
            appearance,
            ("sand".to_string(), 16, "grid".to_string(), "it".to_string())
        );
        let fonts: (String, String, String) = connection
            .query_row(
                "SELECT interface_font, editor_font, monospace_font FROM settings WHERE id = 1",
                [],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .expect("bundled fonts");
        assert_eq!(
            fonts,
            ("roboto".to_string(), "roboto".to_string(), "jetbrains".to_string())
        );
    }

    #[test]
    fn migration_four_preserves_dictionary_words_and_adds_preferences() {
        let mut connection = Connection::open_in_memory().expect("in-memory database");
        connection
            .execute_batch(include_str!("../migrations/001_initial.sql"))
            .expect("v1");
        connection.execute_batch("INSERT INTO folders (id, name, icon, position, created_at, updated_at) VALUES (1, 'Test', 'folder', 0, 1, 1); INSERT INTO settings (id, theme, editor_font, line_spacing, last_view, last_folder_id, last_note_id) VALUES (1, 'soft', 'nunito', 2, 'dashboard', 1, NULL);").expect("v1 data");
        connection
            .execute_batch(include_str!("../migrations/002_workspace.sql"))
            .expect("v2");
        connection
            .execute_batch(include_str!("../migrations/003_productivity.sql"))
            .expect("v3");
        connection
            .execute(
                "INSERT INTO dictionary_words (word, created_at) VALUES ('Caffè', 1)",
                [],
            )
            .expect("word");

        migrate(&mut connection).expect("v4");

        let preferences: (String, String) = connection
            .query_row(
                "SELECT dashboard_view, dictionary_language FROM settings WHERE id = 1",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .expect("preferences");
        let word: (String, String) = connection
            .query_row("SELECT language, word FROM dictionary_words", [], |row| {
                Ok((row.get(0)?, row.get(1)?))
            })
            .expect("preserved word");
        assert_eq!(preferences, ("grid".to_string(), "it".to_string()));
        assert_eq!(word, ("it".to_string(), "caffè".to_string()));
    }

    #[test]
    fn folders_archive_and_restore_keep_notes_safe() {
        let mut connection = Connection::open_in_memory().expect("in-memory database");
        migrate(&mut connection).expect("schema");
        let now = 1_700_000_000_000_i64;
        connection
            .execute(
                "INSERT INTO folders (id, name, icon, position, created_at, updated_at) VALUES (1, 'Origine', 'folder', 0, ?1, ?1), (2, 'Progetti', 'briefcase', 1, ?1, ?1)",
                [now],
            )
            .expect("folders");
        connection
            .execute(
                "INSERT INTO notes (id, folder_id, title, content_json, created_at, updated_at) VALUES (1, 1, 'Nota', '{\"schemaVersion\":1,\"type\":\"doc\",\"content\":[]}', ?1, ?1)",
                [now],
            )
            .expect("note");

        let active_count: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM notes WHERE folder_id = 1 AND archived_at IS NULL",
                [],
                |row| row.get(0),
            )
            .expect("active count");
        assert_eq!(
            active_count, 1,
            "a non-empty folder must be blocked by the command"
        );

        connection
            .execute("UPDATE notes SET folder_id = 2 WHERE id = 1", [])
            .expect("move");
        connection
            .execute(
                "UPDATE notes SET archived_at = ?1, origin_folder_name = 'Progetti' WHERE id = 1",
                [now + 1],
            )
            .expect("archive");
        connection
            .execute("DELETE FROM folders WHERE id = 2", [])
            .expect("delete original folder");

        let archived: (Option<i64>, String) = connection
            .query_row(
                "SELECT folder_id, origin_folder_name FROM notes WHERE id = 1",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .expect("archived note");
        assert_eq!(archived, (None, "Progetti".to_string()));

        connection
            .execute(
                "UPDATE notes SET folder_id = 1, archived_at = NULL, origin_folder_name = NULL WHERE id = 1",
                [],
            )
            .expect("restore into fallback folder");
        let restored: (i64, Option<i64>) = connection
            .query_row(
                "SELECT folder_id, archived_at FROM notes WHERE id = 1",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .expect("restored note");
        assert_eq!(restored, (1, None));
    }

    #[test]
    fn database_rejects_unknown_note_appearance() {
        let mut connection = Connection::open_in_memory().expect("in-memory database");
        migrate(&mut connection).expect("schema");
        let now = 1_700_000_000_000_i64;
        connection
            .execute(
                "INSERT INTO folders (id, name, icon, position, created_at, updated_at) VALUES (1, 'Test', 'folder', 0, ?1, ?1)",
                [now],
            )
            .expect("folder");
        let invalid_color = connection.execute(
            "INSERT INTO notes (folder_id, title, content_json, paper_color, created_at, updated_at) VALUES (1, 'Nota', '{}', 'neon', ?1, ?1)",
            [now],
        );
        let invalid_spacing = connection.execute(
            "INSERT INTO notes (folder_id, title, content_json, line_spacing, created_at, updated_at) VALUES (1, 'Nota', '{}', 9, ?1, ?1)",
            [now],
        );
        assert!(invalid_color.is_err());
        assert!(invalid_spacing.is_err());
    }

    #[test]
    fn trashed_notes_survive_folder_deletion_until_permanent_delete() {
        let mut connection = Connection::open_in_memory().expect("in-memory database");
        migrate(&mut connection).expect("schema");
        let now = 1_700_000_000_000_i64;
        connection.execute(
            "INSERT INTO folders (id, name, icon, position, created_at, updated_at) VALUES (1, 'Temporanea', 'folder', 0, ?1, ?1)",
            [now],
        ).expect("folder");
        connection.execute(
            "INSERT INTO notes (id, folder_id, title, content_json, trashed_at, created_at, updated_at) VALUES (1, 1, 'Nel cestino', '{\"schemaVersion\":1,\"type\":\"doc\",\"content\":[]}', ?1, ?1, ?1)",
            [now],
        ).expect("trashed note");
        connection
            .execute("DELETE FROM folders WHERE id = 1", [])
            .expect("delete folder");
        let folder_id: Option<i64> = connection
            .query_row("SELECT folder_id FROM notes WHERE id = 1", [], |row| {
                row.get(0)
            })
            .expect("surviving note");
        assert_eq!(folder_id, None);
        connection
            .execute("DELETE FROM notes WHERE id = 1", [])
            .expect("permanent delete");
        let count: i64 = connection
            .query_row("SELECT COUNT(*) FROM notes", [], |row| row.get(0))
            .expect("note count");
        assert_eq!(count, 0);
    }
}

pub(crate) fn attachment_ids(document: &serde_json::Value) -> std::collections::HashSet<i64> {
    let mut ids = std::collections::HashSet::new();
    let mut pending = vec![document];
    while let Some(node) = pending.pop() {
        if node.get("type").and_then(serde_json::Value::as_str) == Some("image") {
            if let Some(id) = node.get("attrs").and_then(|a| a.get("attachmentId")).and_then(serde_json::Value::as_i64) { ids.insert(id); }
        }
        if let Some(children) = node.get("content").and_then(serde_json::Value::as_array) { pending.extend(children); }
    }
    ids
}

fn purge_orphan_attachments(connection: &mut Connection) -> Result<(), String> {
    let transaction = connection.transaction().map_err(|e| e.to_string())?;
    {
        let mut notes = transaction.prepare("SELECT id,content_json FROM notes WHERE EXISTS(SELECT 1 FROM attachments WHERE note_id=notes.id)").map_err(|e| e.to_string())?;
        let rows = notes.query_map([], |r| Ok((r.get::<_,i64>(0)?,r.get::<_,String>(1)?))).map_err(|e| e.to_string())?;
        for row in rows {
            let (note_id, content) = row.map_err(|e| e.to_string())?;
            // Leave attachments untouched if a damaged document cannot be safely inspected.
            let Ok(document) = serde_json::from_str::<serde_json::Value>(&content) else { continue; };
            if validate_and_extract(&document).is_err() { continue; }
            let keep = attachment_ids(&document);
            let mut query = transaction.prepare("SELECT id FROM attachments WHERE note_id=?1").map_err(|e| e.to_string())?;
            let ids = query.query_map([note_id], |r| r.get::<_,i64>(0)).map_err(|e| e.to_string())?.collect::<Result<Vec<_>,_>>().map_err(|e| e.to_string())?;
            for id in ids { if !keep.contains(&id) { transaction.execute("DELETE FROM attachments WHERE id=?1", [id]).map_err(|e| e.to_string())?; } }
        }
    }
    transaction.commit().map_err(|e| format!("Non è possibile riordinare gli allegati: {e}"))
}
