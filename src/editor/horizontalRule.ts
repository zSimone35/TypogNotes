import HorizontalRule from "@tiptap/extension-horizontal-rule";

export const RULE_THICKNESSES = [1, 2, 3, 4, 6, 8] as const;
export const ThickHorizontalRule = HorizontalRule.extend({
  addAttributes() {
    return { thickness: {
      default: 1,
      parseHTML: el => { const n = Number(el.getAttribute("data-thickness")); return Number.isInteger(n) && n >= 1 && n <= 8 ? n : 1; },
      renderHTML: a => ({ "data-thickness": a.thickness, style: `--hr-thickness: ${a.thickness}px` }),
    } };
  },
});
