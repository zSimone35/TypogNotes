import { expect, test } from "@playwright/test";
import { installTauriMock } from "./tauri-mock";

const errors: string[] = [];
test.beforeEach(async ({ page }) => { errors.length = 0; page.on("pageerror", error => errors.push(error.message)); await installTauriMock(page); });
test.afterEach(() => { expect(errors).toEqual([]); });

test("palette completa, personalizzati e fogli", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 900 });
  await page.goto("/"); await page.locator(".folder-main").click();
  await page.locator(".note-prose > p").first().click(); await page.keyboard.press("Control+a");
  await page.getByRole("button", { name: "Colore testo", exact: true }).click();
  const menu = page.getByRole("menu", { name: "Colore testo", exact: true });
  await expect(menu.locator(".color-swatch")).toHaveCount(80);
  await expect(menu.getByText("PERSONALIZZATI")).toBeVisible();
  await menu.locator('[data-color="#1155cc"]').click();
  await expect.poll(() => page.evaluate(() => JSON.stringify((window as any).__mockCalls.filter((c: any) => c.command === "save_note").at(-1)))).toContain("#1155cc");
  await page.getByRole("button", { name: "Colore testo", exact: true }).click();
  await menu.locator('input[type="color"]').evaluate((input: HTMLInputElement) => { input.value = "#123456"; input.dispatchEvent(new Event("change", { bubbles: true })); });
  await expect.poll(() => page.evaluate(() => (window as any).__mockCalls.filter((c: any) => c.command === "update_settings").at(-1)?.args.input.customColors)).toEqual(["#123456"]);
  await page.getByRole("button", { name: "Colore del foglio" }).click();
  await expect(page.getByRole("menu", { name: "Colore del foglio" }).getByRole("menuitemradio")).toHaveCount(16);
});

test("il menu contestuale mostra solo gli ultimi 5 colori usati", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 900 });
  await page.goto("/"); await page.locator(".folder-main").click();
  await page.locator(".note-prose > p").first().click(); await page.keyboard.press("Control+a");
  await page.getByRole("button", { name: "Colore testo", exact: true }).click();
  await page.getByRole("menu", { name: "Colore testo", exact: true }).locator('[data-color="#9900ff"]').click();
  await page.locator(".note-prose > p").first().click({ button: "right" });
  const recent = page.getByRole("group", { name: "Colore testo: ultimi colori usati" });
  await expect(recent.locator("[data-color]")).toHaveCount(5);
  await expect(recent.locator("[data-color]").first()).toHaveAttribute("data-color", "#9900ff");
  await expect(page.locator(".editor-context-menu .color-swatch")).toHaveCount(0);
  await page.getByRole("group", { name: "Evidenziatore: ultimi colori usati" }).locator('[data-color="#9fc5e8"]').click();
  await expect.poll(() => page.evaluate(() => JSON.stringify((window as any).__mockCalls.filter((c: any) => c.command === "save_note").at(-1)))).toContain("#9fc5e8");
});

test("menu nel viewport e ortografia esclusa dal codice", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 640 });
  await page.goto("/?typos"); await page.locator(".folder-main").click();
  await expect(page.locator(".spelling-error")).toHaveCount(2);
  await expect(page.locator(".code-block .spelling-error, code .spelling-error")).toHaveCount(0);
  await page.locator(".note-prose > p").first().click(); await page.keyboard.press("Control+a");
  await page.locator(".note-prose > p").first().click({ button: "right" });
  const menu = page.locator(".editor-context-menu");
  await expect(menu).toBeVisible();
  const bounds = await menu.boundingBox();
  expect(bounds!.y).toBeGreaterThanOrEqual(0); expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(640);
  // A window shorter than the menu: it stays inside and scrolls.
  await page.setViewportSize({ width: 1024, height: 360 });
  await expect.poll(() => menu.evaluate(el => el.scrollHeight > el.clientHeight && el.getBoundingClientRect().bottom <= 360)).toBe(true);
  await menu.getByRole("button", { name: "Ignora 2 correzioni nella selezione" }).click();
  await expect(page.locator(".spelling-error")).toHaveCount(0);
});

test("spessore divisore dal pulsante e dalla linea", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 900 });
  await page.goto("/"); await page.locator(".folder-main").click();
  await page.locator(".note-prose > p").first().click();
  await page.getByRole("button", { name: "Inserisci divisore" }).click({ button: "right" });
  await page.getByRole("menuitemradio", { name: "4 px", exact: true }).click();
  const line = page.locator('hr[data-thickness="4"]'); await expect(line).toBeVisible();
  await line.click({ button: "right" });
  await page.getByRole("menuitemradio", { name: "8 px", exact: true }).click();
  await expect(page.locator('hr[data-thickness="8"]')).toHaveCount(1);
});

