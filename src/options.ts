import type { ShapeId } from "./ui/materialShapes";
import type {
  EditorFont,
  ExportFormat,
  InterfaceFont,
  LineSpacing,
  MonospaceFont,
  PaperColor,
  DictionaryLanguage,
} from "./api/types";

export const INTERFACE_FONTS: ReadonlyArray<{
  id: InterfaceFont;
  label: string;
  css: string;
}> = [
  { id: "roboto", label: "Roboto", css: 'Roboto, "Segoe UI", sans-serif' },
  { id: "jakarta", label: "Plus Jakarta Sans", css: '"Plus Jakarta Sans", "Segoe UI", sans-serif' },
  { id: "segoe", label: "Segoe UI", css: '"Segoe UI", sans-serif' },
  { id: "calibri", label: "Calibri", css: 'Calibri, "Segoe UI", sans-serif' },
  { id: "arial", label: "Arial", css: "Arial, sans-serif" },
  { id: "tahoma", label: "Tahoma", css: "Tahoma, sans-serif" },
  { id: "verdana", label: "Verdana", css: "Verdana, sans-serif" },
];

export const EDITOR_FONTS: ReadonlyArray<{
  id: EditorFont;
  label: string;
  css: string;
}> = [
  ...INTERFACE_FONTS,
  { id: "playfair", label: "Playfair Display", css: '"Playfair Display", Georgia, serif' },
  { id: "georgia", label: "Georgia", css: "Georgia, serif" },
  { id: "cambria", label: "Cambria", css: "Cambria, Georgia, serif" },
  { id: "times", label: "Times New Roman", css: '"Times New Roman", serif' },
  { id: "jetbrains", label: "JetBrains Mono", css: '"JetBrains Mono", Consolas, monospace' },
  { id: "cascadia", label: "Cascadia Code", css: '"Cascadia Code", Consolas, monospace' },
  { id: "consolas", label: "Consolas", css: 'Consolas, "Cascadia Code", monospace' },
];

export const MONOSPACE_FONTS: ReadonlyArray<{
  id: MonospaceFont;
  label: string;
  css: string;
}> = [
  { id: "jetbrains", label: "JetBrains Mono", css: '"JetBrains Mono", Consolas, monospace' },
  { id: "cascadia", label: "Cascadia Code", css: '"Cascadia Code", Consolas, monospace' },
  { id: "consolas", label: "Consolas", css: 'Consolas, "Cascadia Code", monospace' },
];

export const LINE_SPACINGS: ReadonlyArray<{ id: LineSpacing; label: string; px: number }> = [
  { id: 1, label: "24 px", px: 24 },
  { id: 2, label: "28 px", px: 28 },
  { id: 3, label: "32 px", px: 32 },
  { id: 4, label: "36 px", px: 36 },
  { id: 5, label: "40 px", px: 40 },
];

export const PAPER_COLORS: ReadonlyArray<{ id: PaperColor; label: string; darkLabel: string }> = [
  { id: "cream", label: "Crema", darkLabel: "Caffè" },
  { id: "warm-white", label: "Bianco caldo", darkLabel: "Grafite" },
  { id: "peach", label: "Pesca", darkLabel: "Terracotta" },
  { id: "sage", label: "Salvia", darkLabel: "Bosco" },
  { id: "sky", label: "Cielo", darkLabel: "Notte" },
  { id: "lavender", label: "Lavanda", darkLabel: "Prugna" },
  { id: "lemon", label: "Limone", darkLabel: "Oliva" },
  { id: "mint", label: "Menta", darkLabel: "Abete" },
  { id: "teal", label: "Acqua", darkLabel: "Laguna" },
  { id: "ocean", label: "Oceano", darkLabel: "Abisso" },
  { id: "lilac", label: "Lilla", darkLabel: "Melanzana" },
  { id: "rose", label: "Rosa", darkLabel: "Vinaccia" },
  { id: "coral", label: "Corallo", darkLabel: "Mattone" },
  { id: "sand", label: "Sabbia", darkLabel: "Cuoio" },
  { id: "stone", label: "Pietra", darkLabel: "Fumo" },
  { id: "slate", label: "Ardesia", darkLabel: "Antracite" },
];

export const EXPORT_FORMATS: ReadonlyArray<{ id: ExportFormat; label: string }> = [
  { id: "markdown", label: "Markdown" },
  { id: "html", label: "HTML" },
  { id: "pdf", label: "PDF" },
];

