use std::{collections::HashSet, fs};

use rusqlite::{Connection, OptionalExtension, Row, params};
use serde_json::{Value, json};
use tauri::{AppHandle, State, WebviewWindow};
use tauri_plugin_dialog::DialogExt;

use crate::{
    db::{AppState, now_ms},
    editor::{validate_and_extract, is_hex_color},
    export::{render_html, render_markdown},
    models::{
        AddDictionaryWordInput, AppSettings, AttachmentMeta, BootstrapPayload, CheckSpellingInput,
        CreateFolderInput, CreateNoteInput, DashboardActivity, DashboardOverview,
        DictionaryLanguageInput, ExportNoteInput, ExportReceipt, Folder, FolderUsage, IdInput,
        ListNotesInput, MisspelledWord, MoveNoteInput, NoteDetail, NoteSummary, PinNoteInput,
        ReorderNotesInput, RestoreNoteInput, SaveNoteInput, SaveReceipt, SetNoteAttentionInput,
        Tag, UpdateFolderInput, UpdateSettingsInput,
    },
};

const SUMMARY_COLUMNS: &str = "
    n.id, n.folder_id, f.name, n.title, n.subtitle,
    substr(n.plain_text, 1, 180), n.paper_color, n.line_spacing, n.paper_width, n.position, n.pinned, n.needs_attention,
    (SELECT COUNT(*) FROM attachments a WHERE a.note_id = n.id),
    n.revision, n.archived_at, n.origin_folder_name,
    n.created_at, n.updated_at, n.trashed_at, n.bullet_shape, n.checkbox_shape
";

const FOLDER_ICONS: &[&str] = &[
    "folder",
    "book-open",
    "notebook",
    "lightbulb",
    "briefcase",
    "graduation-cap",
    "heart",
    "star",
    "bookmark",
    "code-2",
    "pen-line",
    "archive",
];
const PAPER_COLORS: &[&str] = &["cream", "warm-white", "peach", "sage", "sky", "lavender", "lemon", "mint", "teal", "ocean", "lilac", "rose", "coral", "sand", "stone", "slate"];
pub(crate) const SHAPES: &[&str] = &["circle", "square", "slanted", "arch", "fan", "arrow", "semiCircle", "oval", "pill", "triangle", "diamond", "clamShell", "pentagon", "gem", "verySunny", "sunny", "cookie4Sided", "cookie6Sided", "cookie7Sided", "cookie9Sided", "cookie12Sided", "ghostish", "clover4Leaf", "clover8Leaf", "burst", "softBurst", "boom", "softBoom", "flower", "puffy", "puffyDiamond", "pixelCircle", "pixelTriangle", "bun", "heart"];
const INTERFACE_FONTS: &[&str] = &["roboto", "jakarta", "segoe", "calibri", "arial", "tahoma", "verdana"];
const EDITOR_FONTS: &[&str] = &[
    "roboto", "jakarta", "playfair", "segoe", "calibri", "arial", "tahoma", "verdana", "georgia", "cambria",
    "times", "jetbrains", "cascadia", "consolas",
];
const MONOSPACE_FONTS: &[&str] = &["jetbrains", "cascadia", "consolas"];
const FOLDER_COLORS: &[&str] = &["sand", "peach", "sage", "sky", "lavender", "rose"];
const DICTIONARY_LANGUAGES: &[&str] = &["it", "en", "fr", "es", "de"];

#[tauri::command(async)]
pub fn bootstrap_app(state: State<'_, AppState>) -> Result<BootstrapPayload, String> {
    let connection = lock_connection(&state)?;
    connection
        .execute(
            "UPDATE settings SET last_view = 'dashboard' WHERE id = 1",
            [],
        )
        .map_err(|error| format!("Non è possibile preparare la Bacheca: {error}"))?;
    let folders = read_folders(&connection)?;
    let tags = read_tags(&connection)?;
    let settings = read_settings(&connection)?;

    let recent_sql = summary_query(
        "WHERE n.trashed_at IS NULL AND n.archived_at IS NULL ORDER BY n.updated_at DESC LIMIT 1",
    );
    let recent_note = connection
        .query_row(&recent_sql, [], note_summary_from_row)
        .optional()
        .map_err(|error| format!("Non è possibile leggere la nota recente: {error}"))?;
    let pinned_sql = summary_query(
        "WHERE n.trashed_at IS NULL AND n.archived_at IS NULL AND n.pinned = 1 ORDER BY n.updated_at DESC",
    );
    let mut statement = connection
        .prepare(&pinned_sql)
        .map_err(|error| format!("Non è possibile preparare le note in evidenza: {error}"))?;
    let pinned_notes = statement
        .query_map([], note_summary_from_row)
        .map_err(|error| format!("Non è possibile leggere le note in evidenza: {error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Non è possibile comporre le note in evidenza: {error}"))?;

    Ok(BootstrapPayload {
        folders,
        tags,
        settings,
        recent_note,
        pinned_notes,
    })
}

