import { expect, test } from "@playwright/test";
import { installTauriMock } from "./tauri-mock";

test.beforeEach(async ({ page }) => {
  await installTauriMock(page);
  await page.goto("/");
  await expect(page.locator(".folder-main")).toBeVisible();
});

test("la cartella apre la Scrivania da ogni vista", async ({ page }) => {
  for (const view of ["Bacheca", "Archivio", "Cestino"]) {
    if (view !== "Bacheca") await page.getByRole("button", { name: new RegExp(view) }).first().click();
    await page.locator(".folder-main").click();
    await expect(page.locator(".view-tab.is-active")).toContainText("Scrivania");
    await expect(page.getByRole("textbox", { name: "Titolo della nota", exact: true })).toHaveValue("Nota di prova");
  }
});

test("trascinamento della card invia il nuovo ordine", async ({ page }) => {
  await page.locator(".folder-main").click();
  await expect(page.locator(".note-card")).toHaveCount(2);
  await page.locator(".note-card").first().dragTo(page.locator(".note-card").last());
  await expect.poll(() => page.evaluate(() => (window as any).__mockCalls.filter((call: any) => call.command === "reorder_notes").at(-1)?.args.input.noteIds)).toEqual([2, 1]);
});

test("tema scuro e colori restano visibili", async ({ page }) => {
  await page.getByRole("button", { name: /Impostazioni/ }).click();
  await page.getByRole("button", { name: "Tema scuro" }).click();
  await page.getByRole("button", { name: "Salva impostazioni" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.waitForTimeout(200);
  const colors = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    return { sidebar: style.getPropertyValue("--sidebar").trim(), center: style.getPropertyValue("--muted").trim(), note: getComputedStyle(document.querySelector(".dashboard-note-card")!).backgroundColor };
  });
  expect(colors.sidebar).not.toBe(colors.center);
  expect(colors.note).not.toBe("rgba(0, 0, 0, 0)");
  const contrast = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    const rgb = (value: string) => value.match(/[\da-f]{2}/gi)!.slice(0, 3).map((part) => parseInt(part, 16) / 255).map((channel) => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4);
    const luminance = (value: string) => rgb(value).reduce((sum, channel, index) => sum + channel * [.2126, .7152, .0722][index]!, 0);
    const ratio = (front: string, back: string) => { const a = luminance(style.getPropertyValue(front).trim()); const b = luminance(style.getPropertyValue(back).trim()); return (Math.max(a, b) + .05) / (Math.min(a, b) + .05); };
    if (style.getPropertyValue("--background").trim() !== "#000000") throw new Error("Sfondo non nero");
    if (ratio("--paper-border", "--background") < 3) throw new Error("Bordo poco visibile");
    return [...["cream", "warm-white", "peach", "sage", "sky", "lavender", "lemon", "mint", "teal", "ocean", "lilac", "rose", "coral", "sand", "stone", "slate"].map((color) => ratio("--foreground", `--paper-${color}`)), ratio("--foreground", "--background"), ratio("--foreground", "--card"), ratio("--muted-foreground", "--card"), ratio("--primary-foreground", "--primary")];
  });
  expect(Math.min(...contrast)).toBeGreaterThanOrEqual(4.5);
  const cardContrast = await page.evaluate(() => {
    const card = document.querySelector<HTMLElement>(".dashboard-note-card")!;
    const title = card.querySelector<HTMLElement>("h3")!;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d")!;
    const light = (color: string) => {
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      const channels = [...context.getImageData(0, 0, 1, 1).data].slice(0, 3).map((value) => value / 255).map((value) => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
      return channels.reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index]!, 0);
    };
    const foreground = light(getComputedStyle(title).color);
    const background = light(getComputedStyle(card).backgroundColor);
    return (Math.max(foreground, background) + .05) / (Math.min(foreground, background) + .05);
  });
  expect(cardContrast).toBeGreaterThanOrEqual(4.5);
});