export const COLLAPSIBLE_COLORS = [
  { id: "#f5d98f", label: "Giallo", swatch: "var(--swatch-highlight-yellow)" },
  { id: "#f4b89f", label: "Pesca", swatch: "var(--swatch-highlight-peach)" },
  { id: "#bfe3c0", label: "Menta", swatch: "var(--swatch-highlight-mint)" },
  { id: "#b9ddee", label: "Azzurro", swatch: "var(--swatch-highlight-blue)" },
  { id: "#d8c7ed", label: "Lavanda", swatch: "var(--swatch-highlight-lavender)" },
  { id: "#bca7ee", label: "Viola", swatch: "var(--swatch-highlight-violet)" },
  { id: "#f19a7d", label: "Corallo", swatch: "var(--swatch-highlight-coral)" },
  { id: "#f2b04f", label: "Arancio", swatch: "var(--swatch-highlight-orange)" },
  { id: "#ead9bf", label: "Sabbia", swatch: "var(--swatch-highlight-sand)" },
  { id: "#c9c9c7", label: "Grigio", swatch: "var(--swatch-highlight-gray)" },
] as const;

export const PALETTE_ROWS: ReadonlyArray<ReadonlyArray<string>> = [
  ["#000000", "#434343", "#666666", "#999999", "#b7b7b7", "#cccccc", "#d9d9d9", "#efefef", "#f3f3f3", "#ffffff"],
  ["#980000", "#ff0000", "#ff9900", "#ffff00", "#00ff00", "#00ffff", "#4a86e8", "#0000ff", "#9900ff", "#ff00ff"],
  ["#e6b8af", "#f4cccc", "#fce5cd", "#fff2cc", "#d9ead3", "#d0e0e3", "#c9daf8", "#cfe2f3", "#d9d2e9", "#ead1dc"],
  ["#dd7e6b", "#ea9999", "#f9cb9c", "#ffe599", "#b6d7a8", "#a2c4c9", "#a4c2f4", "#9fc5e8", "#b4a7d6", "#d5a6bd"],
  ["#cc4125", "#e06666", "#f6b26b", "#ffd966", "#93c47d", "#76a5af", "#6d9eeb", "#6fa8dc", "#8e7cc3", "#c27ba0"],
  ["#a61c00", "#cc0000", "#e69138", "#f1c232", "#6aa84f", "#45818e", "#3c78d8", "#3d85c6", "#674ea7", "#a64d79"],
  ["#85200c", "#990000", "#b45f06", "#bf9000", "#38761d", "#134f5c", "#1155cc", "#0b5394", "#351c75", "#741b47"],
  ["#5b0f00", "#660000", "#783f04", "#7f6000", "#274e13", "#0c343d", "#1c4587", "#073763", "#20124d", "#4c1130"],
];
export function colorName(row: number, col: number): string {
  if (row === 0) return col === 0 ? "Nero" : col === 9 ? "Bianco" : `Grigio ${col}`;
  const hue = ["Rosso scuro", "Rosso", "Arancio", "Giallo", "Verde", "Ciano", "Azzurro", "Blu", "Viola", "Magenta"][col];
  return `${hue}${row === 1 ? "" : row < 5 ? ` chiaro ${5 - row}` : ` scuro ${row - 4}`}`;
}
export function toHex(value: string | null): string | null {
  if (!value) return null;
  if (/^#[0-9a-f]{6}$/i.test(value)) return value.toLowerCase();
  const rgb = value.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
  return rgb && rgb.slice(1).every(n => Number(n) <= 255) ? "#" + rgb.slice(1).map(n => Number(n).toString(16).padStart(2, "0")).join("") : null;
}


export const DICTIONARY_LANGUAGES: ReadonlyArray<{ id: DictionaryLanguage; label: string; locale: string }> = [
  { id: "it", label: "Italiano", locale: "it-IT" },
  { id: "en", label: "Inglese", locale: "en-US" },
  { id: "fr", label: "Francese", locale: "fr-FR" },
  { id: "es", label: "Spagnolo", locale: "es-ES" },
  { id: "de", label: "Tedesco", locale: "de-DE" },
];

export function lineSpacingPx(value: LineSpacing): number {
  return LINE_SPACINGS.find((item) => item.id === value)?.px ?? 28;
}

export function fontCss(
  id: InterfaceFont | EditorFont | MonospaceFont,
  group: "interface" | "editor" | "mono",
): string {
  const source = group === "interface" ? INTERFACE_FONTS : group === "mono" ? MONOSPACE_FONTS : EDITOR_FONTS;
  return source.find((font) => font.id === id)?.css ?? 'Roboto, "Segoe UI", sans-serif';
}

/** Editor leading never drops below 1.4× the font size, so text stays on the ruled lines. */
export function editorLeadingPx(value: LineSpacing, fontSize: number): number {
  return Math.max(lineSpacingPx(value), Math.ceil(fontSize * 1.4 / 2) * 2);
}

/** Pixel launcher icon shapes: the only ones offered, so the interface stays coherent. */
export const SHAPES: ReadonlyArray<{ id: ShapeId; label: string }> = [
  { id: "circle", label: "Cerchio" },
  { id: "square", label: "Quadrato" },
  { id: "cookie4Sided", label: "Biscotto 4" },
  { id: "cookie7Sided", label: "Biscotto 7" },
  { id: "arch", label: "Arco" },
];
