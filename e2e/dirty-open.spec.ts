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

test.describe("dirty open guards", () => {
  test("canceling sample open keeps the current dirty sketch", async ({ page }) => {
    await page.goto("/");
    await dismissRecoveryIfPresent(page);

    await page.getByTestId("tool-shape-flyout").click();
    await page.getByTestId("tool-rectangle").click();
    await clickWorld(page, 0, 0);
    await clickWorld(page, 60, 30);
    await expect(page.getByTestId("unsaved-indicator")).toHaveText("Unsaved changes");
    await expect(page.getByTestId("profile-outer-count")).toContainText("1 outer loop");

    page.once("dialog", (dialog) => {
      void dialog.dismiss();
    });

    await page.getByRole("menuitem", { name: "File" }).click();
    await page.getByRole("menuitem", { name: /Sample:/i }).first().click();

    await expect(page.getByTestId("unsaved-indicator")).toHaveText("Unsaved changes");
    await expect(page.getByTestId("profile-outer-count")).toContainText("1 outer loop");
  });
});
