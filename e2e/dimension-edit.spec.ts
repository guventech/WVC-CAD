import { expect, test, type Page } from "@playwright/test";

async function dismissRecoveryIfPresent(page: Page): Promise<void> {
  const discard = page.getByTestId("recovery-discard");
  if (await discard.isVisible().catch(() => false)) {
    await discard.click();
  }
}

async function clickWorld(page: Page, worldX: number, worldY: number): Promise<void> {
  const canvas = page.getByLabel("Sketch viewport");
  const box = await canvas.boundingBox();
  if (box === null) {
    throw new Error("Sketch viewport has no bounding box");
  }
  const scale = 2;
  const clientX = box.x + box.width / 2 + worldX * scale;
  const clientY = box.y + box.height / 2 - worldY * scale;
  await page.mouse.click(clientX, clientY);
}

test.describe("dimension edit", () => {
  test("add length dimension, edit value, undo restores previous", async ({
    page,
  }) => {
    await page.goto("/");
    await dismissRecoveryIfPresent(page);

    const hint = page.getByTestId("first-run-hint");
    if (await hint.isVisible().catch(() => false)) {
      await page.getByTestId("first-run-dismiss").click();
    }

    // Horizontal line 40 mm (Line tool auto-adds H for perfect horizontal).
    await page.getByTestId("tool-line").click();
    await clickWorld(page, 0, 0);
    await clickWorld(page, 40, 0);
    await page.keyboard.press("Escape");

    await page.getByTestId("tool-dim-distance").click();
    await clickWorld(page, 20, 0);
    await clickWorld(page, 20, 0);

    const panel = page.getByRole("region", { name: "Constraint status" });
    const value = panel.getByRole("textbox", { name: /Length .* value/ });
    await expect(value).toHaveValue("40.00");

    await value.fill("75");
    await value.press("Enter");
    await expect(value).toHaveValue("75.00");

    await page.keyboard.press("Control+z");
    await expect(value).toHaveValue("40.00");
  });
});
