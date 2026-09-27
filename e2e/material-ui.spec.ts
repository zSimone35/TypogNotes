import { expect, test, type Page } from "@playwright/test";
import { installTauriMock } from "./tauri-mock";

const errors: string[] = [];

test.beforeEach(async ({ page }) => {
  errors.length = 0;
  page.on("pageerror", (error) => errors.push(error.message));
  await installTauriMock(page);
});

test.afterEach(() => {
  expect(errors, "errori JavaScript durante il test").toEqual([]);
});

const calls = (page: Page, command: string) =>
  page.evaluate((name) => (window as any).__mockCalls.filter((call: any) => call.command === name).map((call: any) => call.args), command);

async function openApp(page: Page, query = "") {
  await page.goto(`/${query}`);
  await expect(page.locator(".folder-main").first()).toBeVisible();
}

async function openEditor(page: Page) {
  await page.locator(".folder-main").first().click();
  await expect(page.locator(".ribbon-strip")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

/** Every visible ribbon group: controls stay inside it, never overlap, never cut their text. */
async function toolbarProblems(page: Page): Promise<string[]> {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  return page.evaluate(() => {
    const problems: string[] = [];
    const toolbar = document.querySelector<HTMLElement>(".editor-toolbar")!;
    const toolbarRect = toolbar.getBoundingClientRect();
    if (toolbar.scrollWidth > toolbar.clientWidth + 1) problems.push(`scroll orizzontale nella toolbar: ${toolbar.scrollWidth} > ${toolbar.clientWidth}`);
    const inside = (inner: DOMRect, outer: DOMRect) => inner.left >= outer.left - 1 && inner.right <= outer.right + 1 && inner.top >= outer.top - 1 && inner.bottom <= outer.bottom + 1;
    const visible = (element: Element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
    };
    const name = (element: Element) => element.getAttribute("aria-label") ?? (element.textContent?.trim().slice(0, 30) || element.className);
    const context = document.createElement("canvas").getContext("2d")!;
    for (const group of [...toolbar.querySelectorAll<HTMLElement>(".ribbon-group")].filter(visible)) {
      const label = group.getAttribute("aria-label");
      const groupRect = group.getBoundingClientRect();
      if (!inside(groupRect, toolbarRect)) problems.push(`${label}: il gruppo esce dalla toolbar`);
      const controls = [...group.querySelectorAll<HTMLElement>("button, select, .toolbar-field-label, .ribbon-label")]
        .filter((element) => !element.closest("[popover]") && visible(element));
      for (const control of controls) {
        if (!inside(control.getBoundingClientRect(), groupRect)) problems.push(`${label}: "${name(control)}" esce dal gruppo`);
        if (control instanceof HTMLSelectElement) {
          const style = getComputedStyle(control);
          context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
          const longest = Math.max(...[...control.options].map((option) => context.measureText(option.text).width));
          const room = control.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
          if (room + 1 < longest) problems.push(`${label}: "${name(control)}" taglia l'opzione più lunga (${Math.round(room)}px < ${Math.round(longest)}px)`);
        } else if (control.scrollWidth > control.clientWidth + 1) {
          problems.push(`${label}: "${name(control)}" ha il testo tagliato`);
        }
      }
      for (let i = 0; i < controls.length; i += 1) for (let j = i + 1; j < controls.length; j += 1) {
        const a = controls[i]!;
        const b = controls[j]!;
        if (a.contains(b) || b.contains(a)) continue;
        const ra = a.getBoundingClientRect();
        const rb = b.getBoundingClientRect();
        const width = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
        const height = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
        if (width > 1 && height > 1) problems.push(`${label}: "${name(a)}" si sovrappone a "${name(b)}"`);
      }
    }
    return problems;
  });
}

/** Checks the full ribbon, or every tab of the compact one. */
async function checkRibbon(page: Page, setup: string) {
  // The sidebar animates its width for 250ms: measure once the layout has settled.
  await page.waitForTimeout(400);
  const layout = await page.locator(".ribbon-strip").getAttribute("data-layout");
  const problems: string[] = [];
  if (layout === "compact") {
    for (const tab of await page.locator(".ribbon-tabs button").all()) {
      await tab.click();
      problems.push(...(await toolbarProblems(page)).map((problem) => `[${tab}] ${problem}`));
    }
  } else {
    problems.push(...await toolbarProblems(page));
  }
  expect(problems, `${setup} (${layout})`).toEqual([]);
}

for (const width of [1024, 1152, 1280, 1366, 1440, 1600, 1920]) {
  for (const query of ["", "?wideToolbar"]) {
    test(`toolbar senza elementi compressi o sovrapposti a ${width}px${query ? " con sezioni allargate" : ""}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await openApp(page, query);
      await openEditor(page);
      await checkRibbon(page, "barra laterale normale");

      await page.keyboard.press("Control+f");
      await expect(page.getByRole("search", { name: "Trova e sostituisci" })).toBeVisible();
      await checkRibbon(page, "con Trova aperto");
      await page.keyboard.press("Escape");

      const resizer = page.locator(".sidebar-resizer");
      await resizer.focus();
      for (let step = 0; step < 9; step += 1) await resizer.press("ArrowRight");
      await checkRibbon(page, "barra laterale larga");

      await page.getByRole("button", { name: "Comprimi la barra laterale" }).click();
      await expect(page.locator(".sidebar.is-rail")).toBeVisible();
      await checkRibbon(page, "rail");

      await page.getByRole("button", { name: /Modalità focus/ }).click();
      await expect(page.locator(".sidebar")).toHaveCount(0);
      await checkRibbon(page, "modalità focus");
    });
  }
}

test("il nastro passa alle schede solo quando i gruppi non entrano", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 900 });
  await openApp(page);
  await openEditor(page);
  await expect(page.locator(".ribbon-strip")).toHaveAttribute("data-layout", "full");
  await expect(page.locator(".ribbon-tabs")).toBeHidden();
  await page.setViewportSize({ width: 1024, height: 900 });
  await expect(page.locator(".ribbon-strip")).toHaveAttribute("data-layout", "compact");
  await expect(page.locator(".ribbon-tabs")).toBeVisible();
  await page.setViewportSize({ width: 1920, height: 900 });
  await expect(page.locator(".ribbon-strip")).toHaveAttribute("data-layout", "full");
});

test("barra superiore: rail, modalità focus, schede e tema", async ({ page }) => {
  await openApp(page);
  await page.getByRole("button", { name: "Comprimi la barra laterale" }).click();
  await expect.poll(() => page.locator(".sidebar").evaluate((element) => Math.round(element.getBoundingClientRect().width))).toBe(80);
  await expect(page.locator(".sidebar .rail-badge").first()).toBeVisible();
  await page.getByRole("button", { name: "Espandi la barra laterale" }).click();
  await expect(page.locator(".sidebar.is-rail")).toHaveCount(0);

  await page.getByRole("button", { name: /Modalità focus/ }).click();
  await expect(page.locator(".sidebar")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Comprimi la barra laterale" })).toBeDisabled();
  await page.getByRole("button", { name: /Mostra menu/ }).click();
  await expect(page.locator(".sidebar")).toHaveCount(1);

  await page.locator(".view-tab", { hasText: "Scrivania" }).click();
  await expect(page.locator(".view-tab.is-active")).toContainText("Scrivania");
  await page.locator(".view-tab", { hasText: "Bacheca" }).click();
  await expect(page.locator(".view-tab.is-active")).toContainText("Bacheca");

  await page.getByRole("button", { name: "Modalità scura" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("button", { name: "Modalità scura" })).toHaveAttribute("aria-pressed", "true");
  expect((await calls(page, "update_settings")).at(-1)).toEqual({ input: { theme: "dark" } });
  await page.getByRole("button", { name: "Modalità scura" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("barra laterale: nuova nota, nuova cartella con validazione, organizza e sposta", async ({ page }) => {
  await openApp(page);
  await page.getByRole("button", { name: "Nuova nota", exact: true }).first().click();
  await expect.poll(async () => (await calls(page, "create_note")).length).toBe(1);

  await page.locator(".quick-folder").click();
  const dialog = page.getByRole("dialog", { name: "Nuova cartella" });
  await expect(dialog).toBeVisible();
  const name = dialog.getByRole("textbox", { name: "Nome" });
  await name.blur();
  await expect(dialog.getByText("Il nome è obbligatorio")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Crea cartella" })).toBeDisabled();
  await name.fill("Idee");
  await dialog.getByRole("button", { name: "Crea cartella" }).click();
  await expect(dialog).toBeHidden();
  expect((await calls(page, "create_folder")).at(-1)).toEqual({ input: { name: "Idee", icon: "folder", color: "sand" } });
  await expect(page.locator(".folder-main", { hasText: "Idee" })).toBeVisible();

  await page.locator(".folder-main", { hasText: "Progetti" }).click();
  await page.getByRole("button", { name: "Azioni per Nota di prova" }).click();
  await page.getByRole("menu", { name: "Azioni per Nota di prova" }).getByRole("button", { name: "Seleziona più note" }).click();
  await page.getByRole("button", { name: "Tutte", exact: true }).click();
  const bulk = page.locator(".bulk-actions");
  await expect(bulk).toContainText("2 selezionate");
  await bulk.getByRole("button", { name: "Nuova cartella" }).click();
  const selectionDialog = page.getByRole("dialog", { name: "Nuova cartella" });
  await selectionDialog.getByRole("textbox", { name: "Nome" }).fill("Spostate");
  await selectionDialog.getByRole("button", { name: "Crea cartella" }).click();
  await expect.poll(async () => (await calls(page, "move_note")).length).toBe(2);
});

test("menu della nota: evidenza, chiusura con ESC", async ({ page }) => {
  await openApp(page);
  await openEditor(page);
  await page.getByRole("button", { name: "Azioni per Nota di prova" }).click();
  const menu = page.getByRole("menu", { name: "Azioni per Nota di prova" });
  await expect(menu).toBeVisible();
  await menu.getByRole("button", { name: "Metti in evidenza" }).click();
  await expect.poll(async () => (await calls(page, "pin_note")).length).toBe(1);
  await page.getByRole("button", { name: "Azioni per Nota di prova" }).click();
  await expect(menu).toBeVisible();
  await menu.getByRole("button", { name: "Metti in evidenza" }).press("Escape");
  await expect(menu).toBeHidden();
});

test("Bacheca: vista lista, filtri e menu delle schede", async ({ page }) => {
  await openApp(page);
  await page.getByRole("button", { name: "Vista lista" }).click();
  await expect(page.locator(".recent-notes.list")).toBeVisible();
  expect((await calls(page, "update_settings")).at(-1)).toEqual({ input: { dashboardView: "list" } });
  await page.getByRole("combobox", { name: "Filtra per condizione" }).selectOption("attention");
  await expect.poll(async () => (await calls(page, "list_notes")).some((args: any) => args.input?.condition === "attention")).toBe(true);
  await page.getByRole("combobox", { name: "Filtra per condizione" }).selectOption("all");
  await page.locator(".dashboard-note-menu").first().click();
  await expect(page.getByRole("menu", { name: "Azioni per Nota di prova" }).getByRole("button", { name: "Apri nota" })).toBeVisible();
  await page.getByRole("menu", { name: "Azioni per Nota di prova" }).getByRole("button", { name: "Apri nota" }).click();
  await expect(page.locator(".view-tab.is-active")).toContainText("Scrivania");
});

test("Bacheca: cartelle, breadcrumb, drop, chip e selezione multipla", async ({ page }) => {
  await openApp(page, "?many");
  const tiles = page.getByRole("region", { name: "Cartelle", exact: true });
  await tiles.getByRole("button", { name: "Progetti 102 note", exact: true }).click();
  await expect(page.getByRole("navigation", { name: "Percorso Bacheca" })).toContainText("Progetti");
  await page.getByRole("navigation", { name: "Percorso Bacheca" }).getByRole("button", { name: "Bacheca" }).click();
  await page.locator(".dashboard-note-card").first().dragTo(tiles.locator("article", { hasText: "Idee" }));
  await expect.poll(async () => (await calls(page, "move_note")).some((a: any) => a.input.id === 1 && a.input.folderId === 2)).toBe(true);
  await page.locator(".dashboard-stat", { hasText: "Da sistemare" }).click();
  await expect(page.getByRole("combobox", { name: "Filtra per condizione" })).toHaveValue("attention");
  await page.getByRole("button", { name: "Seleziona", exact: true }).click();
  await page.getByRole("checkbox", { name: "Seleziona Nota di prova", exact: true }).check();
  await page.getByRole("checkbox", { name: "Seleziona Seconda nota", exact: true }).check();
  await page.locator(".bulk-actions").getByRole("button", { name: "Cestino", exact: true }).click();
  await expect.poll(async () => (await calls(page, "trash_note")).length).toBe(2);
  await expect(page.locator(".bulk-actions")).toHaveCount(0);
});

test("Striscia: 102 note, scroll orizzontale, riordino e menu contenuto", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 640 });
  await openApp(page, "?many");
  await openEditor(page);
  const strip = page.locator(".note-strip");
  const list = strip.locator(".note-list");
  expect(await list.evaluate(el => el.scrollWidth > el.clientWidth)).toBe(true);
  await list.hover();
  await page.mouse.wheel(0, 420);
  await expect.poll(() => list.evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
  await strip.getByRole("button", { name: "Riordina Nota di prova: frecce sinistra e destra", exact: true }).press("ArrowRight");
  await expect.poll(async () => (await calls(page, "reorder_notes")).length).toBe(1);
  await strip.getByRole("button", { name: "Azioni per Nota di prova", exact: true }).click();
  const menu = page.getByRole("menu", { name: "Azioni per Nota di prova", exact: true });
  await expect(menu).toBeVisible();
  const box = await menu.boundingBox();
  expect(box!.x + box!.width).toBeLessThanOrEqual(1016);
  expect(box!.y + box!.height).toBeLessThanOrEqual(632);
});

test("Scrivania: ogni pulsante del nastro risponde", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 900 });
  await openApp(page);
  await openEditor(page);
  const prose = page.locator(".note-prose");
  await prose.locator("p").first().click();
  await page.keyboard.press("Control+a");
  await page.getByRole("button", { name: "Grassetto" }).click();
  await expect(prose.locator("strong").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Grassetto" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Annulla" }).click();
  await expect(prose.locator("strong")).toHaveCount(0);
  for (const label of ["Corsivo", "Sottolineato", "Barrato", "Allinea al centro", "Giustifica", "Allinea a sinistra", "Lista puntata", "Lista numerata", "Checklist"]) {
    await page.getByRole("button", { name: label, exact: true }).click();
  }
  await prose.locator("p, li").first().click();
  await page.getByRole("button", { name: "Titolo 1" }).click();
  await expect(prose.locator("h1").first()).toBeVisible();
  await page.getByRole("button", { name: "Normale" }).click();

  await page.getByRole("button", { name: "Colore del foglio" }).click();
  await page.getByRole("menuitemradio", { name: "Cielo" }).click();
  await expect(page.locator(".paper")).toHaveClass(/paper-sky/);

  await page.getByRole("button", { name: "Colore testo" }).click();
  await expect(page.getByRole("menu", { name: "Colore testo" })).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: /Trova/ }).click();
  await expect(page.getByRole("search", { name: "Trova e sostituisci" })).toBeVisible();
  await page.getByRole("button", { name: "Chiudi ricerca" }).click();
  await page.getByRole("button", { name: /Indice/ }).click();
  await expect(page.getByRole("complementary", { name: "In questa nota" })).toBeVisible();
  await page.getByRole("button", { name: "Chiudi indice" }).click();

  await page.getByRole("button", { name: "Segna da sistemare" }).click();
  await expect.poll(async () => (await calls(page, "set_note_attention")).length).toBe(1);
  await expect.poll(async () => (await calls(page, "save_note")).length).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Archivia nota" }).click();
  await expect.poll(async () => (await calls(page, "archive_note")).length).toBe(1);
});

test("Cestino: l'eliminazione definitiva chiede conferma in un dialog", async ({ page }) => {
  await openApp(page, "?trash");
  await page.getByRole("button", { name: /Cestino/ }).first().click();
  const card = page.locator(".dashboard-note-card", { hasText: "Nota nel cestino" });
  await card.click({ button: "right" });
  await page.getByRole("button", { name: "Elimina definitivamente" }).click();
  const dialog = page.getByRole("dialog", { name: "Eliminare definitivamente?" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Annulla" }).click();
  await expect(dialog).toBeHidden();
  expect(await calls(page, "delete_note")).toEqual([]);
  await card.getByRole("button", { name: "Azioni per Nota nel cestino" }).click();
  await page.getByRole("button", { name: "Elimina definitivamente" }).click();
  await dialog.getByRole("button", { name: "Elimina" }).click();
  await expect.poll(async () => (await calls(page, "delete_note")).length).toBe(1);
});

test("Archivio e Cestino: schede in una pagina, apertura in scheda e ritorno", async ({ page }) => {
  await openApp(page, "?trash");
  await page.locator(".sidebar").getByRole("button", { name: /Cestino/ }).click();
  await expect(page.getByRole("heading", { name: "Cestino", level: 1 })).toBeVisible();
  await page.locator(".dashboard-note-open", { hasText: "Nota nel cestino" }).click();
  const tabs = page.getByRole("region", { name: "Schede Cestino" });
  await expect(tabs.locator(".note-card")).toHaveCount(2);
  await expect(page.getByRole("textbox", { name: "Titolo della nota", exact: true })).toHaveValue("Nota nel cestino");
  await expect(page.getByText("Nota nel Cestino, sola lettura")).toBeVisible();
  await tabs.getByRole("button", { name: /Cestino/ }).click();
  await expect(page.getByRole("heading", { name: "Cestino", level: 1 })).toBeVisible();
  await page.locator(".dashboard-note-card", { hasText: "Nota nel cestino" }).click({ button: "right" });
  await page.getByRole("button", { name: "Ripristina", exact: true }).click();
  await expect.poll(async () => (await calls(page, "restore_trashed_note")).length).toBe(1);
});

test("Impostazioni: switch, campi e densità", async ({ page }) => {
  await openApp(page);
  await page.getByRole("button", { name: /Impostazioni/ }).click();
  const dialog = page.getByRole("dialog", { name: "Impostazioni" });
  const spell = dialog.getByRole("switch", { name: /Controllo ortografico/ });
  await expect(spell).not.toBeChecked();
  await dialog.locator(".toggle-field").click();
  await expect(spell).toBeChecked();
  await dialog.getByRole("combobox", { name: "Densità layout" }).selectOption("compact");
  await dialog.getByRole("button", { name: "Salva impostazioni" }).click();
  await expect(dialog).toBeHidden();
  const saved = (await calls(page, "update_settings")).at(-1).input;
  expect(saved.spellcheck).toBe(true);
  expect(saved.layoutDensity).toBe("compact");
  await expect(page.locator(".app-shell.density-compact")).toBeVisible();
});
