import { Extension } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";

const key = new PluginKey<DecorationSet>("typognotesHeadingFold");

type Fold = { headingPos: number; from: number; to: number };

/**
 * Sections of top-level blocks: a collapsed H1-H3 hides the blocks after it until the next heading
 * of the same or a higher level. Nothing is removed from the document, the blocks are only hidden.
 */
function scan(doc: ProseMirrorNode) {
  const decorations: Decoration[] = [];
  const folds: Fold[] = [];
  const blocks: Array<{ node: ProseMirrorNode; pos: number }> = [];
  doc.forEach((node, pos) => blocks.push({ node, pos }));
  let hiding: { level: number; fold: Fold } | null = null;
  blocks.forEach(({ node, pos }, index) => {
    const level = node.type.name === "heading" ? Number(node.attrs.level) : null;
    if (hiding && level !== null && level <= hiding.level) hiding = null;
    if (hiding) {
      decorations.push(Decoration.node(pos, pos + node.nodeSize, { class: "is-folded" }));
      hiding.fold.to = pos + node.nodeSize;
      return;
    }
    if (level === null) return;
    const next = blocks[index + 1]?.node;
    const hasSection = next !== undefined && !(next.type.name === "heading" && Number(next.attrs.level) <= level);
    if (!hasSection) return;
    const collapsed = Boolean(node.attrs.collapsed);
    decorations.push(Decoration.node(pos, pos + node.nodeSize, { class: collapsed ? "has-fold is-collapsed" : "has-fold" }));
    decorations.push(Decoration.widget(pos + node.nodeSize - 1, (view) => foldButton(view, pos, collapsed), { side: 1, ignoreSelection: true, key: `fold-${pos}-${collapsed}` }));
    if (collapsed) {
      const fold = { headingPos: pos, from: pos + node.nodeSize, to: pos + node.nodeSize };
      folds.push(fold);
      hiding = { level, fold };
    }
  });
  return { decorations: DecorationSet.create(doc, decorations), folds };
}

function foldButton(view: EditorView, headingPos: number, collapsed: boolean) {
  const button = document.createElement("button");
  const label = collapsed ? "Mostra la sezione" : "Nascondi la sezione";
  button.type = "button";
  button.className = "heading-fold";
  button.contentEditable = "false";
  button.title = label;
  button.setAttribute("aria-label", label);
  button.setAttribute("aria-expanded", String(!collapsed));
  button.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
  // mousedown would move the caret into the heading: toggle there and keep the selection where it is.
  button.addEventListener("mousedown", (event) => {
    event.preventDefault();
    const node = view.state.doc.nodeAt(headingPos);
    if (node?.type.name !== "heading") return;
    const collapsing = !node.attrs.collapsed;
    const tr = view.state.tr.setNodeMarkup(headingPos, undefined, { ...node.attrs, collapsed: collapsing }).setMeta(key, "toggle");
    // The caret must not stay inside what is being hidden: park it at the end of the heading.
    const fold = collapsing ? scan(tr.doc).folds.find((item) => item.headingPos === headingPos) : undefined;
    if (fold && tr.selection.from >= fold.from && tr.selection.from < fold.to) tr.setSelection(TextSelection.create(tr.doc, headingPos + node.nodeSize - 1));
    view.dispatch(tr);
  });
  return button;
}

export const HeadingFold = Extension.create({
  name: "headingFold",
  addGlobalAttributes() {
    return [{
      types: ["heading"],
      attributes: {
        collapsed: {
          default: false,
          parseHTML: (element) => element.getAttribute("data-collapsed") === "true",
          renderHTML: (attributes) => attributes.collapsed ? { "data-collapsed": "true" } : {},
        },
      },
    }];
  },
  addProseMirrorPlugins() {
    return [new Plugin<DecorationSet>({
      key,
      state: {
        init: (_, state) => scan(state.doc).decorations,
        apply: (tr, value, _, state) => tr.docChanged ? scan(state.doc).decorations : value,
      },
      props: { decorations: (state) => key.getState(state) },
      // A caret that lands in a hidden section (find, undo, arrows, outline) opens it.
      appendTransaction(transactions, _, state) {
        if (transactions.some((tr) => tr.getMeta(key) === "toggle") || !transactions.some((tr) => tr.selectionSet || tr.docChanged)) return null;
        const { from } = state.selection;
        const hit = scan(state.doc).folds.filter((fold) => from >= fold.from && from < fold.to);
        if (!hit.length) return null;
        const tr = state.tr;
        for (const fold of hit) {
          const node = tr.doc.nodeAt(fold.headingPos);
          if (node) tr.setNodeMarkup(fold.headingPos, undefined, { ...node.attrs, collapsed: false });
        }
        return tr;
      },
    })];
  },
});
