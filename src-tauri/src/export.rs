use serde_json::Value;

pub fn render_markdown(title: &str, subtitle: &str, document: &Value) -> String {
    let mut output = format!("# {}\n\n", escape_markdown(title));
    if !subtitle.trim().is_empty() {
        output.push_str(&format!("_{}_\n\n", escape_markdown(subtitle.trim())));
    }
    if let Some(nodes) = document.get("content").and_then(Value::as_array) {
        for node in nodes {
            render_markdown_node(node, 0, &mut output);
        }
    }
    output.trim_end().to_string() + "\n"
}

pub fn render_html(
    title: &str,
    subtitle: &str,
    document: &Value,
    paper_color: &str,
    line_spacing: i64,
    editor_font: &str,
    editor_font_size: i64,
) -> String {
    let mut body = format!("<h1 class=\"note-title\">{}</h1>", escape_html(title));
    if !subtitle.trim().is_empty() {
        body.push_str(&format!(
            "<p class=\"note-subtitle\">{}</p>",
            escape_html(subtitle.trim())
        ));
    }
    if let Some(nodes) = document.get("content").and_then(Value::as_array) {
        for node in nodes {
            render_html_node(node, &mut body);
        }
    }
    let paper = match paper_color {
        "cream" => "#fff5dc",
        "warm-white" => "#fffaf3",
        "peach" => "#ffeadf",
        "sage" => "#eaf6e3",
        "sky" => "#e3f1ff",
        "lavender" => "#f1e8ff",
        "lemon" => "#fffbd6",
        "mint" => "#e0f8ee",
        "teal" => "#dcf4f4",
        "ocean" => "#dde8fb",
        "lilac" => "#f7e4fa",
        "rose" => "#ffe4ec",
        "coral" => "#ffe3dc",
        "sand" => "#f6ecdb",
        "stone" => "#eeebe7",
        "slate" => "#e6ebf0",
        _ => "#fff5dc",
    };
    let leading = match line_spacing {
        1 => 24,
        3 => 32,
        4 => 36,
        5 => 40,
        _ => 28,
    };
    let font = match editor_font {
        "jakarta" => "'Plus Jakarta Sans', 'Segoe UI', sans-serif",
        "segoe" => "'Segoe UI', sans-serif",
        "playfair" => "'Playfair Display', Georgia, serif",
        "jetbrains" => "'JetBrains Mono', Consolas, monospace",
        "calibri" => "Calibri, 'Segoe UI', sans-serif",
        "arial" => "Arial, sans-serif",
        "tahoma" => "Tahoma, sans-serif",
        "verdana" => "Verdana, sans-serif",
        "georgia" => "Georgia, serif",
        "cambria" => "Cambria, Georgia, serif",
        "times" => "'Times New Roman', serif",
        "cascadia" => "'Cascadia Code', Consolas, monospace",
        "consolas" => "Consolas, 'Cascadia Code', monospace",
        _ => "Roboto, 'Segoe UI', sans-serif",
    };
    let styles = format!(
        "body{{margin:0;background:#eee9e2;color:#302b27;font-family:{font};font-size:{editor_font_size}px}}main{{box-sizing:border-box;width:min(900px,calc(100% - 40px));min-height:100vh;margin:0 auto;padding:64px 72px;background:{paper}}}.note-title{{margin:0;font-family:Roboto,'Segoe UI',sans-serif;font-size:42px}}.note-subtitle{{margin:10px 0 34px;color:#746b64;font-size:18px}}p,li{{line-height:{leading}px}}h1,h2,h3{{font-family:Roboto,'Segoe UI',sans-serif}}hr{{height:{leading}px;margin:0 5px;background:linear-gradient(#9b7b5d,#9b7b5d) center/100% 2px no-repeat;border:0}}pre{{overflow:auto;padding:18px;border-radius:10px;background:#22252a;color:#f4eee7}}details{{margin:20px 0;border:1px solid #c8b7a5;border-radius:8px}}summary{{padding:10px 14px;font-family:Roboto,'Segoe UI',sans-serif;font-weight:700;cursor:pointer}}details>div{{padding:0 18px 14px 28px}}mark{{padding:1px 3px;border-radius:3px}}@media print{{body{{background:white}}main{{width:auto;margin:0;padding:20mm;box-shadow:none}}details{{display:block}}details>div{{display:block!important}}}}"
    );
    format!(
        "<!doctype html><html lang=\"it\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>{}</title><style>{}</style></head><body><main>{}</main></body></html>",
        escape_html(title),
        styles,
        body
    )
}