test("evidenziazioni e colori del testo sono leggibili nel tema scuro", async ({ page }) => {
  await page.goto("/?colors");
  await page.getByRole("button", { name: /Impostazioni/ }).click();
  await page.getByRole("button", { name: "Tema scuro" }).click();
  await page.getByRole("button", { name: "Salva impostazioni" }).click();
  await page.locator(".folder-main").click();
  await expect(page.locator(".note-prose mark")).toHaveCount(11);
  await expect(page.locator('.note-prose span[style*="color:"]')).toHaveCount(6);
  const ratios = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d")!;
    const luminance = (color: string) => {
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      const channels = [...context.getImageData(0, 0, 1, 1).data].slice(0, 3).map((value) => value / 255).map((value) => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
      return channels.reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index]!, 0);
    };
    const paper = getComputedStyle(document.querySelector(".paper")!).backgroundColor;
    return [...document.querySelectorAll<HTMLElement>(".note-prose mark, .note-prose span[style*='color:']")].map((element) => {
      const style = getComputedStyle(element);
      const foreground = luminance(style.color);
      const background = luminance(element.tagName === "MARK" ? style.backgroundColor : paper);
      return { text: element.textContent, style: element.getAttribute("style"), ratio: (Math.max(foreground, background) + .05) / (Math.min(foreground, background) + .05) };
    });
  });
  expect(Math.min(...ratios.map(({ ratio }) => ratio)), JSON.stringify(ratios)).toBeGreaterThanOrEqual(4.5);
  expect(await page.locator(".note-prose mark").first().getAttribute("data-color")).toBe("#f5d98f");
});

test("il menu contestuale copia e deseleziona il testo selezionato", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.locator(".folder-main").click();
  const paragraph = page.locator(".note-prose > p").first();
  await paragraph.click();
  await page.keyboard.press("Control+Home");
  await page.keyboard.press("Control+Shift+ArrowRight");
  await page.keyboard.press("Control+Shift+ArrowRight");
  const selected = await page.evaluate(() => getSelection()?.toString() ?? "");
  expect(selected.trim().split(/\s+/).length).toBeGreaterThan(1);
  await paragraph.click({ button: "right", position: { x: 20, y: 12 } });
  await page.getByRole("button", { name: "Copia", exact: true }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(selected);
  await paragraph.click({ button: "right", position: { x: 20, y: 12 } });
  await page.getByRole("button", { name: "Deseleziona" }).click();
  expect(await page.evaluate(() => getSelection()?.toString())).toBe("");
  await paragraph.click();
  await page.keyboard.press("Control+Home");
  await page.keyboard.press("Control+Shift+ArrowRight");
  await page.keyboard.press("Control+Shift+ArrowRight");
  const cutText = await page.evaluate(() => getSelection()?.toString() ?? "");
  const beforeCut = await paragraph.textContent();
  await paragraph.click({ button: "right", position: { x: 20, y: 12 } });
  await page.getByRole("button", { name: "Taglia" }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(cutText);
  expect((await paragraph.textContent())?.length).toBe(beforeCut!.length - cutText.length);
});


test("il resize decimale e tutti i numeri delle impostazioni arrivano interi al backend", async ({ page }) => {
  await page.locator(".folder-main").click();
  const handle = page.locator(".sidebar-resizer");
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + 1, box.y + 20);
  await page.mouse.down();
  await page.evaluate((x) => window.dispatchEvent(new PointerEvent("pointermove", { clientX: x + .4 })), box.x + 1);
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => (window as any).__mockCalls.filter((c: any) => c.command === "update_settings").at(-1)?.args.input.sidebarWidth)).toBe(260);
  await page.evaluate(async () => {
    const { api } = await import("/src/api/commands.ts");
    await api.updateSettings({ sidebarWidth: 292.79998779296875, editorFontSize: 16.4, toolbarToolsWidth: 104.6, lastNoteId: null });
  });
  const input = await page.evaluate(() => (window as any).__mockCalls.filter((c: any) => c.command === "update_settings").at(-1).args.input);
  expect(input).toEqual({ sidebarWidth: 293, editorFontSize: 16, toolbarToolsWidth: 105, lastNoteId: null });
});

