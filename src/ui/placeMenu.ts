/** Flip above the anchor, then clamp tall menus to a scrollable viewport. */
export function placeMenu(x: number, y: number, width: number, height: number, margin = 8) {
  const maxHeight = Math.max(0, window.innerHeight - margin * 2);
  const h = Math.min(height, maxHeight);
  const left = Math.max(margin, Math.min(x, window.innerWidth - width - margin));
  // The anchor can fall outside the window after a resize: keep it inside before flipping.
  const anchor = Math.min(y, window.innerHeight - margin);
  const top = anchor + h <= window.innerHeight - margin ? anchor : anchor - h >= margin ? anchor - h : Math.max(margin, window.innerHeight - h - margin);
  return { left, top, maxHeight };
}