fn render_markdown_node(node: &Value, depth: usize, output: &mut String) {
    let node_type = node.get("type").and_then(Value::as_str).unwrap_or_default();
    match node_type {
        "paragraph" => {
            output.push_str(&markdown_inline(node));
            output.push_str("\n\n");
        }
        "heading" => {
            let level = node
                .get("attrs")
                .and_then(|attrs| attrs.get("level"))
                .and_then(Value::as_u64)
                .unwrap_or(1)
                .clamp(1, 3);
            output.push_str(&"#".repeat(level as usize));
            output.push(' ');
            output.push_str(&markdown_inline(node));
            output.push_str("\n\n");
        }
        "horizontalRule" => output.push_str("---\n\n"),
        "codeBlock" => {
            let language = node
                .get("attrs")
                .and_then(|attrs| attrs.get("language"))
                .and_then(Value::as_str)
                .unwrap_or_default();
            output.push_str(&format!("```{language}\n{}\n```\n\n", plain_text(node)));
        }
        "collapsibleBlock" => {
            let title = node
                .get("attrs")
                .and_then(|attrs| attrs.get("title"))
                .and_then(Value::as_str)
                .unwrap_or("Sezione");
            output.push_str(&format!("### {}\n\n", escape_markdown(title)));
            if let Some(children) = node.get("content").and_then(Value::as_array) {
                for child in children {
                    render_markdown_node(child, depth, output);
                }
            }
        }
        "bulletList" | "orderedList" | "taskList" => {
            if let Some(items) = node.get("content").and_then(Value::as_array) {
                for (index, item) in items.iter().enumerate() {
                    let prefix = if node_type == "orderedList" {
                        format!("{}. ", index + 1)
                    } else if node_type == "taskList" {
                        let checked = item
                            .get("attrs")
                            .and_then(|attrs| attrs.get("checked"))
                            .and_then(Value::as_bool)
                            .unwrap_or(false);
                        format!("- [{}] ", if checked { "x" } else { " " })
                    } else {
                        "- ".to_string()
                    };
                    output.push_str(&"  ".repeat(depth));
                    output.push_str(&prefix);
                    output.push_str(&list_item_text(item));
                    output.push('\n');
                    if let Some(children) = item.get("content").and_then(Value::as_array) {
                        for child in children.iter().skip(1) {
                            render_markdown_node(child, depth + 1, output);
                        }
                    }
                }
                output.push('\n');
            }
        }
        "image" => output.push_str("[Immagine allegata]\n\n"),
        _ => {
            if let Some(children) = node.get("content").and_then(Value::as_array) {
                for child in children {
                    render_markdown_node(child, depth, output);
                }
            }
        }
    }
}

fn markdown_inline(node: &Value) -> String {
    node.get("content")
        .and_then(Value::as_array)
        .map(|nodes| {
            nodes
                .iter()
                .map(|node| {
                    if node.get("type").and_then(Value::as_str) == Some("hardBreak") {
                        return "  \n".to_string();
                    }
                    let mut text = escape_markdown(
                        node.get("text").and_then(Value::as_str).unwrap_or_default(),
                    );
                    if let Some(marks) = node.get("marks").and_then(Value::as_array) {
                        for mark in marks {
                            match mark.get("type").and_then(Value::as_str) {
                                Some("bold") => text = format!("**{text}**"),
                                Some("italic") => text = format!("_{text}_"),
                                Some("strike") => text = format!("~~{text}~~"),
                                Some("code") => text = format!("`{text}`"),
                                Some("link") => {
                                    if let Some(href) = mark
                                        .get("attrs")
                                        .and_then(|attrs| attrs.get("href"))
                                        .and_then(Value::as_str)
                                    {
                                        text = format!("[{text}]({href})");
                                    }
                                }
                                _ => {}
                            }
                        }
                    }
                    text
                })
                .collect::<String>()
        })
        .unwrap_or_default()
}

