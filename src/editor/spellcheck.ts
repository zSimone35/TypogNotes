import { Extension, type Editor } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export type SpellRange = { word: string; from: number; to: number };

const key = new PluginKey<SpellRange[]>("typognotesSpellcheck");

export const SpellcheckDecorations = Extension.create({
  name: "typognotesSpellcheck",
  addProseMirrorPlugins() {
    return [new Plugin<SpellRange[]>({
      key,
      state: {
        init: () => [],
        apply(transaction, ranges) {
          const next = transaction.getMeta(key) as SpellRange[] | undefined;
          if (next) return next;
          return transaction.docChanged ? [] : ranges;
        },
      },
      props: {
        decorations(state) {
          return DecorationSet.create(state.doc, (key.getState(state) ?? []).map((range) =>
            Decoration.inline(range.from, range.to, { class: "spelling-error" }),
          ));
        },
      },
    })];
  },
});

export function setSpellcheckRanges(editor: Editor, ranges: SpellRange[]): void {
  editor.view.dispatch(editor.state.tr.setMeta(key, ranges));
}

export function wordsInDocument(editor: Editor, range?: { from: number; to: number }): SpellRange[] {
  const words: SpellRange[] = [];
  editor.state.doc.descendants((node, position) => {
    if (node.type.name === "codeBlock") return false;
    if (!node.isText || !node.text || node.marks.some(mark => mark.type.name === "code")) return;
    for (const match of node.text.matchAll(/[\p{L}][\p{L}'’-]*/gu)) {
      const word = match[0];
      const from = position + (match.index ?? 0);
      if (!range || (from >= range.from && from + word.length <= range.to)) words.push({ word, from, to: from + word.length });
    }
  });
  return words;
}
