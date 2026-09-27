use serde_json::Value;

const MAX_NODES: usize = 100_000;
const MAX_DEPTH: usize = 32;
const MAX_TEXT_BYTES: usize = 2 * 1024 * 1024;

const NODE_TYPES: &[&str] = &[
    "doc",
    "paragraph",
    "heading",
    "text",
    "hardBreak",
    "bulletList",
    "orderedList",
    "listItem",
    "taskList",
    "taskItem",
    "codeBlock",
    "collapsibleBlock",
    "horizontalRule",
    "image",
];

const MARK_TYPES: &[&str] = &[
    "bold",
    "italic",
    "underline",
    "strike",
    "highlight",
    "link",
    "code",
    "textStyle",
    "fontFamily",
];

const FONT_FAMILIES: &[&str] = &[
    "Roboto",
    "Plus Jakarta Sans",
    "Nunito Sans",
    "Playfair Display",
    "JetBrains Mono",
    "Segoe UI",
    "Calibri",
    "Arial",
    "Tahoma",
    "Verdana",
    "Georgia",
    "Cambria",
    "Times New Roman",
    "Cascadia Code",
    "Consolas",
];

pub(crate) const COLLAPSIBLE_COLORS: &[&str] = &[
    "#f5d98f", "#f4b89f", "#bfe3c0", "#b9ddee", "#d8c7ed", "#bca7ee", "#f19a7d", "#f2b04f",
    "#ead9bf", "#c9c9c7",
];
pub(crate) fn is_hex_color(value: &str) -> bool {
    value.len() == 7 && value.starts_with('#') && value.as_bytes()[1..].iter().all(u8::is_ascii_hexdigit)
}

const CODE_LANGUAGES: &[&str] = &[
    "plaintext",
    "bash",
    "powershell",
    "javascript",
    "typescript",
    "jsx",
    "tsx",
    "html",
    "css",
    "json",
    "rust",
    "python",
    "sql",
    "markdown",
];

pub fn validate_and_extract(document: &Value) -> Result<String, String> {
    let object = document
        .as_object()
        .ok_or_else(|| "Il contenuto della nota non è un documento valido.".to_string())?;

    if object.get("type").and_then(Value::as_str) != Some("doc") {
        return Err("Il contenuto della nota deve avere un nodo radice 'doc'.".to_string());
    }

    if object.get("schemaVersion").and_then(Value::as_i64) != Some(1) {
        return Err("La versione del documento non è supportata.".to_string());
    }

    let mut state = ValidationState::default();
    validate_node(document, 0, &mut state)?;
    Ok(state.plain_text.trim().to_string())
}

#[derive(Default)]
struct ValidationState {
    node_count: usize,
    text_bytes: usize,
    plain_text: String,
}

fn validate_node(node: &Value, depth: usize, state: &mut ValidationState) -> Result<(), String> {
    if depth > MAX_DEPTH {
        return Err("La nota contiene troppi livelli annidati.".to_string());
    }

    state.node_count += 1;
    if state.node_count > MAX_NODES {
        return Err("La nota contiene troppi elementi.".to_string());
    }

    let object = node
        .as_object()
        .ok_or_else(|| "La nota contiene un nodo non valido.".to_string())?;
    let node_type = object
        .get("type")
        .and_then(Value::as_str)
        .ok_or_else(|| "Un elemento della nota non specifica il proprio tipo.".to_string())?;

    if !NODE_TYPES.contains(&node_type) {
        return Err(format!(
            "Il tipo di contenuto '{node_type}' non è supportato."
        ));
    }

    validate_attributes(node_type, object.get("attrs"))?;
    validate_marks(object.get("marks"))?;

    if node_type == "text" {
        let text = object
            .get("text")
            .and_then(Value::as_str)
            .ok_or_else(|| "Un nodo di testo non contiene testo valido.".to_string())?;
        state.text_bytes += text.len();
        if state.text_bytes > MAX_TEXT_BYTES {
            return Err("La nota supera il limite di 2 MiB di testo.".to_string());
        }
        state.plain_text.push_str(text);
    }

    if let Some(children) = object.get("content") {
        let children = children
            .as_array()
            .ok_or_else(|| "Il contenuto annidato della nota non è valido.".to_string())?;
        for child in children {
            validate_node(child, depth + 1, state)?;
        }
    }

    if matches!(
        node_type,
        "paragraph" | "heading" | "listItem" | "taskItem" | "codeBlock"
    ) {
        state.plain_text.push('\n');
    }

    Ok(())
}

