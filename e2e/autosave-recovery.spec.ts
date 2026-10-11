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

test.describe("autosave recovery", () => {
  test("edit → reload → Restore recovers geometry", async ({ page }) => {
    await page.goto("/");
    await dismissRecoveryIfPresent(page);

    await page.getByTestId("tool-shape-flyout").click();
    await page.getByTestId("tool-rectangle").click();
    await clickWorld(page, 0, 0);
    await clickWorld(page, 60, 30);
    await expect(page.getByTestId("unsaved-indicator")).toHaveText("Unsaved changes");

    // Wait for debounced autosave (750ms) to land in localStorage.
    await page.waitForTimeout(1000);

    await page.reload();
    await expect(page.getByTestId("recovery-dialog")).toBeVisible();
    await page.getByTestId("recovery-restore").click();
    await expect(page.getByTestId("recovery-dialog")).toHaveCount(0);
    await expect(page.getByTestId("profile-outer-count")).toContainText("1 outer loop");
    await expect(page.getByTestId("unsaved-indicator")).toHaveText("Unsaved changes");
  });
});
