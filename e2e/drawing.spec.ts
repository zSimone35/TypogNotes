import { expect, test, type Page } from "@playwright/test";
import { installTauriMock } from "./tauri-mock";

const lastSaved = (page: Page) => page.evaluate(() => (window as any).__mockCalls.filter((c: any) => c.command === "save_note").at(-1)?.args.input.content);

async function stroke(page: Page, from: [number, number], to: [number, number]) {
  const box = (await page.locator(".drawing-input").boundingBox())!;
  await page.mouse.move(box.x + from[0], box.y + from[1]);
  await page.mouse.down();
  await page.mouse.move(box.x + to[0], box.y + to[1], { steps: 12 });
  await page.mouse.up();
}

test("note disegno: penna, evidenziatore, gomma, annulla e salvataggio", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await installTauriMock(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByRole("button", { name: "Nuova nota disegno" }).click();
  await expect(page.getByRole("toolbar", { name: "Strumenti di disegno" })).toBeVisible();
  const canvas = page.locator(".drawing-input");

  await stroke(page, [60, 60], [300, 140]);
  await expect(canvas).toHaveAttribute("aria-label", "Disegno: 1 tratti");
  // The finished stroke is painted on the base canvas, halfway along the line.
  const painted = await page.locator(".drawing-canvas").first().evaluate((element: HTMLCanvasElement) => {
    const ratio = element.width / element.clientWidth;
    const area = element.getContext("2d")!.getImageData(Math.round(172 * ratio), Math.round(92 * ratio), Math.round(16 * ratio), Math.round(16 * ratio)).data;
    return Math.max(...area.filter((_, index) => index % 4 === 3));
  });
  expect(painted).toBeGreaterThan(0);
  await expect.poll(async () => (await lastSaved(page))?.strokes?.length).toBe(1);

  await page.getByRole("button", { name: "Evidenziatore" }).click();
  await stroke(page, [60, 260], [400, 260]);
  await expect(canvas).toHaveAttribute("aria-label", "Disegno: 2 tratti");

  await page.getByRole("button", { name: "Gomma" }).click();
  await stroke(page, [180, 40], [180, 160]);
  await expect(canvas).toHaveAttribute("aria-label", "Disegno: 1 tratti");
  await expect.poll(async () => (await lastSaved(page))?.strokes?.map((item: any) => item.tool)).toEqual(["highlighter"]);

  await page.keyboard.press("Control+z");
  await expect(canvas).toHaveAttribute("aria-label", "Disegno: 2 tratti");
  await page.keyboard.press("Control+y");
  await expect(canvas).toHaveAttribute("aria-label", "Disegno: 1 tratti");

  // A pen with pressure: points keep the real pressure.
  await page.getByRole("button", { name: "Penna" }).click();
  await canvas.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const fire = (type: string, x: number, pressure: number) => element.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 7, pointerType: "pen", isPrimary: true, button: 0, buttons: type === "pointerup" ? 0 : 1, pressure, clientX: rect.left + x, clientY: rect.top + 400 }));
    fire("pointerdown", 80, 0.2);
    for (let step = 1; step <= 8; step += 1) fire("pointermove", 80 + step * 30, 0.2 + step * 0.08);
    fire("pointerup", 320, 0);
  });
  await expect(canvas).toHaveAttribute("aria-label", "Disegno: 2 tratti");
  await expect.poll(async () => {
    const pressures = (await lastSaved(page))?.strokes?.at(-1)?.points?.map((point: number[]) => point[2]) ?? [];
    return pressures.length > 2 && Math.max(...pressures) > 0.7 && Math.min(...pressures) < 0.3;
  }).toBe(true);

  await page.getByRole("button", { name: "Foglio a quadretti" }).click();
  await expect(page.locator(".drawing-page")).toHaveClass(/bg-grid/);
  await expect.poll(async () => (await lastSaved(page))?.background).toBe("grid");
  await page.screenshot({ path: "test-results/drawing-light.png" });
  expect(errors).toEqual([]);
});

test("note disegno: la toolbar resta al massimo su due righe", async ({ page }) => {
  await installTauriMock(page);
  for (const width of [1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/");
    await page.getByRole("button", { name: "Nuova nota disegno" }).click();
    await expect(page.locator(".drawing-input")).toBeVisible();
    expect((await page.locator(".ribbon-strip").boundingBox())!.height, `${width}px`).toBeLessThanOrEqual(90);
  }
});
