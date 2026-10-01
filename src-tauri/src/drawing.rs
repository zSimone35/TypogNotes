//! Drawing notes: strokes stored as vectors (`[x, y, pressure]` points on a 1000-unit wide page).

use serde_json::{Value, json};

use crate::editor::is_hex_color;

pub const PAGE_WIDTH: f64 = 1000.0;
const MIN_HEIGHT: f64 = 500.0;
const MAX_HEIGHT: f64 = 200_000.0;
const MAX_STROKES: usize = 20_000;
const MAX_POINTS_PER_STROKE: usize = 10_000;
const MAX_POINTS: usize = 500_000;
const BACKGROUNDS: &[&str] = &["blank", "lines", "grid"];
const TOOLS: &[&str] = &["pen", "highlighter"];
/// Ink colour used for `color: null` (the theme-adaptive default ink) when exporting.
const DEFAULT_INK: &str = "#1f1b16";

pub fn empty_drawing() -> Value {
    json!({ "schemaVersion": 1, "type": "drawing", "background": "lines", "height": 1414, "strokes": [] })
}

pub fn validate_drawing(document: &Value) -> Result<(), String> {
    let object = document
        .as_object()
        .ok_or_else(|| "Il disegno non è un documento valido.".to_string())?;
    if object.get("type").and_then(Value::as_str) != Some("drawing")
        || object.get("schemaVersion").and_then(Value::as_i64) != Some(1)
    {
        return Err("La versione del disegno non è supportata.".to_string());
    }
    if !object
        .get("background")
        .and_then(Value::as_str)
        .is_some_and(|background| BACKGROUNDS.contains(&background))
    {
        return Err("Lo sfondo del disegno non è valido.".to_string());
    }
    let height = object
        .get("height")
        .and_then(Value::as_f64)
        .filter(|height| (MIN_HEIGHT..=MAX_HEIGHT).contains(height))
        .ok_or_else(|| "L'altezza del foglio non è valida.".to_string())?;
    let strokes = object
        .get("strokes")
        .and_then(Value::as_array)
        .ok_or_else(|| "Il disegno non contiene tratti validi.".to_string())?;
    if strokes.len() > MAX_STROKES {
        return Err("Il disegno contiene troppi tratti.".to_string());
    }
    let mut total_points = 0;
    for stroke in strokes {
        let stroke = stroke
            .as_object()
            .ok_or_else(|| "Un tratto del disegno non è valido.".to_string())?;
        if !stroke.get("tool").and_then(Value::as_str).is_some_and(|tool| TOOLS.contains(&tool)) {
            return Err("Lo strumento di un tratto non è supportato.".to_string());
        }
        match stroke.get("color") {
            Some(Value::Null) => {}
            Some(Value::String(color)) if is_hex_color(color) => {}
            _ => return Err("Il colore di un tratto non è valido.".to_string()),
        }
        if !stroke.get("size").and_then(Value::as_f64).is_some_and(|size| (0.5..=64.0).contains(&size)) {
            return Err("Lo spessore di un tratto non è valido.".to_string());
        }
        let points = stroke
            .get("points")
            .and_then(Value::as_array)
            .filter(|points| (1..=MAX_POINTS_PER_STROKE).contains(&points.len()))
            .ok_or_else(|| "Un tratto contiene un numero di punti non valido.".to_string())?;
        total_points += points.len();
        if total_points > MAX_POINTS {
            return Err("Il disegno contiene troppi punti.".to_string());
        }
        for point in points {
            let valid = point.as_array().is_some_and(|point| {
                let value = |index: usize| point.get(index).and_then(Value::as_f64);
                point.len() == 3
                    && value(0).is_some_and(|x| (-10.0..=PAGE_WIDTH + 10.0).contains(&x))
                    && value(1).is_some_and(|y| (-10.0..=height + 10.0).contains(&y))
                    && value(2).is_some_and(|pressure| (0.0..=1.0).contains(&pressure))
            });
            if !valid {
                return Err("Un punto del disegno è fuori dal foglio o non è valido.".to_string());
            }
        }
    }
    Ok(())
}