test("forme Pixel valide e override per nota o globale", async ({ page }) => {
  await page.goto("/?shapes");
  await expect(page.locator(".shape-gallery [data-shape]")).toHaveCount(5);
  expect(await page.locator("clipPath path").evaluateAll(paths => paths.every(p => {
    new Path2D(p.getAttribute("d")!);
    const b = (p as SVGGraphicsElement).getBBox();
    return b.width > 0 && b.height > 0 && b.x >= -.001 && b.y >= -.001 && b.x + b.width <= 1.001 && b.y + b.height <= 1.001;
  }))).toBe(true);
  await page.setViewportSize({ width: 1920, height: 900 });
  await page.goto("/"); await page.locator(".folder-main").click();
  // Only the checkbox shape is configurable: the bullet list has no shape menu any more.
  await page.getByRole("button", { name: "Lista puntata", exact: true }).click({ button: "right" });
  await expect(page.getByRole("menu", { name: "Forma checkbox" })).toBeHidden();
  await page.getByRole("button", { name: "Checklist", exact: true }).click({ button: "right" });
  await page.getByRole("menuitemradio", { name: "Biscotto 7", exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__mockCalls.filter((c: any) => c.command === "save_note").at(-1)?.args.input.checkboxShape)).toBe("cookie7Sided");
  await page.getByRole("button", { name: "Checklist", exact: true }).click({ button: "right" });
  await page.getByRole("button", { name: "Tutte le note", exact: true }).click();
  await page.getByRole("menuitemradio", { name: "Arco", exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__mockCalls.filter((c: any) => c.command === "update_settings").at(-1)?.args.input.checkboxShape)).toBe("arch");
});

test("incolla immagine e cinque disposizioni senza spostare il rigato", async ({ page }) => {
  await page.goto("/"); await page.locator(".folder-main").click();
  await page.locator(".note-prose > p").first().click();
  await page.evaluate(() => {
    const bytes = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0r8AAAAASUVORK5CYII="), c => c.charCodeAt(0));
    const data = new DataTransfer(); data.items.add(new File([bytes], "test.png", { type: "image/png" }));
    document.querySelector(".note-prose")!.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
  });
  const image = page.locator(".note-image img"); await expect(image).toBeVisible();
  await image.click();
  await expect(page.getByRole("button", { name: "Ridimensiona immagine" })).toBeVisible();
  for (let i = 0; i < 8; i++) await page.getByRole("button", { name: "Ridimensiona immagine" }).press("ArrowRight");
  await expect.poll(() => image.evaluate(el => el.getBoundingClientRect().width)).toBeGreaterThan(140);
  await expect.poll(() => page.evaluate(() => (window as any).__mockCalls.filter((c: any) => c.command === "add_attachment").length)).toBe(1);
  for (const [wrap, label] of [["square", "Testo a capo"], ["break", "Interrompi testo"], ["front", "Davanti al testo"], ["behind", "Dietro al testo"], ["inline", "In linea"]]) {
    await image.dispatchEvent("contextmenu", { bubbles: true });
    await page.getByRole("menuitemradio", { name: label, exact: true }).click();
    await expect(page.locator(`.note-image.wrap-${wrap}`)).toHaveCount(1);
    await expect.poll(() => page.evaluate(() => (window as any).__checkRuledLines())).toEqual([]);
  }
  await image.dispatchEvent("contextmenu", { bubbles: true });
  await page.getByRole("menu", { name: "Disposizione immagine" }).getByRole("button", { name: "Elimina", exact: true }).click();
  await expect(image).toHaveCount(0);
  await page.locator(".note-prose").press("Control+z");
  await expect(image).toBeVisible();
});

test("copia allegato da un'altra nota e attende l'upload prima di cambiare nota", async ({ page }) => {
  await page.goto("/"); await page.locator(".folder-main").click();
  await page.locator(".note-prose > p").first().click();
  await page.evaluate(() => {
    (window as any).__attachmentDelay = 500;
    const data = new DataTransfer(); data.setData("text/html", '<p><img data-attachment-id="999" data-width="160"></p>');
    document.querySelector(".note-prose")!.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
  });
  await expect.poll(() => page.evaluate(() => (window as any).__mockCalls.some((c: any) => c.command === "copy_attachment" && c.args.input.id === 999))).toBe(true);
  await expect.poll(() => page.evaluate(() => JSON.stringify((window as any).__mockCalls.filter((c: any) => c.command === "save_note").at(-1)?.args.input.content))).toContain("attachmentId");
  expect(await page.evaluate(() => JSON.stringify((window as any).__mockCalls.filter((c: any) => c.command === "save_note").at(-1)?.args.input.content))).not.toContain("999");
  await page.evaluate(() => {
    const data = new DataTransfer(); data.items.add(new File([new Uint8Array([137,80,78,71])], "upload.png", { type: "image/png" }));
    document.querySelector(".note-prose")!.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
  });
  await page.locator(".note-card-main", { hasText: "Seconda nota" }).click();
  await expect(page.getByRole("textbox", { name: "Titolo della nota", exact: true })).toHaveValue("Seconda nota");
  expect(await page.evaluate(() => JSON.stringify((window as any).__mockCalls.filter((c: any) => c.command === "save_note" && c.args.input.id === 1).at(-1)?.args.input.content))).toContain("upload.png");
});