#[tauri::command(async)]
pub fn update_settings(
    input: UpdateSettingsInput,
    state: State<'_, AppState>,
) -> Result<AppSettings, String> {
    let connection = lock_connection(&state)?;
    let current = read_settings(&connection)?;
    let bullet_shape = input.bullet_shape.unwrap_or(current.bullet_shape);
    let checkbox_shape = input.checkbox_shape.unwrap_or(current.checkbox_shape);
    let custom_colors = normalize_custom_colors(input.custom_colors.unwrap_or(current.custom_colors))?;
    if !SHAPES.contains(&bullet_shape.as_str()) || !SHAPES.contains(&checkbox_shape.as_str()) {
        return Err("La forma selezionata non è valida.".into());
    }
    let theme = input.theme.unwrap_or(current.theme);
    let interface_font = input.interface_font.unwrap_or(current.interface_font);
    let editor_font = input.editor_font.unwrap_or(current.editor_font);
    let editor_font_size = input.editor_font_size.unwrap_or(current.editor_font_size);
    let monospace_font = input.monospace_font.unwrap_or(current.monospace_font);
    let default_line_spacing = input
        .default_line_spacing
        .unwrap_or(current.default_line_spacing);
    let layout_density = input.layout_density.unwrap_or(current.layout_density);
    let sidebar_width = input.sidebar_width.unwrap_or(current.sidebar_width);
    let spellcheck = input.spellcheck.unwrap_or(current.spellcheck);
    let default_export_format = input
        .default_export_format
        .unwrap_or(current.default_export_format);
    let last_view = input.last_view.unwrap_or(current.last_view);
    let last_folder_id = input.last_folder_id.unwrap_or(current.last_folder_id);
    let last_note_id = input.last_note_id.unwrap_or(current.last_note_id);
    let dashboard_view = input.dashboard_view.unwrap_or(current.dashboard_view);
    let dictionary_language = input
        .dictionary_language
        .unwrap_or(current.dictionary_language);
    let toolbar_character_width = input
        .toolbar_character_width
        .unwrap_or(current.toolbar_character_width);
    let toolbar_paragraph_width = input
        .toolbar_paragraph_width
        .unwrap_or(current.toolbar_paragraph_width);
    let toolbar_styles_width = input
        .toolbar_styles_width
        .unwrap_or(current.toolbar_styles_width);
    let toolbar_note_width = input
        .toolbar_note_width
        .unwrap_or(current.toolbar_note_width);
    let toolbar_tools_width = input
        .toolbar_tools_width
        .unwrap_or(current.toolbar_tools_width);

    if !matches!(theme.as_str(), "soft" | "dark" | "atelier") {
        return Err("Il tema selezionato non è valido.".to_string());
    }
    if !INTERFACE_FONTS.contains(&interface_font.as_str()) {
        return Err("Il carattere dell'interfaccia non è valido.".to_string());
    }
    if !EDITOR_FONTS.contains(&editor_font.as_str()) {
        return Err("Il carattere del testo non è valido.".to_string());
    }
    if !(12..=28).contains(&editor_font_size) {
        return Err("La dimensione del testo deve essere compresa tra 12 e 28 pixel.".to_string());
    }
    if !MONOSPACE_FONTS.contains(&monospace_font.as_str()) {
        return Err("Il carattere monospaziato non è valido.".to_string());
    }
    if !(1..=5).contains(&default_line_spacing) {
        return Err("L'interlinea predefinita deve essere compresa tra 1 e 5.".to_string());
    }
    if !matches!(layout_density.as_str(), "compact" | "balanced" | "spacious") {
        return Err("Il layout selezionato non è valido.".to_string());
    }
    if !(220..=420).contains(&sidebar_width) {
        return Err("La larghezza del menu deve essere compresa tra 220 e 420 pixel.".to_string());
    }
    if !matches!(default_export_format.as_str(), "markdown" | "html" | "pdf") {
        return Err("Il formato di esportazione non è valido.".to_string());
    }
    if !matches!(
        last_view.as_str(),
        "dashboard" | "editor" | "archive" | "trash"
    ) {
        return Err("La vista selezionata non è valida.".to_string());
    }
    if !matches!(dashboard_view.as_str(), "grid" | "list") {
        return Err("La visualizzazione della Bacheca non è valida.".to_string());
    }
    if !DICTIONARY_LANGUAGES.contains(&dictionary_language.as_str()) {
        return Err("Il dizionario selezionato non è valido.".to_string());
    }
    if [
        toolbar_character_width,
        toolbar_paragraph_width,
        toolbar_styles_width,
        toolbar_note_width,
        toolbar_tools_width,
    ]
    .iter()
    .any(|width| !(90..=420).contains(width))
    {
        return Err(
            "La larghezza delle sezioni della toolbar deve essere compresa tra 90 e 420 pixel."
                .to_string(),
        );
    }

    connection
        .execute(
            "UPDATE settings SET theme = ?1, interface_font = ?2, editor_font = ?3, editor_font_size = ?4, monospace_font = ?5, default_line_spacing = ?6, layout_density = ?7, sidebar_width = ?8, spellcheck = ?9, default_export_format = ?10, last_view = ?11, last_folder_id = ?12, last_note_id = ?13, dashboard_view = ?14, dictionary_language = ?15, toolbar_character_width = ?16, toolbar_paragraph_width = ?17, toolbar_styles_width = ?18, toolbar_note_width = ?19, toolbar_tools_width = ?20, bullet_shape = ?21, checkbox_shape = ?22, custom_colors = ?23 WHERE id = 1",
            params![theme, interface_font, editor_font, editor_font_size, monospace_font, default_line_spacing, layout_density, sidebar_width, spellcheck, default_export_format, last_view, last_folder_id, last_note_id, dashboard_view, dictionary_language, toolbar_character_width, toolbar_paragraph_width, toolbar_styles_width, toolbar_note_width, toolbar_tools_width, bullet_shape, checkbox_shape, serde_json::to_string(&custom_colors).map_err(|e| e.to_string())?],
        )
        .map_err(|error| format!("Non è possibile salvare le impostazioni: {error}"))?;
    read_settings(&connection)
}

#[tauri::command(async)]
pub fn list_notes(
    input: ListNotesInput,
    state: State<'_, AppState>,
) -> Result<Vec<NoteSummary>, String> {
    let connection = lock_connection(&state)?;
    let query = input.query.unwrap_or_default().trim().to_string();
    let search = "(?1 = '' OR n.title LIKE '%' || ?1 || '%' COLLATE NOCASE OR n.subtitle LIKE '%' || ?1 || '%' COLLATE NOCASE OR n.plain_text LIKE '%' || ?1 || '%' COLLATE NOCASE)";
    let condition = match input.condition.as_deref().unwrap_or("all") {
        "all" => "",
        "recent" => " AND n.updated_at >= CAST(strftime('%s', 'now', '-7 days') AS INTEGER) * 1000",
        "attention" => " AND n.needs_attention = 1",
        "pinned" => " AND n.pinned = 1",
        _ => return Err("La condizione richiesta non è valida.".to_string()),
    };
    let requested_order = input.order.as_deref();
    let dashboard_order = match requested_order.unwrap_or("recent") {
        "recent" => "n.pinned DESC, n.updated_at DESC",
        "oldest" => "n.updated_at ASC",
        "title" => "n.pinned DESC, n.title COLLATE NOCASE ASC",
        _ => return Err("L'ordinamento richiesto non è valido.".to_string()),
    };
    let (sql, folder_id) = match input.scope.as_str() {
        "all" => (
            summary_query(&format!(
                "WHERE n.trashed_at IS NULL AND n.archived_at IS NULL AND {search}{condition} ORDER BY {dashboard_order}"
            )),
            None,
        ),
        "archive" => (
            summary_query(&format!(
                "WHERE n.trashed_at IS NULL AND n.archived_at IS NOT NULL AND {search} ORDER BY n.archived_at DESC"
            )),
            None,
        ),
        "trash" => (
            summary_query(&format!(
                "WHERE n.trashed_at IS NOT NULL AND {search} ORDER BY n.trashed_at DESC"
            )),
            None,
        ),
        "folder" => {
            let folder_id = input
                .folder_id
                .ok_or_else(|| "Seleziona una cartella.".to_string())?;
            let order = if requested_order.is_some() {
                dashboard_order
            } else {
                "n.pinned DESC, n.position, n.updated_at DESC"
            };
            (
                summary_query(&format!(
                    "WHERE n.folder_id = ?2 AND n.trashed_at IS NULL AND n.archived_at IS NULL AND {search}{condition} ORDER BY {order}"
                )),
                Some(folder_id),
            )
        }
        _ => return Err("La raccolta di note richiesta non è valida.".to_string()),
    };
    let mut statement = connection
        .prepare(&sql)
        .map_err(|error| format!("Non è possibile preparare l'elenco note: {error}"))?;
    let rows = if let Some(folder_id) = folder_id {
        statement.query_map(params![query, folder_id], note_summary_from_row)
    } else {
        statement.query_map(params![query], note_summary_from_row)
    }
    .map_err(|error| format!("Non è possibile leggere le note: {error}"))?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Non è possibile comporre l'elenco note: {error}"))
}

