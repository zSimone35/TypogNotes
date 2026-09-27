import { Extension, type Editor } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

type TextRange = { from: number; to: number };

const key = new PluginKey<TextRange[]>("multiSelection");

export const MultiSelection = Extension.create({
  name: "multiSelection",
  addProseMirrorPlugins() {
    return [new Plugin<TextRange[]>({
      key,
      state: {
        init: () => [],
        apply(transaction, ranges) {
          const meta = transaction.getMeta(key) as { add?: TextRange; clear?: boolean } | undefined;
          if (meta?.clear) return [];
          if (meta?.add) {
            const exists = ranges.some((range) => range.from === meta.add!.from && range.to === meta.add!.to);
            return exists ? ranges : [...ranges, meta.add];
          }
          return transaction.docChanged ? ranges.filter((range) => range.to <= transaction.doc.content.size) : ranges;
        },
      },
      props: {
        decorations(state) {
          const ranges = key.getState(state) ?? [];
          return DecorationSet.create(state.doc, ranges.map((range) => Decoration.inline(range.from, range.to, { class: "multi-selection" })));
        },
        handleDOMEvents: {
          mousedown(view, event) {
            const mouse = event as MouseEvent;
            if ((mouse.ctrlKey || mouse.metaKey) && !view.state.selection.empty) {
              const { from, to } = view.state.selection;
              view.dispatch(view.state.tr.setMeta(key, { add: { from, to } }));
            }
            return false;
          },
          mouseup(view, event) {
            const mouse = event as MouseEvent;
            const { from, to, empty } = view.state.selection;
            if ((mouse.ctrlKey || mouse.metaKey) && !empty) {
              view.dispatch(view.state.tr.setMeta(key, { add: { from, to } }));
            } else if ((key.getState(view.state)?.length ?? 0) > 0) {
              view.dispatch(view.state.tr.setMeta(key, { clear: true }));
            }
            return false;
          },
          copy(view, event) {
            const ranges = selectedRanges(view.state);
            if (ranges.length < 2 || !event.clipboardData) return false;
            event.clipboardData.setData("text/plain", ranges.map((range) => view.state.doc.textBetween(range.from, range.to, "\n")).join("\n"));
            event.preventDefault();
            return true;
          },
          cut(view, event) {
            const ranges = selectedRanges(view.state);
            if (ranges.length < 2 || !event.clipboardData || !view.editable) return false;
            event.clipboardData.setData("text/plain", ranges.map((range) => view.state.doc.textBetween(range.from, range.to, "\n")).join("\n"));
            let transaction = view.state.tr;
            for (const range of [...ranges].sort((left, right) => right.from - left.from)) transaction = transaction.delete(range.from, range.to);
            view.dispatch(transaction.setMeta(key, { clear: true }));
            event.preventDefault();
            return true;
          },
        },
      },
    })];
  },
});

export function runForTextSelections(editor: Editor, action: () => void): void {
  const ranges = selectedRanges(editor.state);
  if (ranges.length < 2) {
    action();
    return;
  }
  const original = { from: editor.state.selection.from, to: editor.state.selection.to };
  for (const range of ranges) {
    editor.commands.setTextSelection(range);
    action();
  }
  editor.commands.setTextSelection(original);
  editor.view.dispatch(editor.state.tr.setMeta(key, { clear: true }));
}

export function clearTextSelections(editor: Editor): void {
  editor.view.dispatch(editor.state.tr.setMeta(key, { clear: true }));
}

function selectedRanges(state: Editor["state"]): TextRange[] {
  const ranges = [...(key.getState(state) ?? [])];
  if (!state.selection.empty) ranges.push({ from: state.selection.from, to: state.selection.to });
  return ranges
    .filter((range, index, all) => range.from < range.to && all.findIndex((item) => item.from === range.from && item.to === range.to) === index)
    .sort((left, right) => left.from - right.from);
}