fn validate_attributes(node_type: &str, attrs: Option<&Value>) -> Result<(), String> {
    match node_type {
        "heading" => {
            let level = attrs
                .and_then(Value::as_object)
                .and_then(|value| value.get("level"))
                .and_then(Value::as_i64);
            if !matches!(level, Some(1..=3)) {
                return Err("Sono consentite soltanto intestazioni da H1 a H3.".to_string());
            }
            if attrs
                .and_then(Value::as_object)
                .and_then(|value| value.get("collapsed"))
                .is_some_and(|collapsed| !collapsed.is_boolean())
            {
                return Err("Lo stato della sezione non è valido.".to_string());
            }
            validate_text_alignment(attrs)?;
        }
        "paragraph" => validate_text_alignment(attrs)?,
        "taskItem" => {
            let checked = attrs
                .and_then(Value::as_object)
                .and_then(|value| value.get("checked"));
            if !matches!(checked, Some(Value::Bool(_))) {
                return Err("Una voce checklist non contiene uno stato valido.".to_string());
            }
        }
        "codeBlock" => {
            if let Some(language) = attrs
                .and_then(Value::as_object)
                .and_then(|value| value.get("language"))
                .and_then(Value::as_str)
                && !CODE_LANGUAGES.contains(&language)
            {
                return Err(format!("Il linguaggio '{language}' non è supportato."));
            }
        }
        "collapsibleBlock" => {
            let attrs = attrs.and_then(Value::as_object).ok_or_else(|| {
                "Il blocco a scomparsa non contiene attributi validi.".to_string()
            })?;
            let title = attrs
                .get("title")
                .and_then(Value::as_str)
                .unwrap_or_default();
            if title.trim().is_empty() || title.chars().count() > 200 {
                return Err(
                    "Il titolo del blocco a scomparsa deve contenere da 1 a 200 caratteri."
                        .to_string(),
                );
            }
            if let Some(color) = attrs.get("color").filter(|value| !value.is_null()) {
                if !color.as_str().is_some_and(|value| COLLAPSIBLE_COLORS.contains(&value)) {
                    return Err("Il colore del blocco a scomparsa non è valido.".to_string());
                }
            }
            if !matches!(attrs.get("open"), Some(Value::Bool(_))) {
                return Err("Lo stato del blocco a scomparsa non è valido.".to_string());
            }
        }
        "horizontalRule" => {
            if let Some(value) = attrs.and_then(|a| a.get("thickness")) {
                if !value.as_i64().is_some_and(|n| (1..=8).contains(&n)) {
                    return Err("Lo spessore del divisore non è valido.".into());
                }
            }
        }
        "image" => {
            if let Some(attrs) = attrs.and_then(Value::as_object) {
                for (key, min, max) in [("width", 24, 1280), ("x", -4000, 40000), ("y", -4000, 40000)] {
                    if let Some(value) = attrs.get(key).filter(|v| key != "width" || !v.is_null()) {
                        if !value.as_i64().is_some_and(|n| (min..=max).contains(&n)) {
                            return Err(format!("La dimensione o posizione dell'immagine ({key}) non è valida."));
                        }
                    }
                }
                for (key, allowed) in [("wrap", &["inline", "square", "break", "behind", "front"][..]), ("align", &["left", "right"][..])] {
                    if let Some(value) = attrs.get(key) {
                        if !value.as_str().is_some_and(|v| allowed.contains(&v)) {
                            return Err("La disposizione dell'immagine non è valida.".into());
                        }
                    }
                }
                if attrs.get("alt").is_some_and(|v| !v.as_str().is_some_and(|v| v.chars().count() <= 300)) {
                    return Err("La descrizione dell'immagine non è valida.".into());
                }
            }
            let attachment_id = attrs
                .and_then(Value::as_object)
                .and_then(|value| value.get("attachmentId"))
                .and_then(Value::as_i64);
            if !matches!(attachment_id, Some(value) if value > 0) {
                return Err("Un'immagine non riferisce un allegato valido.".to_string());
            }
        }
        _ => {}
    }
    Ok(())
}