#[tauri::command(async)]
pub fn dashboard_overview(state: State<'_, AppState>) -> Result<DashboardOverview, String> {
    let connection = lock_connection(&state)?;
    let count = |predicate: &str| -> Result<i64, String> {
        connection
            .query_row(
                &format!("SELECT COUNT(*) FROM notes n WHERE {predicate}"),
                [],
                |row| row.get(0),
            )
            .map_err(|error| format!("Non è possibile calcolare il riepilogo: {error}"))
    };
    let total_active = count("n.trashed_at IS NULL AND n.archived_at IS NULL")?;
    let recently_updated = count(
        "n.trashed_at IS NULL AND n.archived_at IS NULL AND n.updated_at >= CAST(strftime('%s', 'now', '-7 days') AS INTEGER) * 1000",
    )?;
    let needs_attention_count =
        count("n.trashed_at IS NULL AND n.archived_at IS NULL AND n.needs_attention = 1")?;
    let pinned_count = count("n.trashed_at IS NULL AND n.archived_at IS NULL AND n.pinned = 1")?;
    let archive_count = count("n.trashed_at IS NULL AND n.archived_at IS NOT NULL")?;
    let trash_count = count("n.trashed_at IS NOT NULL")?;

    let activity_sql = "
        SELECT kind, label, occurred_at FROM (
            SELECT CASE WHEN n.updated_at = n.created_at THEN 'note-created' ELSE 'note-updated' END kind,
                   n.title label, n.updated_at occurred_at
            FROM notes n WHERE n.trashed_at IS NULL AND n.archived_at IS NULL
            UNION ALL
            SELECT 'note-archived', n.title, n.archived_at
            FROM notes n WHERE n.trashed_at IS NULL AND n.archived_at IS NOT NULL
            UNION ALL
            SELECT 'folder-created', f.name, f.created_at
            FROM folders f WHERE f.trashed_at IS NULL
        ) ORDER BY occurred_at DESC LIMIT 6";
    let mut activity_statement = connection
        .prepare(activity_sql)
        .map_err(|error| format!("Non è possibile preparare le attività recenti: {error}"))?;
    let recent_activity = activity_statement
        .query_map([], |row| {
            Ok(DashboardActivity {
                kind: row.get(0)?,
                label: row.get(1)?,
                occurred_at: row.get(2)?,
            })
        })
        .map_err(|error| format!("Non è possibile leggere le attività recenti: {error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Non è possibile comporre le attività recenti: {error}"))?;

    let mut folder_statement = connection
        .prepare("SELECT f.id, f.name, COUNT(n.id) count FROM folders f LEFT JOIN notes n ON n.folder_id = f.id AND n.archived_at IS NULL AND n.trashed_at IS NULL WHERE f.trashed_at IS NULL GROUP BY f.id, f.name ORDER BY count DESC, f.name COLLATE NOCASE LIMIT 5")
        .map_err(|error| format!("Non è possibile preparare le cartelle più usate: {error}"))?;
    let most_used_folders = folder_statement
        .query_map([], |row| {
            Ok(FolderUsage {
                id: row.get(0)?,
                name: row.get(1)?,
                count: row.get(2)?,
            })
        })
        .map_err(|error| format!("Non è possibile leggere le cartelle più usate: {error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Non è possibile comporre le cartelle più usate: {error}"))?;

    let attention_sql = summary_query(
        "WHERE n.trashed_at IS NULL AND n.archived_at IS NULL AND n.needs_attention = 1 ORDER BY n.updated_at DESC LIMIT 4",
    );
    let mut attention_statement = connection
        .prepare(&attention_sql)
        .map_err(|error| format!("Non è possibile preparare le note da sistemare: {error}"))?;
    let needs_attention_notes = attention_statement
        .query_map([], note_summary_from_row)
        .map_err(|error| format!("Non è possibile leggere le note da sistemare: {error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Non è possibile comporre le note da sistemare: {error}"))?;

    Ok(DashboardOverview {
        total_active,
        recently_updated,
        needs_attention_count,
        pinned_count,
        archive_count,
        trash_count,
        recent_activity,
        most_used_folders,
        needs_attention_notes,
    })
}

#[tauri::command(async)]
pub fn list_dictionary_words(
    input: DictionaryLanguageInput,
    state: State<'_, AppState>,
) -> Result<Vec<String>, String> {
    validate_dictionary_language(&input.language)?;
    let connection = lock_connection(&state)?;
    let mut statement = connection
        .prepare(
            "SELECT word FROM dictionary_words WHERE language = ?1 ORDER BY word COLLATE NOCASE",
        )
        .map_err(|error| format!("Non è possibile preparare il dizionario personale: {error}"))?;
    statement
        .query_map([input.language], |row| row.get(0))
        .map_err(|error| format!("Non è possibile leggere il dizionario personale: {error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Non è possibile comporre il dizionario personale: {error}"))
}

#[tauri::command(async)]
pub fn add_dictionary_word(
    input: AddDictionaryWordInput,
    state: State<'_, AppState>,
) -> Result<(), String> {
    validate_dictionary_language(&input.language)?;
    let word = input.word.trim().to_lowercase();
    if word.is_empty()
        || word.chars().count() > 64
        || !word
            .chars()
            .all(|character| character.is_alphabetic() || matches!(character, '\'' | '-'))
    {
        return Err("La parola non è valida per il dizionario.".to_string());
    }
    let connection = lock_connection(&state)?;
    connection
        .execute(
            "INSERT OR IGNORE INTO dictionary_words (language, word, created_at) VALUES (?1, ?2, ?3)",
            params![input.language, word, now_ms()?],
        )
        .map_err(|error| format!("Non è possibile aggiungere la parola al dizionario: {error}"))?;
    drop(connection);
    if let Some(dictionary) = state
        .dictionaries
        .lock()
        .map_err(|_| "Il correttore ortografico non è disponibile.".to_string())?
        .get_mut(&input.language)
    {
        dictionary
            .add(&word)
            .map_err(|error| format!("Non è possibile aggiornare il dizionario: {error}"))?;
    }
    Ok(())
}

#[tauri::command(async)]
pub fn check_spelling(
    input: CheckSpellingInput,
    state: State<'_, AppState>,
) -> Result<Vec<MisspelledWord>, String> {
    validate_dictionary_language(&input.language)?;
    if input.words.len() > 20_000 || input.ignored.len() > 2_000 {
        return Err("Il testo contiene troppe parole da controllare.".to_string());
    }
    let custom_words = {
        let connection = lock_connection(&state)?;
        let mut statement = connection
            .prepare("SELECT word FROM dictionary_words WHERE language = ?1")
            .map_err(|error| {
                format!("Non è possibile preparare il dizionario personale: {error}")
            })?;
        statement
            .query_map([&input.language], |row| row.get::<_, String>(0))
            .map_err(|error| format!("Non è possibile leggere il dizionario personale: {error}"))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| format!("Non è possibile comporre il dizionario personale: {error}"))?
    };
    let mut dictionaries = state
        .dictionaries
        .lock()
        .map_err(|_| "Il correttore ortografico non è disponibile.".to_string())?;
    if !dictionaries.contains_key(&input.language) {
        let (aff, dic) = dictionary_source(&input.language)?;
        let mut dictionary = spellbook::Dictionary::new(aff, dic)
            .map_err(|error| format!("Non è possibile caricare il dizionario: {error}"))?;
        for word in custom_words {
            dictionary.add(&word).map_err(|error| {
                format!("Il dizionario personale contiene una parola non valida: {error}")
            })?;
        }
        dictionaries.insert(input.language.clone(), dictionary);
    }
    let dictionary = dictionaries
        .get(&input.language)
        .ok_or_else(|| "Il dizionario richiesto non è disponibile.".to_string())?;
    let ignored = input
        .ignored
        .into_iter()
        .map(|word| word.to_lowercase())
        .collect::<HashSet<_>>();
    let mut seen = HashSet::new();
    let mut misspelled = Vec::new();
    for word in input.words {
        if word.chars().count() > 64 {
            continue;
        }
        let normalized = word.to_lowercase();
        if ignored.contains(&normalized)
            || !seen.insert(normalized.clone())
            || dictionary.check(&word)
        {
            continue;
        }
        let mut suggestions = Vec::new();
        dictionary.suggest(&word, &mut suggestions);
        suggestions.truncate(5);
        misspelled.push(MisspelledWord {
            word: normalized,
            suggestions,
        });
    }
    Ok(misspelled)
}

#[tauri::command(async)]
pub fn create_folder(
    input: CreateFolderInput,
    state: State<'_, AppState>,
) -> Result<Folder, String> {
    let name = validate_folder(&input.name, &input.icon, &input.color)?;
    let connection = lock_connection(&state)?;
    let now = now_ms()?;
    let position: i64 = connection
        .query_row(
            "SELECT COALESCE(MAX(position), -1) + 1 FROM folders WHERE trashed_at IS NULL",
            [],
            |row| row.get(0),
        )
        .map_err(|error| format!("Non è possibile ordinare la nuova cartella: {error}"))?;
    connection
        .execute(
            "INSERT INTO folders (name, icon, color, position, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?5)",
            params![name, input.icon, input.color, position, now],
        )
        .map_err(|error| format!("Non è possibile creare la cartella: {error}"))?;
    read_folder(&connection, connection.last_insert_rowid())
}

