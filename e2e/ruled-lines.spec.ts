import { expect, test } from "@playwright/test";
import { installTauriMock } from "./tauri-mock";

test("le metriche non conservano il font di ripiego durante il caricamento", async ({ page }) => {
  await installTauriMock(page);
  let releaseFonts!: () => void;
  const pending = new Promise<void>(resolve => { releaseFonts = resolve; });
  await page.route("**/*playfair*.woff2", async route => { await pending; await route.continue(); });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const loaded = await page.evaluate(async () => {
    const { fontMetrics } = await import("/src/editor/ruledLines.ts");
    const font = '400 28px "Playfair Display"';
    fontMetrics(font);
    return document.fonts.check(font);
  });
  releaseFonts();
  expect(loaded).toBe(false);
  const metrics = await page.evaluate(async () => {
    const { fontMetrics } = await import("/src/editor/ruledLines.ts");
    const font = '400 28px "Playfair Display"';
    await document.fonts.load(font);
    const context = document.createElement("canvas").getContext("2d")!;
    context.font = font;
    return { cached: fontMetrics(font).descent, actual: context.measureText("HgÀpq").fontBoundingBoxDescent };
  });
  expect(metrics.cached).toBe(metrics.actual);
});

for (const spacing of [1, 3, 5]) for (const size of [12, 16, 22, 28]) for (const font of ["jakarta", "playfair"]) {
  test(`righe ${spacing}/${size}/${font}`, async ({ page }) => {
    await installTauriMock(page);
    await page.goto(`/?spacing=${spacing}&size=${size}&font=${font}`);
    await page.getByRole("button", { name: /Progetti/ }).first().click();
    await expect(page.locator(".note-prose")).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await expect.poll(() => page.evaluate(() => (window as any).__checkRuledLines?.())).toEqual([]);
    if (spacing === 1 && size === 12 && font === "jakarta") {
      const regression = await page.evaluate(() => {
        const heading = document.querySelector<HTMLElement>(".note-prose h1")!;
        heading.style.top = "0px";
        const errors = (window as any).__checkRuledLines();
        heading.style.removeProperty("top");
        return errors;
      });
      expect(regression.some((error: { block: string }) => error.block === "h1")).toBe(true);
      await expect(page.locator(".ruled-line-overlay")).toHaveCount(0);
    }
  });
}

for (const [spacing, size] of [[1, 12], [1, 28], [2, 16], [5, 12], [5, 28]]) test(`righe della nota con formattazione e blocchi complessi ${spacing}/${size}`, async ({ page }) => {
  await installTauriMock(page);
  await page.setViewportSize({ width: 1024, height: 640 });
  await page.goto(`/?real&spacing=${spacing}&size=${size}&font=jakarta`);
  await page.locator(".folder-main").click();
  await expect(page.locator(".note-prose")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await expect.poll(() => page.evaluate(() => (window as any).__checkRuledLines?.())).toEqual([]);
});

test("overlay delle righe solo con debugLines", async ({ page }) => {
  await installTauriMock(page);
  await page.goto("/?debugLines&spacing=1&size=12");
  await page.locator(".folder-main").click();
  await page.evaluate(() => document.fonts.ready);
  await expect.poll(() => page.locator(".paper").evaluate((paper) => getComputedStyle(paper).getPropertyValue("--shift-h1").trim())).not.toBe("0px");
  await expect.poll(() => page.evaluate(() => (window as any).__checkRuledLines?.())).toEqual([]);
  const errors = await page.evaluate(() => {
    const heading = document.querySelector<HTMLElement>(".note-prose h1")!;
    heading.style.top = "0px";
    return (window as any).__checkRuledLines();
  });
  expect(errors.length).toBeGreaterThan(0);
  await expect(page.locator(".ruled-line-overlay span")).not.toHaveCount(0);
});
