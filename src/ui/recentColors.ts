import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

export type ColorKind = "text" | "highlight";

const LIMIT = 10;
// Fill the context menu row while a note has fewer than five colours of its own.
const DEFAULTS: Record<ColorKind, string[]> = {
  text: ["#000000", "#cc0000", "#1155cc", "#38761d", "#674ea7"],
  highlight: ["#ffff00", "#b6d7a8", "#9fc5e8", "#f9cb9c", "#d5a6bd"],
};

const key = (kind: ColorKind, noteId: number) => `typognotes.recentColors.${kind}.${noteId}`;

function stored(kind: ColorKind, noteId: number): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(key(kind, noteId)) ?? "[]");
    return Array.isArray(value) ? value.filter((hex) => typeof hex === "string") : [];
  } catch {
    return [];
  }
}

/** Colours already in the note, in document order: the history of a note never used on this computer. */
function colorsInDocument(kind: ColorKind, doc: ProseMirrorNode): string[] {
  const found: string[] = [];
  doc.descendants((node) => {
    for (const mark of node.marks) {
      const color = kind === "text" ? (mark.type.name === "textStyle" ? mark.attrs.color : null) : (mark.type.name === "highlight" ? mark.attrs.color : null);
      if (typeof color === "string" && !found.includes(color)) found.push(color);
    }
  });
  return found;
}

/** The last colours used in this note, newest first. */
export function recentColors(kind: ColorKind, noteId: number, doc: ProseMirrorNode): string[] {
  const recent = stored(kind, noteId);
  return (recent.length ? recent : colorsInDocument(kind, doc)).slice(0, LIMIT);
}

/** Five colours for the context menu: the note's recent ones, padded with defaults. */
export function recentColorsRow(kind: ColorKind, noteId: number, doc: ProseMirrorNode): string[] {
  const recent = recentColors(kind, noteId, doc);
  return [...recent, ...DEFAULTS[kind].filter((hex) => !recent.includes(hex))].slice(0, 5);
}

export function rememberColor(kind: ColorKind, noteId: number, doc: ProseMirrorNode, hex: string): void {
  try {
    localStorage.setItem(key(kind, noteId), JSON.stringify([hex, ...recentColors(kind, noteId, doc).filter((item) => item !== hex)].slice(0, LIMIT)));
  } catch { /* the history lasts for this session only */ }
}