#[tauri::command(async)]
pub fn update_folder(
    input: UpdateFolderInput,
    state: State<'_, AppState>,
) -> Result<Folder, String> {
    let name = validate_folder(&input.name, &input.icon, &input.color)?;
    let connection = lock_connection(&state)?;
    let changed = connection
        .execute(
            "UPDATE folders SET name = ?1, icon = ?2, color = ?3, updated_at = ?4 WHERE id = ?5 AND trashed_at IS NULL",
            params![name, input.icon, input.color, now_ms()?, input.id],
        )
        .map_err(|error| format!("Non è possibile modificare la cartella: {error}"))?;
    if changed == 0 {
        return Err("La cartella non esiste più.".to_string());
    }
    read_folder(&connection, input.id)
}

#[tauri::command(async)]
pub fn delete_folder(input: IdInput, state: State<'_, AppState>) -> Result<(), String> {
    let connection = lock_connection(&state)?;
    let active_count: i64 = connection
        .query_row(
            "SELECT COUNT(*) FROM notes WHERE folder_id = ?1 AND archived_at IS NULL AND trashed_at IS NULL",
            [input.id],
            |row| row.get(0),
        )
        .map_err(|error| format!("Non è possibile controllare la cartella: {error}"))?;
    if active_count > 0 {
        return Err(format!(
            "La cartella contiene {active_count} note attive. Spostale o archiviale prima di eliminarla."
        ));
    }
    if connection
        .execute("DELETE FROM folders WHERE id = ?1", [input.id])
        .map_err(|error| format!("Non è possibile eliminare la cartella: {error}"))?
        == 0
    {
        return Err("La cartella non esiste più.".to_string());
    }
    Ok(())
}

#[tauri::command(async)]
pub fn create_note(
    input: CreateNoteInput,
    state: State<'_, AppState>,
) -> Result<NoteDetail, String> {
    let connection = lock_connection(&state)?;
    ensure_folder(&connection, input.folder_id)?;
    let line_spacing: i64 = connection
        .query_row(
            "SELECT default_line_spacing FROM settings WHERE id = 1",
            [],
            |row| row.get(0),
        )
        .map_err(|error| format!("Non è possibile leggere l'interlinea predefinita: {error}"))?;
    let now = now_ms()?;
    let position: i64 = connection
        .query_row(
            "SELECT COALESCE(MAX(position), -1) + 1 FROM notes WHERE folder_id = ?1 AND archived_at IS NULL AND trashed_at IS NULL",
            [input.folder_id],
            |row| row.get(0),
        )
        .map_err(|error| format!("Non è possibile ordinare la nuova nota: {error}"))?;
    let content = empty_document();
    let content_json = serde_json::to_string(&content)
        .map_err(|error| format!("Non è possibile preparare la nuova nota: {error}"))?;
    connection
        .execute(
            "INSERT INTO notes (folder_id, title, subtitle, content_json, plain_text, paper_color, line_spacing, position, created_at, updated_at) VALUES (?1, 'Senza titolo', '', ?2, '', 'cream', ?3, ?4, ?5, ?5)",
            params![input.folder_id, content_json, line_spacing, position, now],
        )
        .map_err(|error| format!("Non è possibile creare la nota: {error}"))?;
    let note_id = connection.last_insert_rowid();
    connection
        .execute(
            "UPDATE settings SET last_view = 'editor', last_folder_id = ?1, last_note_id = ?2 WHERE id = 1",
            params![input.folder_id, note_id],
        )
        .map_err(|error| format!("La nota è stata creata, ma non è possibile ricordarla: {error}"))?;
    read_note_detail(&connection, note_id)
}

#[tauri::command(async)]
pub fn get_note(input: IdInput, state: State<'_, AppState>) -> Result<NoteDetail, String> {
    let connection = lock_connection(&state)?;
    let note = read_note_detail(&connection, input.id)?;
    // A note in the Trash is only viewed (read-only): it must not become the note reopened at startup.
    if note.summary.trashed_at.is_some() {
        return Ok(note);
    }
    connection
        .execute(
            "UPDATE settings SET last_view = ?1, last_folder_id = ?2, last_note_id = ?3 WHERE id = 1",
            params![if note.summary.archived_at.is_some() { "archive" } else { "editor" }, note.summary.folder_id, note.summary.id],
        )
        .map_err(|error| format!("La nota è stata aperta, ma non è possibile ricordarla: {error}"))?;
    Ok(note)
}

#[tauri::command(async)]
pub fn save_note(input: SaveNoteInput, state: State<'_, AppState>) -> Result<SaveReceipt, String> {
    let title = input.title.trim();
    if title.is_empty() || title.chars().count() > 200 {
        return Err("Il titolo deve contenere da 1 a 200 caratteri.".to_string());
    }
    if input.subtitle.chars().count() > 300 {
        return Err("Il sottotitolo non può superare 300 caratteri.".to_string());
    }
    if !PAPER_COLORS.contains(&input.paper_color.as_str()) {
        return Err("Il colore del foglio non è valido.".to_string());
    }
    if !(1..=5).contains(&input.line_spacing) {
        return Err("L'interlinea deve essere compresa tra 1 e 5.".to_string());
    }
    if !(720..=1280).contains(&input.paper_width) {
        return Err(
            "La larghezza del foglio deve essere compresa tra 720 e 1280 pixel.".to_string(),
        );
    }
    for shape in [&input.bullet_shape, &input.checkbox_shape].into_iter().flatten() {
        if !SHAPES.contains(&shape.as_str()) { return Err("La forma selezionata non è valida.".into()); }
    }
    let plain_text = validate_and_extract(&input.content)?;
    let content_json = serde_json::to_string(&input.content)
        .map_err(|error| format!("Non è possibile serializzare la nota: {error}"))?;
    let now = now_ms()?;
    let connection = lock_connection(&state)?;
    for id in crate::db::attachment_ids(&input.content) {
        let owned: bool = connection.query_row("SELECT EXISTS(SELECT 1 FROM attachments WHERE id=?1 AND note_id=?2)", params![id,input.id], |r| r.get(0)).map_err(|e| e.to_string())?;
        if !owned { return Err("Un'immagine non appartiene alla nota. Attendi il completamento dell'incolla.".into()); }
    }
    let changed = connection
        .execute(
            "UPDATE notes SET title = ?1, subtitle = ?2, paper_color = ?3, line_spacing = ?4, paper_width = ?5, content_json = ?6, plain_text = ?7, revision = revision + 1, updated_at = ?8, bullet_shape = ?9, checkbox_shape = ?10 WHERE id = ?11 AND revision = ?12 AND archived_at IS NULL AND trashed_at IS NULL",
            params![title, input.subtitle.trim(), input.paper_color, input.line_spacing, input.paper_width, content_json, plain_text, now, input.bullet_shape, input.checkbox_shape, input.id, input.expected_revision],
        )
        .map_err(|error| format!("Non è possibile salvare la nota: {error}"))?;
    if changed == 0 {
        return Err("La nota è archiviata, è stata modificata altrove o non è più disponibile. Riaprila prima di continuare.".to_string());
    }
    Ok(SaveReceipt {
        note_id: input.id,
        revision: input.expected_revision + 1,
        updated_at: now,
    })
}