fn validate_marks(marks: Option<&Value>) -> Result<(), String> {
    let Some(marks) = marks else {
        return Ok(());
    };
    let marks = marks
        .as_array()
        .ok_or_else(|| "La formattazione del testo non è valida.".to_string())?;
    for mark in marks {
        let mark_type = mark
            .as_object()
            .and_then(|value| value.get("type"))
            .and_then(Value::as_str)
            .ok_or_else(|| "Una formattazione non specifica il proprio tipo.".to_string())?;
        if !MARK_TYPES.contains(&mark_type) {
            return Err(format!("La formattazione '{mark_type}' non è supportata."));
        }
        if mark_type == "link"
            && mark
                .as_object()
                .and_then(|value| value.get("attrs"))
                .and_then(Value::as_object)
                .and_then(|value| value.get("href"))
                .and_then(Value::as_str)
                .is_some_and(|href| !is_safe_href(href))
        {
            return Err("Il collegamento usa un protocollo non consentito.".to_string());
        }
        let attrs = mark
            .as_object()
            .and_then(|value| value.get("attrs"))
            .and_then(Value::as_object);
        if mark_type == "highlight"
            && attrs
                .and_then(|value| value.get("color"))
                .filter(|color| !color.is_null())
                .is_some_and(|color| color.as_str().is_none_or(|color| !is_hex_color(color)))
        {
            return Err("Il colore dell'evidenziatore non è supportato.".to_string());
        }
        if mark_type == "textStyle" {
            if attrs
                .and_then(|value| value.get("fontFamily"))
                .and_then(Value::as_str)
                .is_some_and(|font| !FONT_FAMILIES.contains(&font))
            {
                return Err("Il carattere selezionato non è supportato.".to_string());
            }
            if attrs
                .and_then(|value| value.get("verticalAlign"))
                .and_then(Value::as_str)
                .is_some_and(|alignment| !matches!(alignment, "top" | "middle" | "bottom"))
            {
                return Err("L'allineamento verticale non è supportato.".to_string());
            }
            if attrs
                .and_then(|value| value.get("fontSize"))
                .and_then(Value::as_str)
                .is_some_and(|size| {
                    size.strip_suffix("px")
                        .and_then(|value| value.parse::<i64>().ok())
                        .is_none_or(|value| !(12..=28).contains(&value))
                })
            {
                return Err("La dimensione del testo non è supportata.".to_string());
            }
            if attrs
                .and_then(|value| value.get("color"))
                .filter(|color| !color.is_null())
                .is_some_and(|color| color.as_str().is_none_or(|color| !is_hex_color(color)))
            {
                return Err("Il colore del testo non è supportato.".to_string());
            }
        }
    }
    Ok(())
}

/// Accepts relative links and the `http`, `https` and `mailto` schemes only.
/// Browsers ignore ASCII tabs and newlines inside URLs, so they are stripped
/// before reading the scheme (`"ja<TAB>vascript:"` is still `javascript:`).
fn is_safe_href(href: &str) -> bool {
    let cleaned: String = href
        .chars()
        .filter(|character| !character.is_ascii_control() && !character.is_whitespace())
        .collect();
    let scheme_end = cleaned.find([':', '/', '?', '#']);
    match scheme_end {
        Some(index) if cleaned[index..].starts_with(':') => matches!(
            cleaned[..index].to_ascii_lowercase().as_str(),
            "http" | "https" | "mailto"
        ),
        _ => true,
    }
}