fn render_html_node(node: &Value, output: &mut String) {
    let node_type = node.get("type").and_then(Value::as_str).unwrap_or_default();
    match node_type {
        "paragraph" => output.push_str(&format!(
            "<p{}>{}</p>",
            alignment_style(node),
            html_inline(node)
        )),
        "heading" => {
            let level = node
                .get("attrs")
                .and_then(|attrs| attrs.get("level"))
                .and_then(Value::as_u64)
                .unwrap_or(1)
                .clamp(1, 3);
            output.push_str(&format!(
                "<h{level}{}>{}</h{level}>",
                alignment_style(node),
                html_inline(node)
            ));
        }
        "horizontalRule" => {
            let thickness = node.get("attrs").and_then(|a| a.get("thickness")).and_then(Value::as_i64).filter(|n| (1..=8).contains(n)).unwrap_or(2);
            output.push_str(&format!("<hr style=\"background-size:100% {thickness}px\">"));
        },
        "codeBlock" => output.push_str(&format!(
            "<pre><code>{}</code></pre>",
            escape_html(&plain_text(node))
        )),
        "collapsibleBlock" => {
            let attrs = node.get("attrs");
            let title = attrs
                .and_then(|attrs| attrs.get("title"))
                .and_then(Value::as_str)
                .unwrap_or("Sezione");
            let open = attrs
                .and_then(|attrs| attrs.get("open"))
                .and_then(Value::as_bool)
                .unwrap_or(true);
            output.push_str(if open { "<details open>" } else { "<details>" });
            let color = attrs.and_then(|attrs| attrs.get("color")).and_then(Value::as_str)
                .filter(|color| crate::editor::COLLAPSIBLE_COLORS.contains(color));
            let style = color.map(|color| format!(" style=\"background:{color}\"")).unwrap_or_default();
            output.push_str(&format!("<summary{style}>{}</summary><div>", escape_html(title)));
            if let Some(children) = node.get("content").and_then(Value::as_array) {
                for child in children {
                    render_html_node(child, output);
                }
            }
            output.push_str("</div></details>");
        }
        "bulletList" | "orderedList" | "taskList" => {
            let tag = if node_type == "orderedList" {
                "ol"
            } else {
                "ul"
            };
            output.push_str(&format!("<{tag}>"));
            if let Some(items) = node.get("content").and_then(Value::as_array) {
                for item in items {
                    output.push_str("<li>");
                    if node_type == "taskList" {
                        let checked = item
                            .get("attrs")
                            .and_then(|attrs| attrs.get("checked"))
                            .and_then(Value::as_bool)
                            .unwrap_or(false);
                        output.push_str(if checked { "☑ " } else { "☐ " });
                    }
                    if let Some(children) = item.get("content").and_then(Value::as_array) {
                        for child in children {
                            if child.get("type").and_then(Value::as_str) == Some("paragraph") {
                                output.push_str(&html_inline(child));
                            } else {
                                render_html_node(child, output);
                            }
                        }
                    }
                    output.push_str("</li>");
                }
            }
            output.push_str(&format!("</{tag}>"));
        }
        "image" => output.push_str("<p>[Immagine allegata]</p>"),
        _ => {
            if let Some(children) = node.get("content").and_then(Value::as_array) {
                for child in children {
                    render_html_node(child, output);
                }
            }
        }
    }
}

fn html_inline(node: &Value) -> String {
    node.get("content")
        .and_then(Value::as_array)
        .map(|nodes| {
            nodes
                .iter()
                .map(|node| {
                    if node.get("type").and_then(Value::as_str) == Some("hardBreak") {
                        return "<br>".to_string();
                    }
                    let mut text =
                        escape_html(node.get("text").and_then(Value::as_str).unwrap_or_default());
                    if let Some(marks) = node.get("marks").and_then(Value::as_array) {
                        for mark in marks {
                            let attrs = mark.get("attrs");
                            match mark.get("type").and_then(Value::as_str) {
                                Some("bold") => text = format!("<strong>{text}</strong>"),
                                Some("italic") => text = format!("<em>{text}</em>"),
                                Some("underline") => text = format!("<u>{text}</u>"),
                                Some("strike") => text = format!("<s>{text}</s>"),
                                Some("code") => text = format!("<code>{text}</code>"),
                                Some("highlight") => {
                                    let color = attrs
                                        .and_then(|attrs| attrs.get("color"))
                                        .and_then(Value::as_str)
                                        .filter(|color| crate::editor::is_hex_color(color))
                                        .unwrap_or("#f5d98f");
                                    text =
                                        format!("<mark style=\"background:{color}\">{text}</mark>");
                                }
                                Some("link") => {
                                    if let Some(href) = attrs
                                        .and_then(|attrs| attrs.get("href"))
                                        .and_then(Value::as_str)
                                    {
                                        text =
                                            format!("<a href=\"{}\">{text}</a>", escape_html(href));
                                    }
                                }
                                Some("textStyle") => {
                                    let font = attrs
                                        .and_then(|attrs| attrs.get("fontFamily"))
                                        .and_then(Value::as_str);
                                    let vertical = attrs
                                        .and_then(|attrs| attrs.get("verticalAlign"))
                                        .and_then(Value::as_str);
                                    if font.is_some() || vertical.is_some() {
                                        text = format!(
                                            "<span style=\"{}{}\">{text}</span>",
                                            font.map(|value| format!(
                                                "font-family:'{}';",
                                                escape_html(value)
                                            ))
                                            .unwrap_or_default(),
                                            vertical
                                                .map(|value| format!(
                                                    "vertical-align:{};",
                                                    escape_html(value)
                                                ))
                                                .unwrap_or_default()
                                        );
                                    }
                                }
                                _ => {}
                            }
                        }
                    }
                    text
                })
                .collect::<String>()
        })
        .unwrap_or_default()
}