#[tauri::command(async)]
pub fn move_note(input: MoveNoteInput, state: State<'_, AppState>) -> Result<(), String> {
    let connection = lock_connection(&state)?;
    ensure_folder(&connection, input.folder_id)?;
    let position: i64 = connection
        .query_row(
            "SELECT COALESCE(MAX(position), -1) + 1 FROM notes WHERE folder_id = ?1 AND archived_at IS NULL AND trashed_at IS NULL",
            [input.folder_id],
            |row| row.get(0),
        )
        .map_err(|error| format!("Non è possibile ordinare la nota: {error}"))?;
    let changed = connection
        .execute(
            "UPDATE notes SET folder_id = ?1, position = ?2, updated_at = ?3 WHERE id = ?4 AND archived_at IS NULL AND trashed_at IS NULL",
            params![input.folder_id, position, now_ms()?, input.id],
        )
        .map_err(|error| format!("Non è possibile spostare la nota: {error}"))?;
    if changed == 0 {
        return Err("La nota non è disponibile o si trova nell'Archivio.".to_string());
    }
    Ok(())
}

#[tauri::command(async)]
pub fn archive_note(input: IdInput, state: State<'_, AppState>) -> Result<(), String> {
    let connection = lock_connection(&state)?;
    let folder_name: Option<String> = connection
        .query_row(
            "SELECT f.name FROM notes n LEFT JOIN folders f ON f.id = n.folder_id WHERE n.id = ?1 AND n.archived_at IS NULL AND n.trashed_at IS NULL",
            [input.id],
            |row| row.get(0),
        )
        .optional()
        .map_err(|error| format!("Non è possibile leggere la nota: {error}"))?
        .flatten();
    let folder_name =
        folder_name.ok_or_else(|| "La nota non è disponibile o è già archiviata.".to_string())?;
    connection
        .execute(
            "UPDATE notes SET archived_at = ?1, origin_folder_name = ?2, updated_at = ?1 WHERE id = ?3",
            params![now_ms()?, folder_name, input.id],
        )
        .map_err(|error| format!("Non è possibile archiviare la nota: {error}"))?;
    Ok(())
}

#[tauri::command(async)]
pub fn restore_note(input: RestoreNoteInput, state: State<'_, AppState>) -> Result<(), String> {
    let connection = lock_connection(&state)?;
    let original_folder: Option<Option<i64>> = connection
        .query_row(
            "SELECT folder_id FROM notes WHERE id = ?1 AND archived_at IS NOT NULL AND trashed_at IS NULL",
            [input.id],
            |row| row.get(0),
        )
        .optional()
        .map_err(|error| format!("Non è possibile leggere la nota archiviata: {error}"))?;
    let original_folder =
        original_folder.ok_or_else(|| "La nota non è disponibile nell'Archivio.".to_string())?;
    let folder_id = if let Some(folder_id) = input.folder_id {
        folder_id
    } else if let Some(folder_id) = original_folder {
        ensure_folder(&connection, folder_id)?;
        folder_id
    } else {
        return Err(
            "La cartella originale non esiste più. Scegli una nuova destinazione.".to_string(),
        );
    };
    ensure_folder(&connection, folder_id)?;
    connection
        .execute(
            "UPDATE notes SET folder_id = ?1, archived_at = NULL, origin_folder_name = NULL, updated_at = ?2 WHERE id = ?3",
            params![folder_id, now_ms()?, input.id],
        )
        .map_err(|error| format!("Non è possibile ripristinare la nota: {error}"))?;
    Ok(())
}

#[tauri::command(async)]
pub fn trash_note(input: IdInput, state: State<'_, AppState>) -> Result<(), String> {
    let connection = lock_connection(&state)?;
    let changed = connection
        .execute(
            "UPDATE notes SET trashed_at = ?1, updated_at = ?1 WHERE id = ?2 AND trashed_at IS NULL",
            params![now_ms()?, input.id],
        )
        .map_err(|error| format!("Non è possibile spostare la nota nel Cestino: {error}"))?;
    if changed == 0 {
        return Err("La nota non esiste più o è già nel Cestino.".to_string());
    }
    Ok(())
}

#[tauri::command(async)]
pub fn restore_trashed_note(
    input: RestoreNoteInput,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let connection = lock_connection(&state)?;
    let current_folder: Option<Option<i64>> = connection
        .query_row(
            "SELECT folder_id FROM notes WHERE id = ?1 AND trashed_at IS NOT NULL",
            [input.id],
            |row| row.get(0),
        )
        .optional()
        .map_err(|error| format!("Non è possibile leggere la nota nel Cestino: {error}"))?;
    let folder_id = input
        .folder_id
        .or(current_folder.flatten())
        .ok_or_else(|| "Scegli una cartella in cui ripristinare la nota.".to_string())?;
    ensure_folder(&connection, folder_id)?;
    let position: i64 = connection
        .query_row(
            "SELECT COALESCE(MAX(position), -1) + 1 FROM notes WHERE folder_id = ?1 AND archived_at IS NULL AND trashed_at IS NULL",
            [folder_id],
            |row| row.get(0),
        )
        .map_err(|error| format!("Non è possibile ordinare la nota ripristinata: {error}"))?;
    connection
        .execute(
            "UPDATE notes SET folder_id = ?1, position = ?2, archived_at = NULL, origin_folder_name = NULL, trashed_at = NULL, updated_at = ?3 WHERE id = ?4 AND trashed_at IS NOT NULL",
            params![folder_id, position, now_ms()?, input.id],
        )
        .map_err(|error| format!("Non è possibile ripristinare la nota: {error}"))?;
    Ok(())
}

#[tauri::command(async)]
pub fn delete_note(input: IdInput, state: State<'_, AppState>) -> Result<(), String> {
    let connection = lock_connection(&state)?;
    if connection
        .execute("DELETE FROM notes WHERE id = ?1", [input.id])
        .map_err(|error| format!("Non è possibile eliminare definitivamente la nota: {error}"))?
        == 0
    {
        return Err("La nota non esiste più.".to_string());
    }
    Ok(())
}

#[tauri::command(async)]
pub fn pin_note(input: PinNoteInput, state: State<'_, AppState>) -> Result<(), String> {
    let connection = lock_connection(&state)?;
    let changed = connection
        .execute(
            "UPDATE notes SET pinned = ?1, updated_at = ?2 WHERE id = ?3 AND archived_at IS NULL AND trashed_at IS NULL",
            params![input.pinned, now_ms()?, input.id],
        )
        .map_err(|error| format!("Non è possibile aggiornare la nota in evidenza: {error}"))?;
    if changed == 0 {
        return Err("La nota non è disponibile.".to_string());
    }
    Ok(())
}

#[tauri::command(async)]
pub fn set_note_attention(
    input: SetNoteAttentionInput,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let connection = lock_connection(&state)?;
    let changed = connection
        .execute(
            "UPDATE notes SET needs_attention = ?1, updated_at = ?2 WHERE id = ?3 AND archived_at IS NULL AND trashed_at IS NULL",
            params![input.needs_attention, now_ms()?, input.id],
        )
        .map_err(|error| format!("Non è possibile aggiornare lo stato della nota: {error}"))?;
    if changed == 0 {
        return Err("La nota non è disponibile.".to_string());
    }
    Ok(())
}

