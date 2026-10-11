import { expect, test, type Page } from "@playwright/test";

/** World → client click on the sketch canvas (default scale 2 px/mm, origin at center). */
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

async function dismissRecoveryIfPresent(page: Page): Promise<void> {
  const discard = page.getByTestId("recovery-discard");
  if (await discard.isVisible().catch(() => false)) {
    await discard.click();
  }
}

test.describe("critical path smoke", () => {
  test("rectangle → closed profile → fillet → ready for pad → save download", async ({
    page,
  }) => {
    await page.goto("/");
    await dismissRecoveryIfPresent(page);

    await expect(page.getByTestId("app-title")).toHaveText("WVC-CAD");

    await page.getByTestId("tool-shape-flyout").click();
    await page.getByTestId("tool-rectangle").click();
    await clickWorld(page, 0, 0);
    await clickWorld(page, 100, 50);

    await expect(page.getByTestId("unsaved-indicator")).toHaveText("Unsaved changes");
    await expect(page.getByTestId("profile-outer-count")).toContainText("1 outer loop");
    await expect(page.getByTestId("ready-for-pad")).toBeVisible();

    await page.getByTestId("tool-fillet").click();
    // Bottom-left corner: horizontal bottom near (20,0), vertical left near (0,20).
    await clickWorld(page, 20, 0);
    await clickWorld(page, 0, 20);
    await clickWorld(page, 10, 10);

    await expect(page.getByTestId("profile-outer-count")).toContainText("1 outer loop");
    await expect(page.getByTestId("ready-for-pad")).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("save-button").click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.sketch\.json$/i);
  });
});