/// Vector export: one round-capped path per stroke. Pressure is not exported (uniform width).
pub fn render_svg(document: &Value) -> String {
    let height = document.get("height").and_then(Value::as_f64).unwrap_or(1414.0);
    let mut svg = format!(
        "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 {PAGE_WIDTH} {height}\" width=\"100%\" role=\"img\" aria-label=\"Disegno\">"
    );
    for stroke in document.get("strokes").and_then(Value::as_array).into_iter().flatten() {
        let points = stroke.get("points").and_then(Value::as_array).cloned().unwrap_or_default();
        let path = points
            .iter()
            .enumerate()
            .filter_map(|(index, point)| {
                let x = point.get(0)?.as_f64()?;
                let y = point.get(1)?.as_f64()?;
                Some(format!("{}{x:.1} {y:.1}", if index == 0 { "M" } else { " L" }))
            })
            .collect::<String>();
        // A single point still shows as a dot thanks to the round cap.
        let path = if points.len() == 1 { format!("{path} l0 0") } else { path };
        let color = stroke
            .get("color")
            .and_then(Value::as_str)
            .filter(|color| is_hex_color(color))
            .unwrap_or(DEFAULT_INK);
        let size = stroke.get("size").and_then(Value::as_f64).unwrap_or(4.0);
        let opacity = if stroke.get("tool").and_then(Value::as_str) == Some("highlighter") { " stroke-opacity=\"0.35\"" } else { "" };
        svg.push_str(&format!(
            "<path d=\"{path}\" fill=\"none\" stroke=\"{color}\" stroke-width=\"{size}\" stroke-linecap=\"round\" stroke-linejoin=\"round\"{opacity}/>"
        ));
    }
    svg.push_str("</svg>");
    svg
}

#[cfg(test)]
mod tests {
    use super::{empty_drawing, render_svg, validate_drawing};
    use serde_json::json;

    fn drawing(stroke: serde_json::Value) -> serde_json::Value {
        json!({ "schemaVersion": 1, "type": "drawing", "background": "grid", "height": 1414, "strokes": [stroke] })
    }

    #[test]
    fn accepts_valid_drawings() {
        assert!(validate_drawing(&empty_drawing()).is_ok());
        assert!(validate_drawing(&drawing(json!({ "tool": "pen", "color": null, "size": 4, "points": [[10, 20, 0.5]] }))).is_ok());
        assert!(validate_drawing(&drawing(json!({ "tool": "highlighter", "color": "#ffcc00", "size": 18, "points": [[0, 0, 0], [1000, 1414, 1]] }))).is_ok());
    }

    #[test]
    fn rejects_invalid_drawings() {
        for stroke in [
            json!({ "tool": "laser", "color": null, "size": 4, "points": [[10, 20, 0.5]] }),
            json!({ "tool": "pen", "color": "red", "size": 4, "points": [[10, 20, 0.5]] }),
            json!({ "tool": "pen", "color": null, "size": 0, "points": [[10, 20, 0.5]] }),
            json!({ "tool": "pen", "color": null, "size": 4, "points": [] }),
            json!({ "tool": "pen", "color": null, "size": 4, "points": [[2000, 20, 0.5]] }),
            json!({ "tool": "pen", "color": null, "size": 4, "points": [[10, 20]] }),
            json!({ "tool": "pen", "color": null, "size": 4, "points": [[10, 20, 3]] }),
        ] {
            assert!(validate_drawing(&drawing(stroke.clone())).is_err(), "{stroke}");
        }
        let mut wrong_background = empty_drawing();
        wrong_background["background"] = json!("dots");
        assert!(validate_drawing(&wrong_background).is_err());
        let many = vec![json!([1, 1, 0.5]); 10_001];
        assert!(validate_drawing(&drawing(json!({ "tool": "pen", "color": null, "size": 4, "points": many }))).is_err());
    }

    #[test]
    fn exports_one_path_per_stroke() {
        let mut document = drawing(json!({ "tool": "pen", "color": null, "size": 4, "points": [[10, 20, 0.5], [30, 40, 0.5]] }));
        document["strokes"].as_array_mut().unwrap().push(json!({ "tool": "highlighter", "color": "#ffcc00", "size": 18, "points": [[5, 5, 0.5]] }));
        let svg = render_svg(&document);
        assert!(svg.starts_with("<svg") && svg.ends_with("</svg>"));
        assert_eq!(svg.matches("<path").count(), 2);
        assert!(svg.contains("d=\"M10.0 20.0 L30.0 40.0\"") && svg.contains("stroke-opacity=\"0.35\""));
    }
}