test("immagine archiviata visibile senza azioni di modifica", async ({ page }) => {
  await page.goto("/?archivedImage");
  await page.locator(".sidebar").getByRole("button", { name: /Archivio/ }).click();
  await page.locator(".dashboard-note-open").click();
  const image = page.locator(".note-image img"); await expect(image).toBeVisible();
  await image.click({ button: "right" });
  await expect(page.getByRole("menu", { name: "Disposizione immagine" })).toBeHidden();
  await expect(page.getByRole("button", { name: "Ridimensiona immagine" })).toHaveCount(0);
});

const lastSave = (page: import("@playwright/test").Page) => page.evaluate(() => (window as any).__mockCalls.filter((c: any) => c.command === "save_note").at(-1)?.args.input);

test("i titoli piegano la sezione sotto e lo stato viene salvato", async ({ page }) => {
  await page.goto("/"); await page.locator(".folder-main").click();
  const h2 = page.locator(".note-prose h2").first();
  await expect(page.locator(".note-prose h3 .heading-fold")).toHaveCount(1);
  await h2.getByRole("button", { name: "Nascondi la sezione" }).click();
  await expect(page.locator(".note-prose h3")).toBeHidden();
  await expect(page.locator(".note-prose ul").first()).toBeHidden();
  await expect(page.locator(".note-prose h1")).toBeVisible();
  await expect.poll(async () => JSON.stringify((await lastSave(page))?.content)).toContain('"collapsed":true');
  expect(await page.evaluate(() => (window as any).__checkRuledLines())).toEqual([]);
  await h2.getByRole("button", { name: "Mostra la sezione" }).click();
  await expect(page.locator(".note-prose h3")).toBeVisible();
});

test("menu immagine e menu colore del foglio leggibili, senza barre di scorrimento", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto("/"); await page.locator(".folder-main").click();
  await page.getByRole("button", { name: "Colore del foglio" }).click();
  const paper = page.getByRole("menu", { name: "Colore del foglio" });
  await expect(paper.getByRole("menuitemradio")).toHaveCount(16);
  expect(await paper.evaluate(el => el.scrollWidth <= el.clientWidth && el.scrollHeight <= el.clientHeight)).toBe(true);
  await page.keyboard.press("Escape");
  await page.locator(".note-prose > p").first().click();
  await page.evaluate(() => {
    const bytes = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0r8AAAAASUVORK5CYII="), c => c.charCodeAt(0));
    const data = new DataTransfer(); data.items.add(new File([bytes], "test.png", { type: "image/png" }));
    document.querySelector(".note-prose")!.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
  });
  await page.locator(".note-image img").click({ button: "right" });
  const menu = page.getByRole("menu", { name: "Disposizione immagine" });
  await expect(menu.getByRole("menuitemradio")).toHaveCount(5);
  expect((await menu.boundingBox())!.width).toBeGreaterThan(200);
  for (const item of await menu.getByRole("menuitemradio").all()) expect((await item.boundingBox())!.height).toBeLessThan(56);
  await expect(menu.getByRole("menuitemradio", { name: "In linea" })).toHaveAttribute("aria-checked", "true");
});

test("colori recenti per nota, niente barra in basso ed errori di salvataggio nel banner", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 900 });
  await page.goto("/"); await page.locator(".folder-main").click();
  await expect(page.locator(".status-bar")).toHaveCount(0);
  await page.locator(".note-prose > p").first().click(); await page.keyboard.press("Control+a");
  await page.getByRole("button", { name: "Colore testo", exact: true }).click();
  await page.getByRole("menu", { name: "Colore testo", exact: true }).locator('.color-grid-swatches [data-color="#38761d"]').click();
  await page.getByRole("button", { name: "Colore testo", exact: true }).click();
  await expect(page.getByRole("group", { name: "Colore testo: recenti in questa nota" }).locator("[data-color]").first()).toHaveAttribute("data-color", "#38761d");
  await page.keyboard.press("Escape");
  await page.locator(".note-card-main", { hasText: "Seconda nota" }).click();
  await expect(page.getByRole("textbox", { name: "Titolo della nota", exact: true })).toHaveValue("Seconda nota");
  await page.getByRole("button", { name: "Colore testo", exact: true }).click();
  await expect(page.getByRole("group", { name: "Colore testo: recenti in questa nota" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.evaluate(() => { (window as any).__rejectSave = true; });
  await page.locator(".note-prose > p").first().click(); await page.keyboard.type("x");
  await expect(page.getByRole("alert")).toContainText("Salvataggio non riuscito: disco pieno");
});
