type Metrics = { ascent: number; descent: number };
export type RuledLineError = { text: string; block: string; expected: number; actual: number };

const metricsCache = new Map<string, Metrics>();

export function fontMetrics(font: string): Metrics {
  const cached = metricsCache.get(font);
  if (cached) return cached;
  const context = document.createElement("canvas").getContext("2d")!;
  context.font = font;
  const measured = context.measureText("HgÀpq");
  const result = {
    ascent: measured.fontBoundingBoxAscent || measured.actualBoundingBoxAscent,
    descent: measured.fontBoundingBoxDescent || measured.actualBoundingBoxDescent,
  };
  // A fallback measured before the webfont loads must not become permanent.
  if (document.fonts.check(font)) metricsCache.set(font, result);
  return result;
}

export function computeBaselineShifts({ leading, bodyFont, headingFont, monoFont, fontSize }: {
  leading: number; bodyFont: string; headingFont: string; monoFont: string; fontSize: number;
}) {
  const gap = Math.ceil(fontMetrics(`${fontSize}px ${bodyFont}`).descent) + 1;
  const shift = (height: number, font: string) => {
    const { ascent, descent } = fontMetrics(font);
    return height - gap - ((height - ascent - descent) / 2 + ascent);
  };
  return {
    body: shift(leading, `${fontSize}px ${bodyFont}`),
    h1: shift(leading * 2, `${fontSize * 1.75}px ${headingFont}`),
    h2: shift(leading, `${fontSize * 1.35}px ${headingFont}`),
    h3: shift(leading, `${fontSize * 1.15}px ${headingFont}`),
    collapsible: shift(leading, `700 14px ${headingFont}`),
    code: shift(leading, `${fontSize * .85}px ${monoFont}`),
  };
}

export function checkRuledLines(root: HTMLElement): RuledLineError[] {
  const body = root.querySelector<HTMLElement>(".paper-body");
  const prose = root.querySelector<HTMLElement>(".note-prose");
  if (!body || !prose) return [];
  const leading = Number.parseFloat(getComputedStyle(root).getPropertyValue("--editor-leading"));
  const origin = body.getBoundingClientRect().top;
  const gap = Math.ceil(fontMetrics(`${getComputedStyle(prose).fontSize} ${getComputedStyle(prose).fontFamily}`).descent) + 1;
  const errors: RuledLineError[] = [];
  const seen = new Set<string>();
  const lines = new Map<Element, number[]>();
  for (const block of prose.querySelectorAll(":scope > p, :scope > h1, :scope > h2, :scope > h3, :scope > ul, :scope > ol, :scope > .code-block, :scope > hr, :scope > .collapsible-block")) {
    if (block.classList.contains("is-folded")) continue; // hidden by a folded heading: takes no room
    const style = getComputedStyle(block);
    const shift = style.top === "auto" ? 0 : Number.parseFloat(style.top) || 0;
    const actual = block.getBoundingClientRect().top - origin - shift;
    const expected = Math.round(actual / leading) * leading;
    if (Math.abs(actual - expected) > 1) errors.push({ text: block.textContent?.trim().slice(0, 40) ?? "", block: block.tagName.toLowerCase(), expected, actual: Math.round(actual * 10) / 10 });
  }
  for (const input of prose.querySelectorAll<HTMLInputElement>(".collapsible-header input")) {
    if (input.closest(".is-folded")) continue;
    const style = getComputedStyle(input);
    const { ascent, descent } = fontMetrics(`${style.fontWeight} ${style.fontSize} ${style.fontFamily}`);
    const rect = input.getBoundingClientRect();
    const actual = rect.top + (rect.height - ascent - descent) / 2 + ascent - origin;
    const expected = Math.round((actual + gap) / leading) * leading - gap;
    if (Math.abs(actual - expected) > 1) errors.push({ text: input.value.slice(0, 40), block: "collapsible-header", expected, actual: Math.round(actual * 10) / 10 });
  }
  const walker = document.createTreeWalker(prose, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (!node.textContent?.trim()) continue;
    const parent = node.parentElement;
    if (!parent || parent.closest('[contenteditable="false"], .collapsible-block[data-open="false"] .collapsible-content, .is-folded')) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    const style = getComputedStyle(parent);
    const descent = fontMetrics(`${style.fontWeight} ${style.fontSize} ${style.fontFamily}`).descent;
    for (const rect of range.getClientRects()) {
      if (!rect.width || !rect.height) continue;
      const blockElement = parent.closest("p, h1, h2, h3, pre, li") ?? parent;
      const block = blockElement.tagName.toLowerCase();
      const actual = rect.bottom - descent - origin;
      const expected = Math.round((actual + gap) / leading) * leading - gap;
      const id = `${block}:${Math.round(rect.top)}:${Math.round(rect.left)}`;
      if (!seen.has(id) && Math.abs(actual - expected) > 1) errors.push({ text: node.textContent.trim().slice(0, 40), block, expected, actual: Math.round(actual * 10) / 10 });
      seen.add(id);
      const positions = lines.get(blockElement) ?? [];
      if (!positions.some((position) => Math.abs(position - actual) < 1)) positions.push(actual);
      lines.set(blockElement, positions);
    }
  }
  for (const [block, positions] of lines) {
    positions.sort((left, right) => left - right);
    for (let index = 1; index < positions.length; index += 1) {
      const actual = positions[index]! - positions[index - 1]!;
      const imageBetween = [...block.querySelectorAll<HTMLElement>(".note-image.wrap-inline, .note-image.wrap-square, .note-image.wrap-break")].some(image => {
        const box = image.getBoundingClientRect();
        return box.top - origin < positions[index]! && box.bottom - origin > positions[index - 1]!;
      });
      // Images reserve whole ruled rows; every text baseline is still checked above.
      const expected = imageBetween ? Math.max(1, Math.round(actual / leading)) * leading : block.tagName === "H1" ? leading * 2 : leading;
      if (Math.abs(actual - expected) > 1) errors.push({ text: block.textContent?.trim().slice(0, 40) ?? "", block: block.tagName.toLowerCase(), expected, actual: Math.round(actual * 10) / 10 });
    }
  }
  return errors;
}