#[tauri::command(async)]
pub fn reorder_notes(input: ReorderNotesInput, state: State<'_, AppState>) -> Result<(), String> {
    let mut connection = lock_connection(&state)?;
    ensure_folder(&connection, input.folder_id)?;
    let transaction = connection
        .transaction()
        .map_err(|error| format!("Non è possibile iniziare il riordino: {error}"))?;
    for (position, note_id) in input.note_ids.iter().enumerate() {
        let changed = transaction
            .execute(
                "UPDATE notes SET position = ?1 WHERE id = ?2 AND folder_id = ?3 AND pinned = 0 AND archived_at IS NULL AND trashed_at IS NULL",
                params![position as i64, note_id, input.folder_id],
            )
            .map_err(|error| format!("Non è possibile riordinare le note: {error}"))?;
        if changed == 0 {
            return Err("Una nota non può essere spostata in questa posizione.".to_string());
        }
    }
    transaction
        .commit()
        .map_err(|error| format!("Non è possibile completare il riordino: {error}"))
}

#[tauri::command]
pub async fn export_note(
    input: ExportNoteInput,
    app: AppHandle,
    window: WebviewWindow,
    state: State<'_, AppState>,
) -> Result<ExportReceipt, String> {
    if !matches!(input.format.as_str(), "markdown" | "html") {
        return Err("Il formato di esportazione non è valido.".to_string());
    }
    let (title, subtitle, paper_color, line_spacing, editor_font, editor_font_size, document) = {
        let connection = lock_connection(&state)?;
        let (title, subtitle, content_json, paper_color, line_spacing, editor_font, editor_font_size): (
            String,
            String,
            String,
            String,
            i64,
            String,
            i64,
        ) = connection
            .query_row(
                "SELECT n.title, n.subtitle, n.content_json, n.paper_color, n.line_spacing, s.editor_font, s.editor_font_size FROM notes n CROSS JOIN settings s WHERE n.id = ?1 AND n.trashed_at IS NULL AND s.id = 1",
                [input.id],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?, row.get(5)?, row.get(6)?)),
            )
            .optional()
            .map_err(|error| format!("Non è possibile leggere la nota da esportare: {error}"))?
            .ok_or_else(|| "La nota non esiste più.".to_string())?;
        let document: Value = serde_json::from_str(&content_json)
            .map_err(|error| format!("Il contenuto della nota non è valido: {error}"))?;
        validate_and_extract(&document)?;
        (
            title,
            subtitle,
            paper_color,
            line_spacing,
            editor_font,
            editor_font_size,
            document,
        )
    };
    let (extension, label, content) = if input.format == "html" {
        (
            "html",
            "Documento HTML",
            render_html(
                &title,
                &subtitle,
                &document,
                &paper_color,
                line_spacing,
                &editor_font,
                editor_font_size,
            ),
        )
    } else {
        (
            "md",
            "Documento Markdown",
            render_markdown(&title, &subtitle, &document),
        )
    };
    window
        .set_focus()
        .map_err(|error| format!("Non è possibile portare in primo piano la finestra: {error}"))?;
    let file_name = format!("{}.{}", safe_file_name(&title), extension);
    // The native dialog waits for the user: keep it off the async worker threads.
    tauri::async_runtime::spawn_blocking(move || {
        let selected = app
            .dialog()
            .file()
            .set_parent(&window)
            .set_title("Esporta nota")
            .set_file_name(file_name)
            .add_filter(label, &[extension])
            .blocking_save_file();
        let Some(selected) = selected else {
            return Ok(ExportReceipt {
                cancelled: true,
                path: None,
            });
        };
        let path = selected
            .into_path()
            .map_err(|error| format!("Il percorso scelto non è valido: {error}"))?;
        fs::write(&path, content)
            .map_err(|error| format!("Non è possibile scrivere il file esportato: {error}"))?;
        Ok(ExportReceipt {
            cancelled: false,
            path: Some(path.to_string_lossy().into_owned()),
        })
    })
    .await
    .map_err(|error| format!("L'esportazione si è interrotta: {error}"))?
}

#[tauri::command]
pub fn window_print(window: WebviewWindow) -> Result<(), String> {
    window
        .print()
        .map_err(|error| format!("Non è possibile aprire la stampa: {error}"))
}

#[tauri::command]
pub fn window_close(window: WebviewWindow) -> Result<(), String> {
    window
        .destroy()
        .map_err(|error| format!("Non è possibile chiudere la finestra: {error}"))
}

fn lock_connection<'a>(
    state: &'a State<'_, AppState>,
) -> Result<std::sync::MutexGuard<'a, Connection>, String> {
    state
        .connection
        .lock()
        .map_err(|_| "Il database è temporaneamente non disponibile.".to_string())
}

fn summary_query(suffix: &str) -> String {
    format!(
        "SELECT {SUMMARY_COLUMNS} FROM notes n LEFT JOIN folders f ON f.id = n.folder_id {suffix}"
    )
}

fn read_folders(connection: &Connection) -> Result<Vec<Folder>, String> {
    let mut statement = connection
        .prepare("SELECT f.id, f.name, f.icon, f.color, f.position, (SELECT COUNT(*) FROM notes n WHERE n.folder_id = f.id AND n.archived_at IS NULL AND n.trashed_at IS NULL), f.created_at, f.updated_at, f.trashed_at FROM folders f WHERE f.trashed_at IS NULL ORDER BY f.position, f.id")
        .map_err(|error| format!("Non è possibile preparare le cartelle: {error}"))?;
    statement
        .query_map([], folder_from_row)
        .map_err(|error| format!("Non è possibile leggere le cartelle: {error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Non è possibile comporre le cartelle: {error}"))
}

fn read_folder(connection: &Connection, id: i64) -> Result<Folder, String> {
    connection
        .query_row(
            "SELECT f.id, f.name, f.icon, f.color, f.position, (SELECT COUNT(*) FROM notes n WHERE n.folder_id = f.id AND n.archived_at IS NULL AND n.trashed_at IS NULL), f.created_at, f.updated_at, f.trashed_at FROM folders f WHERE f.id = ?1 AND f.trashed_at IS NULL",
            [id], folder_from_row,
        )
        .optional().map_err(|error| format!("Non è possibile leggere la cartella: {error}"))?
        .ok_or_else(|| "La cartella non esiste più.".to_string())
}

fn folder_from_row(row: &Row<'_>) -> rusqlite::Result<Folder> {
    Ok(Folder {
        id: row.get(0)?,
        name: row.get(1)?,
        icon: row.get(2)?,
        color: row.get(3)?,
        position: row.get(4)?,
        note_count: row.get(5)?,
        created_at: row.get(6)?,
        updated_at: row.get(7)?,
        trashed_at: row.get(8)?,
    })
}

fn read_tags(connection: &Connection) -> Result<Vec<Tag>, String> {
    let mut statement = connection
        .prepare("SELECT id, name, color FROM tags ORDER BY name COLLATE NOCASE")
        .map_err(|error| format!("Non è possibile preparare i tag: {error}"))?;
    statement
        .query_map([], |row| {
            Ok(Tag {
                id: row.get(0)?,
                name: row.get(1)?,
                color: row.get(2)?,
            })
        })
        .map_err(|error| format!("Non è possibile leggere i tag: {error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Non è possibile comporre i tag: {error}"))
}

