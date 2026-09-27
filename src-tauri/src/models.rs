use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Folder {
    pub id: i64,
    pub name: String,
    pub icon: String,
    pub color: String,
    pub position: i64,
    pub note_count: i64,
    pub created_at: i64,
    pub updated_at: i64,
    pub trashed_at: Option<i64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Tag {
    pub id: i64,
    pub name: String,
    pub color: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AttachmentMeta {
    pub id: i64,
    pub note_id: i64,
    pub file_name: String,
    pub mime_type: String,
    pub size_bytes: i64,
    pub image: bool,
    pub created_at: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NoteSummary {
    pub bullet_shape: Option<String>,
    pub checkbox_shape: Option<String>,
    pub id: i64,
    pub folder_id: Option<i64>,
    pub folder_name: Option<String>,
    pub title: String,
    pub subtitle: String,
    pub preview: String,
    pub paper_color: String,
    pub line_spacing: i64,
    pub paper_width: i64,
    pub position: i64,
    pub pinned: bool,
    pub needs_attention: bool,
    pub tags: Vec<Tag>,
    pub attachment_count: i64,
    pub revision: i64,
    pub archived_at: Option<i64>,
    pub origin_folder_name: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
    pub trashed_at: Option<i64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NoteDetail {
    #[serde(flatten)]
    pub summary: NoteSummary,
    pub content: Value,
    pub attachments: Vec<AttachmentMeta>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub bullet_shape: String,
    pub checkbox_shape: String,
    pub custom_colors: Vec<String>,
    pub theme: String,
    pub interface_font: String,
    pub editor_font: String,
    pub editor_font_size: i64,
    pub monospace_font: String,
    pub default_line_spacing: i64,
    pub layout_density: String,
    pub sidebar_width: i64,
    pub spellcheck: bool,
    pub default_export_format: String,
    pub last_view: String,
    pub last_folder_id: Option<i64>,
    pub last_note_id: Option<i64>,
    pub dashboard_view: String,
    pub dictionary_language: String,
    pub toolbar_character_width: i64,
    pub toolbar_paragraph_width: i64,
    pub toolbar_styles_width: i64,
    pub toolbar_note_width: i64,
    pub toolbar_tools_width: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSettingsInput {
    pub bullet_shape: Option<String>,
    pub checkbox_shape: Option<String>,
    pub custom_colors: Option<Vec<String>>,
    pub theme: Option<String>,
    pub interface_font: Option<String>,
    pub editor_font: Option<String>,
    pub editor_font_size: Option<i64>,
    pub monospace_font: Option<String>,
    pub default_line_spacing: Option<i64>,
    pub layout_density: Option<String>,
    pub sidebar_width: Option<i64>,
    pub spellcheck: Option<bool>,
    pub default_export_format: Option<String>,
    pub last_view: Option<String>,
    pub last_folder_id: Option<Option<i64>>,
    pub last_note_id: Option<Option<i64>>,
    pub dashboard_view: Option<String>,
    pub dictionary_language: Option<String>,
    pub toolbar_character_width: Option<i64>,
    pub toolbar_paragraph_width: Option<i64>,
    pub toolbar_styles_width: Option<i64>,
    pub toolbar_note_width: Option<i64>,
    pub toolbar_tools_width: Option<i64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BootstrapPayload {
    pub folders: Vec<Folder>,
    pub tags: Vec<Tag>,
    pub settings: AppSettings,
    pub recent_note: Option<NoteSummary>,
    pub pinned_notes: Vec<NoteSummary>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListNotesInput {
    pub scope: String,
    pub folder_id: Option<i64>,
    pub query: Option<String>,
    pub condition: Option<String>,
    pub order: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DashboardActivity {
    pub kind: String,
    pub label: String,
    pub occurred_at: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderUsage {
    pub id: i64,
    pub name: String,
    pub count: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DashboardOverview {
    pub total_active: i64,
    pub recently_updated: i64,
    pub needs_attention_count: i64,
    pub pinned_count: i64,
    pub archive_count: i64,
    pub trash_count: i64,
    pub recent_activity: Vec<DashboardActivity>,
    pub most_used_folders: Vec<FolderUsage>,
    pub needs_attention_notes: Vec<NoteSummary>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DictionaryLanguageInput {
    pub language: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddDictionaryWordInput {
    pub language: String,
    pub word: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateNoteInput {
    pub folder_id: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IdInput {
    pub id: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveNoteInput {
    pub bullet_shape: Option<String>,
    pub checkbox_shape: Option<String>,
    pub id: i64,
    pub title: String,
    pub subtitle: String,
    pub paper_color: String,
    pub line_spacing: i64,
    pub paper_width: i64,
    pub content: Value,
    pub expected_revision: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateFolderInput {
    pub name: String,
    pub icon: String,
    pub color: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateFolderInput {
    pub id: i64,
    pub name: String,
    pub icon: String,
    pub color: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PinNoteInput {
    pub id: i64,
    pub pinned: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetNoteAttentionInput {
    pub id: i64,
    pub needs_attention: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckSpellingInput {
    pub language: String,
    pub words: Vec<String>,
    pub ignored: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MisspelledWord {
    pub word: String,
    pub suggestions: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReorderNotesInput {
    pub folder_id: i64,
    pub note_ids: Vec<i64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MoveNoteInput {
    pub id: i64,
    pub folder_id: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RestoreNoteInput {
    pub id: i64,
    pub folder_id: Option<i64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportNoteInput {
    pub id: i64,
    pub format: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportReceipt {
    pub cancelled: bool,
    pub path: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveReceipt {
    pub note_id: i64,
    pub revision: i64,
    pub updated_at: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CopyAttachmentInput { pub id: i64, pub note_id: i64 }