fn alignment_style(node: &Value) -> String {
    node.get("attrs")
        .and_then(|attrs| attrs.get("textAlign"))
        .and_then(Value::as_str)
        .map(|alignment| format!(" style=\"text-align:{}\"", escape_html(alignment)))
        .unwrap_or_default()
}

fn list_item_text(node: &Value) -> String {
    node.get("content")
        .and_then(Value::as_array)
        .and_then(|children| children.first())
        .map(markdown_inline)
        .unwrap_or_default()
}

fn plain_text(node: &Value) -> String {
    if let Some(text) = node.get("text").and_then(Value::as_str) {
        return text.to_string();
    }
    node.get("content")
        .and_then(Value::as_array)
        .map(|children| children.iter().map(plain_text).collect())
        .unwrap_or_default()
}

fn escape_markdown(value: &str) -> String {
    let mut escaped = String::with_capacity(value.len());
    for character in value.chars() {
        if matches!(character, '\\' | '*' | '_' | '[' | ']' | '`') {
            escaped.push('\\');
        }
        escaped.push(character);
    }
    escaped
}

fn escape_html(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
}

#[cfg(test)]
mod tests {
    use super::{render_html, render_markdown};
    use serde_json::json;

    #[test]
    fn collapsible_colors_are_validated_and_exported() {
        for color in crate::editor::COLLAPSIBLE_COLORS {
            let mut document = json!({"schemaVersion":1,"type":"doc","content":[{"type":"collapsibleBlock","attrs":{"title":"Colorato","open":true,"color":color},"content":[{"type":"paragraph"}]}]});
            assert!(crate::editor::validate_and_extract(&document).is_ok());
            let html = render_html("", "", &document, "cream", 2, "jakarta", 16);
            assert!(html.contains(&format!("<summary style=\"background:{color}\">")));
            document["content"][0]["attrs"]["color"] = json!("red;position:fixed");
            assert!(crate::editor::validate_and_extract(&document).is_err());
            assert!(!render_html("", "", &document, "cream", 2, "jakarta", 16).contains("position:fixed"));
        }
    }

    #[test]
    fn renders_supported_document_shapes() {
        let document = json!({
            "content": [
                {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Sezione"}]},
                {"type": "paragraph", "content": [{"type": "text", "text": "Testo", "marks": [{"type": "bold"}]}]},
                {"type": "taskList", "content": [{"type": "taskItem", "attrs": {"checked": true}, "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Fatto"}]}]}]},
                {"type": "codeBlock", "attrs": {"language": "rust"}, "content": [{"type": "text", "text": "fn main() {}"}]},
                {"type": "collapsibleBlock", "attrs": {"title": "Approfondimento", "open": false}, "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Dettagli"}]}]},
                {"type": "horizontalRule"}
            ]
        });
        let markdown = render_markdown("Titolo", "Sottotitolo", &document);
        let html = render_html("Titolo", "Sottotitolo", &document, "sage", 3, "georgia", 18);
        assert!(markdown.contains("## Sezione"));
        assert!(markdown.contains("- [x] Fatto"));
        assert!(markdown.contains("```rust"));
        assert!(markdown.contains("### Approfondimento"));
        assert!(markdown.contains("---"));
        assert!(html.contains("<h2>Sezione</h2>"));
        assert!(html.contains("<hr style=\"background-size:100% 2px\">"));
        assert!(html.contains("<details><summary>Approfondimento</summary>"));
        assert!(html.contains("background:#eaf6e3"));
        assert!(html.contains("font-size:18px"));
        assert!(html.contains("line-height:32px"));
    }
}