fn read_settings(connection: &Connection) -> Result<AppSettings, String> {
    let mut settings = connection.query_row(
        "SELECT theme, interface_font, editor_font, editor_font_size, monospace_font, default_line_spacing, layout_density, sidebar_width, spellcheck, default_export_format, last_view, last_folder_id, last_note_id, dashboard_view, dictionary_language, toolbar_character_width, toolbar_paragraph_width, toolbar_styles_width, toolbar_note_width, toolbar_tools_width, bullet_shape, checkbox_shape, custom_colors FROM settings WHERE id = 1",
        [],
        |row| Ok(AppSettings {
            theme: row.get(0)?, interface_font: row.get(1)?, editor_font: row.get(2)?, editor_font_size: row.get(3)?, monospace_font: row.get(4)?,
            default_line_spacing: row.get(5)?, layout_density: row.get(6)?, sidebar_width: row.get(7)?,
            spellcheck: row.get::<_, i64>(8)? != 0, default_export_format: row.get(9)?, last_view: row.get(10)?,
            last_folder_id: row.get(11)?, last_note_id: row.get(12)?, dashboard_view: row.get(13)?, dictionary_language: row.get(14)?,
            toolbar_character_width: row.get(15)?, toolbar_paragraph_width: row.get(16)?, toolbar_styles_width: row.get(17)?,
            toolbar_note_width: row.get(18)?, toolbar_tools_width: row.get(19)?,
            bullet_shape: row.get(20)?, checkbox_shape: row.get(21)?,
            custom_colors: serde_json::from_str(&row.get::<_, String>(22)?).unwrap_or_default(),
        }),
    ).map_err(|error| format!("Non è possibile leggere le impostazioni: {error}"))?;
    for (font, allowed, fallback) in [
        (&mut settings.interface_font, INTERFACE_FONTS, "roboto"),
        (&mut settings.editor_font, EDITOR_FONTS, "roboto"),
        (&mut settings.monospace_font, MONOSPACE_FONTS, "jetbrains"),
    ] {
        if !allowed.contains(&font.as_str()) { *font = fallback.to_string(); }
    }
    Ok(settings)
}

fn read_note_detail(connection: &Connection, note_id: i64) -> Result<NoteDetail, String> {
    let sql = format!(
        "SELECT {SUMMARY_COLUMNS}, n.content_json FROM notes n LEFT JOIN folders f ON f.id = n.folder_id WHERE n.id = ?1"
    );
    let (summary, content_json) = connection
        .query_row(&sql, [note_id], |row| {
            Ok((note_summary_from_row(row)?, row.get::<_, String>(21)?))
        })
        .optional()
        .map_err(|error| format!("Non è possibile leggere la nota: {error}"))?
        .ok_or_else(|| "La nota non esiste più.".to_string())?;
    let content: Value = serde_json::from_str(&content_json)
        .map_err(|error| format!("Il contenuto salvato della nota non è valido: {error}"))?;
    let mut statement = connection.prepare("SELECT id, note_id, file_name, mime_type, size_bytes, created_at FROM attachments WHERE note_id = ?1 ORDER BY created_at")
        .map_err(|error| format!("Non è possibile preparare gli allegati: {error}"))?;
    let attachments = statement
        .query_map([note_id], |row| {
            let mime_type: String = row.get(3)?;
            Ok(AttachmentMeta {
                id: row.get(0)?,
                note_id: row.get(1)?,
                file_name: row.get(2)?,
                image: mime_type.starts_with("image/"),
                mime_type,
                size_bytes: row.get(4)?,
                created_at: row.get(5)?,
            })
        })
        .map_err(|error| format!("Non è possibile leggere gli allegati: {error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Non è possibile comporre gli allegati: {error}"))?;
    Ok(NoteDetail {
        summary,
        content,
        attachments,
    })
}

fn note_summary_from_row(row: &Row<'_>) -> rusqlite::Result<NoteSummary> {
    Ok(NoteSummary {
        id: row.get(0)?,
        folder_id: row.get(1)?,
        folder_name: row.get(2)?,
        title: row.get(3)?,
        subtitle: row.get(4)?,
        preview: row.get(5)?,
        paper_color: row.get(6)?,
        line_spacing: row.get(7)?,
        paper_width: row.get(8)?,
        position: row.get(9)?,
        pinned: row.get::<_, i64>(10)? != 0,
        needs_attention: row.get::<_, i64>(11)? != 0,
        tags: Vec::new(),
        attachment_count: row.get(12)?,
        revision: row.get(13)?,
        archived_at: row.get(14)?,
        origin_folder_name: row.get(15)?,
        created_at: row.get(16)?,
        updated_at: row.get(17)?,
        trashed_at: row.get(18)?,
        bullet_shape: row.get(19)?, checkbox_shape: row.get(20)?,
    })
}

fn validate_folder(name: &str, icon: &str, color: &str) -> Result<String, String> {
    let name = name.trim();
    if name.is_empty() || name.chars().count() > 80 {
        return Err("Il nome della cartella deve contenere da 1 a 80 caratteri.".to_string());
    }
    if !FOLDER_ICONS.contains(&icon) {
        return Err("L'icona della cartella non è valida.".to_string());
    }
    if !FOLDER_COLORS.contains(&color) {
        return Err("Il colore della cartella non è valido.".to_string());
    }
    Ok(name.to_string())
}

fn validate_dictionary_language(language: &str) -> Result<(), String> {
    if DICTIONARY_LANGUAGES.contains(&language) {
        Ok(())
    } else {
        Err("Il dizionario selezionato non è valido.".to_string())
    }
}

fn dictionary_source(language: &str) -> Result<(&'static str, &'static str), String> {
    match language {
        "it" => Ok((
            include_str!(concat!(
                env!("CARGO_MANIFEST_DIR"),
                "/../node_modules/dictionary-it/index.aff"
            )),
            include_str!(concat!(
                env!("CARGO_MANIFEST_DIR"),
                "/../node_modules/dictionary-it/index.dic"
            )),
        )),
        "en" => Ok((
            include_str!(concat!(
                env!("CARGO_MANIFEST_DIR"),
                "/../node_modules/dictionary-en/index.aff"
            )),
            include_str!(concat!(
                env!("CARGO_MANIFEST_DIR"),
                "/../node_modules/dictionary-en/index.dic"
            )),
        )),
        "fr" => Ok((
            include_str!(concat!(
                env!("CARGO_MANIFEST_DIR"),
                "/../node_modules/dictionary-fr/index.aff"
            )),
            include_str!(concat!(
                env!("CARGO_MANIFEST_DIR"),
                "/../node_modules/dictionary-fr/index.dic"
            )),
        )),
        "es" => Ok((
            include_str!(concat!(
                env!("CARGO_MANIFEST_DIR"),
                "/../node_modules/dictionary-es/index.aff"
            )),
            include_str!(concat!(
                env!("CARGO_MANIFEST_DIR"),
                "/../node_modules/dictionary-es/index.dic"
            )),
        )),
        "de" => Ok((
            include_str!(concat!(
                env!("CARGO_MANIFEST_DIR"),
                "/../node_modules/dictionary-de/index.aff"
            )),
            include_str!(concat!(
                env!("CARGO_MANIFEST_DIR"),
                "/../node_modules/dictionary-de/index.dic"
            )),
        )),
        _ => Err("Il dizionario selezionato non è valido.".to_string()),
    }
}

fn ensure_folder(connection: &Connection, folder_id: i64) -> Result<(), String> {
    let exists = connection
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM folders WHERE id = ?1 AND trashed_at IS NULL)",
            [folder_id],
            |row| row.get::<_, bool>(0),
        )
        .map_err(|error| format!("Non è possibile controllare la cartella: {error}"))?;
    if exists {
        Ok(())
    } else {
        Err("La cartella scelta non esiste più.".to_string())
    }
}

fn safe_file_name(title: &str) -> String {
    let name: String = title
        .chars()
        .map(|character| {
            if matches!(
                character,
                '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*'
            ) {
                '_'
            } else {
                character
            }
        })
        .collect();
    let name = name.trim().trim_end_matches(['.', ' ']);
    if name.is_empty() {
        "nota".to_string()
    } else {
        name.chars().take(120).collect()
    }
}

fn empty_document() -> Value {
    json!({ "schemaVersion": 1, "type": "doc", "content": [{"type": "paragraph"}] })
}

#[cfg(test)]
mod tests {
    use super::{dictionary_source, safe_file_name, validate_dictionary_language, validate_folder};