test("l'errore di salvataggio è visibile nel dialogo e si può chiudere", async ({ page }) => {
  await page.evaluate(() => { (window as any).__rejectSettings = true; });
  for (const close of ["Annulla", "Chiudi impostazioni"]) {
    await page.getByRole("button", { name: /Impostazioni/ }).click();
    await page.getByRole("button", { name: "Salva impostazioni" }).click();
    await expect(page.getByRole("dialog").getByRole("alert")).toContainText("Impossibile salvare");
    await page.getByRole("button", { name: close, exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
});

test("la nota conserva lo scroll passando a un'altra nota", async ({ page }) => {
  await page.locator(".folder-main").click();
  await page.evaluate(() => document.fonts.ready);
  await page.locator(".paper-scroll").evaluate((el) => { el.scrollTop = 450; });
  await expect.poll(() => page.locator(".paper-scroll").evaluate((el) => el.scrollTop)).toBe(450);
  await page.locator(".note-card").filter({ hasText: "Seconda nota" }).click();
  await expect(page.getByRole("textbox", { name: "Titolo della nota", exact: true })).toHaveValue("Seconda nota");
  await page.locator(".note-card").filter({ hasText: "Nota di prova" }).click();
  await expect(page.getByRole("textbox", { name: "Titolo della nota", exact: true })).toHaveValue("Nota di prova");
  await expect.poll(() => page.locator(".paper-scroll").evaluate((el) => el.scrollTop)).toBe(450);
});

test("Spazio e Invio selezionano il primo risultato e lo rendono visibile", async ({ page }) => {
  await page.locator(".folder-main").click();
  await page.keyboard.press("Control+f");
  for (const key of ["Space", "Enter"]) {
    await page.getByRole("textbox", { name: "Testo da trovare" }).fill("normale");
    await page.getByRole("textbox", { name: "Testo da trovare" }).press(key);
    await expect.poll(() => page.evaluate(() => getSelection()?.toString())).toBe("normale");
    await expect(page.locator(".find-and-replace-result-current")).toBeInViewport();
  }
});

test("il menu del blocco salva il colore e permette taglio e annullamento", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.locator(".folder-main").click();
  await page.locator(".collapsible-header").click({ button: "right" });
  const menu = page.getByRole("menu", { name: "Azioni blocco a scomparsa" });
  await expect(menu).toBeVisible();
  await menu.getByText("Cambia colore", { exact: true }).click();
  await menu.getByRole("button", { name: "Giallo", exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__mockCalls.filter((c: any) => c.command === "save_note").at(-1)?.args.input.content.content.find((n: any) => n.type === "collapsibleBlock")?.attrs.color)).toBe("#f5d98f");
  await page.locator(".collapsible-header").click({ button: "right" });
  await menu.getByRole("menuitem", { name: "Taglia" }).click();
  await expect(page.locator(".collapsible-header")).toHaveCount(0);
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("Testo nella sezione comprimibile");
  const html = await page.evaluate(async () => {
    const [item] = await navigator.clipboard.read();
    return (await item.getType("text/html")).text();
  });
  expect(html).toContain('color="#f5d98f"');
  expect(html).toContain('data-collapsible-block');
  await page.keyboard.press("Control+z");
  await expect(page.locator(".collapsible-header")).toHaveCount(1);
  await page.locator(".collapsible-header").click({ button: "right" });
  await menu.getByRole("menuitem", { name: "Elimina" }).click();
  await expect(page.locator(".collapsible-header")).toHaveCount(0);
});

test("il menu Esporta indica il formato predefinito ed esporta HTML", async ({ page }) => {
  await page.locator(".folder-main").click();
  const noteTab = page.getByRole("button", { name: "Nota", exact: true });
  if (await noteTab.isVisible()) await noteTab.click();
  await page.getByRole("button", { name: "Esporta nota" }).click();
  await expect(page.getByRole("menuitem", { name: /Markdown.*predefinito/ })).toBeVisible();
  await page.getByRole("menuitem", { name: "HTML", exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__mockCalls.find((c: any) => c.command === "export_note")?.args.input)).toEqual({ id: 1, format: "html" });
});


test("un errore degli appunti non elimina il blocco", async ({ page }) => {
  await page.locator(".folder-main").click();
  await page.evaluate(() => { navigator.clipboard.write = async () => { throw new Error("Accesso negato"); }; });
  await page.locator(".collapsible-header").click({ button: "right" });
  const menu = page.getByRole("menu", { name: "Azioni blocco a scomparsa" });
  await menu.getByRole("menuitem", { name: "Taglia" }).click();
  await expect(menu.getByRole("alert")).toContainText("Accesso negato");
  await expect(page.locator(".collapsible-header")).toHaveCount(1);
});
