/**
 * Material ripple for every clickable control, starting where the pointer went down.
 * It never adds nodes to the DOM React owns: it sets the origin as CSS variables and
 * flips `data-ripple` between "a" and "b" so the ::after animation restarts on each press.
 */
const HOSTS = "button, summary, [role='button'], [role='menuitem'], [role='menuitemradio'], [role='tab']";
const timers = new WeakMap<HTMLElement, number>();

function play(host: HTMLElement, x: number, y: number) {
  const rect = host.getBoundingClientRect();
  const size = Math.hypot(Math.max(x - rect.left, rect.right - x), Math.max(y - rect.top, rect.bottom - y)) * 2;
  host.style.setProperty("--ripple-x", `${x - rect.left}px`);
  host.style.setProperty("--ripple-y", `${y - rect.top}px`);
  host.style.setProperty("--ripple-size", `${size}px`);
  host.dataset.ripple = host.dataset.ripple === "a" ? "b" : "a";
  window.clearTimeout(timers.get(host));
  timers.set(host, window.setTimeout(() => delete host.dataset.ripple, 650));
}

function hostOf(target: EventTarget | null): HTMLElement | null {
  const host = target instanceof Element ? target.closest<HTMLElement>(HOSTS) : null;
  // ProseMirror watches attribute changes inside the document: its controls keep only the state layer.
  if (!host || host.closest(".ProseMirror") || host.matches(":disabled, [aria-disabled='true']")) return null;
  return host;
}

export function installRipple() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  document.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    const host = hostOf(event.target);
    if (host) play(host, event.clientX, event.clientY);
  }, { passive: true });
  document.addEventListener("keydown", (event) => {
    if (event.repeat || (event.key !== "Enter" && event.key !== " ")) return;
    const host = hostOf(event.target);
    if (!host || host !== event.target) return;
    const rect = host.getBoundingClientRect();
    play(host, rect.left + rect.width / 2, rect.top + rect.height / 2);
  });
}