fn validate_text_alignment(attrs: Option<&Value>) -> Result<(), String> {
    if attrs
        .and_then(Value::as_object)
        .and_then(|value| value.get("textAlign"))
        .and_then(Value::as_str)
        .is_some_and(|alignment| !matches!(alignment, "left" | "center" | "right" | "justify"))
    {
        return Err("L'allineamento del testo non è supportato.".to_string());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{is_safe_href, validate_and_extract};
    use serde_json::json;

    #[test]
    fn validates_palette_rule_and_image_boundaries() {
        for color in ["#FF00ff", "#1155cc"] { assert!(super::is_hex_color(color)); }
        for color in [json!("red"), json!("#fff"), json!("rgb(1,2,3)"), json!("#12345g"), json!(123), json!(false)] {
            for mark in ["textStyle", "highlight"] {
                let doc = json!({"schemaVersion":1,"type":"doc","content":[{"type":"text","text":"x","marks":[{"type":mark,"attrs":{"color":color}}]}]});
                assert!(validate_and_extract(&doc).is_err());
            }
        }
        for thickness in [json!(1), json!(8), json!(0), json!(9), json!("2")] {
            assert_eq!(super::validate_attributes("horizontalRule", Some(&json!({"thickness":thickness}))).is_ok(), thickness == 1 || thickness == 8);
        }
        for wrap in ["inline", "square", "break", "behind", "front", "float"] {
            assert_eq!(super::validate_attributes("image", Some(&json!({"attachmentId":1,"wrap":wrap}))).is_ok(), wrap != "float");
        }
        assert!(super::validate_attributes("image", Some(&json!({"attachmentId":1,"width":5000}))).is_err());
    }

    #[test]
    fn link_scheme_allowlist_rejects_obfuscated_scripts() {
        for safe in ["https://example.com", "HTTP://x.it", "mailto:a@b.it", "note.md", "#titolo", "/percorso?q=a:b"] {
            assert!(is_safe_href(safe), "{safe} should be allowed");
        }
        for unsafe_href in ["javascript:alert(1)", " JavaScript:alert(1)", "ja\tvascript:alert(1)", "\njavascript:x", "vbscript:x", "data:text/html,<script>", "file:///C:/"] {
            assert!(!is_safe_href(unsafe_href), "{unsafe_href} should be rejected");
        }
    }

    #[test]
    fn accepts_every_toolbar_font_and_color() {
        for font in ["Nunito Sans", "Playfair Display", "JetBrains Mono", "Segoe UI", "Times New Roman"] {
            for color in ["#3b3029", "#8a3f32", "#2f664f", "#315f7a", "#654f86", "#9a641f"] {
                let document = json!({
                    "schemaVersion": 1,
                    "type": "doc",
                    "content": [{"type": "paragraph", "content": [{"type": "text", "text": "x", "marks": [{"type": "textStyle", "attrs": {"fontFamily": font, "color": color}}]}]}]
                });
                assert!(validate_and_extract(&document).is_ok(), "{font} / {color}");
            }
        }
    }

    #[test]
    fn accepts_lists_tasks_and_code() {
        let document = json!({
            "schemaVersion": 1,
            "type": "doc",
            "content": [
                {"type": "bulletList", "content": [{"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "uno"}]}]}]},
                {"type": "orderedList", "attrs": {"start": 1}, "content": [{"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "due"}]}]}]},
                {"type": "taskList", "content": [{"type": "taskItem", "attrs": {"checked": true}, "content": [{"type": "paragraph", "content": [{"type": "text", "text": "fatto"}]}]}]},
                {"type": "codeBlock", "attrs": {"language": "rust"}, "content": [{"type": "text", "text": "fn main() {}"}]}
            ]
        });

        let text = validate_and_extract(&document).expect("valid document");
        assert!(text.contains("uno"));
        assert!(text.contains("fn main() {}"));
    }

    #[test]
    fn heading_fold_state_must_be_boolean() {
        let heading = |collapsed: serde_json::Value| json!({"schemaVersion": 1, "type": "doc", "content": [
            {"type": "heading", "attrs": {"level": 2, "collapsed": collapsed}, "content": [{"type": "text", "text": "Sezione"}]}
        ]});
        assert!(validate_and_extract(&heading(json!(true))).is_ok());
        assert!(validate_and_extract(&heading(json!(false))).is_ok());
        assert!(validate_and_extract(&heading(json!("yes"))).is_err());
    }

    #[test]
    fn rejects_unknown_content() {
        let document = json!({
            "schemaVersion": 1,
            "type": "doc",
            "content": [{"type": "script", "text": "alert(1)"}]
        });
        assert!(validate_and_extract(&document).is_err());
    }

    #[test]
    fn accepts_editor_appearance_and_dividers() {
        let document = json!({
            "schemaVersion": 1,
            "type": "doc",
            "content": [
                {"type": "heading", "attrs": {"level": 3, "textAlign": "center"}, "content": [{"type": "text", "text": "Titolo"}]},
                {"type": "horizontalRule"},
                {"type": "paragraph", "attrs": {"textAlign": "justify"}, "content": [{"type": "text", "text": "testo", "marks": [
                    {"type": "strike"},
                    {"type": "highlight", "attrs": {"color": "#f2b04f"}},
                    {"type": "textStyle", "attrs": {"fontFamily": "Georgia", "fontSize": "19px", "verticalAlign": "top", "color": "#315f7a"}}
                ]}]}
            ]
        });
        assert!(validate_and_extract(&document).is_ok());
    }

    #[test]
    fn accepts_collapsible_blocks_with_rich_content() {
        let document = json!({
            "schemaVersion": 1,
            "type": "doc",
            "content": [{
                "type": "collapsibleBlock",
                "attrs": {"title": "Dettagli", "open": false},
                "content": [
                    {"type": "paragraph", "content": [{"type": "text", "text": "testo"}]},
                    {"type": "codeBlock", "attrs": {"language": "rust"}, "content": [{"type": "text", "text": "fn main() {}"}]}
                ]
            }]
        });
        assert!(validate_and_extract(&document).is_ok());
    }

    #[test]
    fn rejects_unlisted_appearance_values() {
        let document = json!({
            "schemaVersion": 1,
            "type": "doc",
            "content": [{"type": "paragraph", "attrs": {"textAlign": "distribute"}, "content": [{"type": "text", "text": "x"}]}]
        });
        assert!(validate_and_extract(&document).is_err());
        let invalid_color = json!({
            "schemaVersion": 1,
            "type": "doc",
            "content": [{"type": "paragraph", "content": [{"type": "text", "text": "x", "marks": [{"type": "textStyle", "attrs": {"color": "rgb(0,255,0)"}}]}]}]
        });
        assert!(validate_and_extract(&invalid_color).is_err());
    }
}
