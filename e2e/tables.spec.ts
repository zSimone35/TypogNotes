import { expect, test } from "@playwright/test";
import { installTauriMock } from "./tauri-mock";

test("tabelle: scelta della dimensione e modifica dal tasto destro", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await installTauriMock(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.locator(".folder-main").click();
  await page.locator(".note-prose > p").first().click();
  await page.keyboard.press("End");

  await page.getByRole("button", { name: "Inserisci tabella" }).click();
  const picker = page.getByRole("menu", { name: "Dimensione tabella" });
  await picker.getByRole("menuitem", { name: "Tabella 3 righe × 4 colonne" }).hover();
  await expect(picker.getByText("3 × 4")).toBeVisible();
  await expect(picker.locator("button.is-selected")).toHaveCount(12);
  await picker.getByRole("menuitem", { name: "Tabella 3 righe × 4 colonne" }).click();

  const table = page.locator(".note-prose table");
  await expect(table.locator("tr")).toHaveCount(3);
  await expect(table.locator("tr").first().locator("th")).toHaveCount(4);
  await page.keyboard.type("Nome");
  await expect(table.locator("th").first()).toHaveText("Nome");
  await page.screenshot({ path: "test-results/table.png" });

  const menuAction = async (cell: number, label: string) => {
    await table.locator("td").nth(cell).click({ button: "right" });
    await page.getByRole("button", { name: label, exact: true }).click();
  };
  await menuAction(0, "Riga sotto");
  await expect(table.locator("tr")).toHaveCount(4);
  await menuAction(0, "Colonna a destra");
  await expect(table.locator("tr").first().locator("th")).toHaveCount(5);
  await menuAction(1, "Elimina colonna");
  await expect(table.locator("tr").first().locator("th")).toHaveCount(4);
  await menuAction(0, "Elimina riga");
  await expect(table.locator("tr")).toHaveCount(3);
  await expect.poll(() => page.evaluate(() => JSON.stringify((window as any).__mockCalls.filter((c: any) => c.command === "save_note").at(-1)?.args.input.content))).toContain('"type":"table"');
  await menuAction(0, "Elimina tabella");
  await expect(page.locator(".note-prose table")).toHaveCount(0);
  expect(errors).toEqual([]);
});