    #[test]
    fn attachment_formats_and_settings_boundaries() {
        for bytes in [&b"\x89PNG\r\n\x1a\n"[..], &b"\xff\xd8\xff0"[..], &b"GIF89a"[..], &b"RIFF0000WEBP"[..], &b"BM000000000000"[..]] { assert!(super::image_kind(bytes).is_some()); }
        for bytes in [&b"<svg/>"[..], &b"abc"[..], &b"text"[..]] { assert!(super::image_kind(bytes).is_none()); }
        assert!(super::normalize_custom_colors(vec!["#abcdef".into();11]).is_err());
        assert!(super::normalize_custom_colors(vec!["#abc".into()]).is_err());
        assert_eq!(super::normalize_custom_colors(vec!["#AABBCC".into(),"#aabbcc".into()]).unwrap(), vec!["#aabbcc"]);
        assert!(!super::SHAPES.contains(&"blob"));
    }

    #[test]
    fn reading_settings_recovers_unknown_fonts() {
        let connection = rusqlite::Connection::open_in_memory().unwrap();
        connection.execute_batch("CREATE TABLE settings AS SELECT 1 AS id, 'soft' AS theme, 'missing' AS interface_font, 'missing' AS editor_font, 16 AS editor_font_size, 'missing' AS monospace_font, 2 AS default_line_spacing, 'balanced' AS layout_density, 260 AS sidebar_width, 0 AS spellcheck, 'html' AS default_export_format, 'dashboard' AS last_view, NULL AS last_folder_id, NULL AS last_note_id, 'grid' AS dashboard_view, 'it' AS dictionary_language, 226 AS toolbar_character_width, 220 AS toolbar_paragraph_width, 220 AS toolbar_styles_width, 220 AS toolbar_note_width, 104 AS toolbar_tools_width, 'circle' AS bullet_shape, 'square' AS checkbox_shape, '[]' AS custom_colors;").unwrap();
        let settings = super::read_settings(&connection).unwrap();
        assert_eq!(settings.interface_font, "roboto");
        assert_eq!(settings.editor_font, "roboto");
        assert_eq!(settings.monospace_font, "jetbrains");
        connection.execute("UPDATE settings SET interface_font = 'arial', editor_font = 'georgia', monospace_font = 'consolas'", []).unwrap();
        let settings = super::read_settings(&connection).unwrap();
        assert_eq!(settings.interface_font, "arial");
        assert_eq!(settings.editor_font, "georgia");
        assert_eq!(settings.monospace_font, "consolas");
    }

    #[test]
    fn validates_folder_icons_and_export_names() {
        assert!(validate_folder("Progetti", "briefcase", "sage").is_ok());
        assert!(validate_folder("Progetti", "not-an-icon", "sage").is_err());
        assert!(validate_folder("Progetti", "briefcase", "neon").is_err());
        assert_eq!(safe_file_name("Piano: Q4/2026"), "Piano_ Q4_2026");
        assert!(validate_dictionary_language("it").is_ok());
        assert!(validate_dictionary_language("en").is_ok());
        assert!(validate_dictionary_language("xx").is_err());
    }

    #[test]
    fn italian_dictionary_loads_and_checks_words() {
        let (aff, dic) = dictionary_source("it").expect("italian dictionary assets");
        let dictionary = spellbook::Dictionary::new(aff, dic).expect("italian dictionary");
        assert!(dictionary.check("scrittura"));
        assert!(!dictionary.check("scritturra"));
    }
}

fn normalize_custom_colors(colors: Vec<String>) -> Result<Vec<String>, String> {
    if colors.len() > 10 || colors.iter().any(|color| !is_hex_color(color)) {
        return Err("Sono consentiti al massimo 10 colori esadecimali #rrggbb.".into());
    }
    let mut result = Vec::new();
    for color in colors { let color = color.to_ascii_lowercase(); if !result.contains(&color) { result.push(color); } }
    Ok(result)
}

pub(crate) fn image_kind(bytes: &[u8]) -> Option<(&'static str, &'static str)> {
    if bytes.starts_with(b"\x89PNG\r\n\x1a\n") { Some(("image/png", "png")) }
    else if bytes.len() > 3 && bytes.starts_with(b"\xff\xd8\xff") { Some(("image/jpeg", "jpg")) }
    else if bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a") { Some(("image/gif", "gif")) }
    else if bytes.len() >= 12 && &bytes[..4] == b"RIFF" && &bytes[8..12] == b"WEBP" { Some(("image/webp", "webp")) }
    else if bytes.len() >= 14 && bytes.starts_with(b"BM") { Some(("image/bmp", "bmp")) }
    else { None }
}

fn insert_attachment(connection: &Connection, note_id: i64, bytes: &[u8]) -> Result<AttachmentMeta, String> {
    if bytes.len() > 20 * 1024 * 1024 { return Err("L'immagine supera 20 MB.".into()); }
    let (mime, extension) = image_kind(bytes).ok_or("Formato immagine non supportato (PNG, JPEG, WebP, GIF, BMP).")?;
    let writable: bool = connection.query_row("SELECT EXISTS(SELECT 1 FROM notes WHERE id=?1 AND archived_at IS NULL AND trashed_at IS NULL)", [note_id], |r| r.get(0)).map_err(|e| e.to_string())?;
    if !writable { return Err("La nota non è modificabile.".into()); }
    let now = now_ms()?;
    // Timestamp floor avoids recycling deleted IDs while the frontend holds blob URLs.
    let id: i64 = connection.query_row("SELECT MAX(COALESCE(MAX(id),0)+1,?1) FROM attachments", [now], |r| r.get(0)).map_err(|e| e.to_string())?;
    let file_name = format!("immagine-{id}.{extension}");
    connection.execute("INSERT INTO attachments(id,note_id,file_name,mime_type,size_bytes,data,created_at) VALUES(?1,?2,?3,?4,?5,?6,?7)", params![id,note_id,file_name,mime,bytes.len() as i64,bytes,now]).map_err(|e| format!("Non è possibile salvare l'immagine: {e}"))?;
    Ok(AttachmentMeta { id, note_id, file_name, mime_type: mime.into(), size_bytes: bytes.len() as i64, image: true, created_at: now })
}

#[tauri::command(async)]
pub fn add_attachment(request: tauri::ipc::Request<'_>, state: State<'_, AppState>) -> Result<AttachmentMeta, String> {
    let tauri::ipc::InvokeBody::Raw(bytes) = request.body() else { return Err("L'immagine non è stata ricevuta.".into()); };
    let note_id = request.headers().get("x-note-id").and_then(|v| v.to_str().ok()).and_then(|v| v.parse::<i64>().ok()).ok_or("La nota di destinazione non è valida.")?;
    insert_attachment(&*lock_connection(&state)?, note_id, bytes)
}

#[tauri::command(async)]
pub fn read_attachment(input: IdInput, state: State<'_, AppState>) -> Result<tauri::ipc::Response, String> {
    let data: Vec<u8> = lock_connection(&state)?.query_row("SELECT data FROM attachments WHERE id=?1", [input.id], |r| r.get(0)).map_err(|e| format!("Non è possibile leggere l'immagine: {e}"))?;
    Ok(tauri::ipc::Response::new(data))
}

#[tauri::command(async)]
pub fn copy_attachment(input: crate::models::CopyAttachmentInput, state: State<'_, AppState>) -> Result<AttachmentMeta, String> {
    let connection = lock_connection(&state)?;
    let data: Vec<u8> = connection.query_row("SELECT data FROM attachments WHERE id=?1", [input.id], |r| r.get(0)).map_err(|e| format!("Non è possibile copiare l'immagine: {e}"))?;
    insert_attachment(&connection, input.note_id, &data)
}
