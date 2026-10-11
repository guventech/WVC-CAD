import { expect, test, type Page } from "@playwright/test";

async function dismissRecoveryIfPresent(page: Page): Promise<void> {
  const discard = page.getByTestId("recovery-discard");
  if (await discard.isVisible().catch(() => false)) {
    await discard.click();
  }
}

test.describe("status bar layout", () => {
  test("status bar stays visible when resizing and switching tools", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    await dismissRecoveryIfPresent(page);

    const status = page.locator("footer.status-bar");
    await expect(status).toBeVisible();

    await page.getByTestId("tool-line").click();
    await expect(page.getByTestId("constraint-context-bar-spacer")).toBeAttached();
    await expect(status).toBeVisible();

    await page.setViewportSize({ width: 900, height: 500 });
    await expect(status).toBeVisible();
    const box = await status.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y + box!.height).toBeLessThanOrEqual(500 + 1);

    await page.getByTestId("tool-select").click();
    await expect(page.getByTestId("constraint-context-bar")).toBeVisible();
    await expect(status).toBeVisible();
  });

  test("2D sketch pane fills the canvas host after resize", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    await dismissRecoveryIfPresent(page);

    await page.setViewportSize({ width: 1100, height: 720 });

    const metrics = await page.evaluate(() => {
      const host = document.querySelector(".canvas-host");
      const pane = document.querySelector(".canvas-pane");
      if (host === null || pane === null) {
        return null;
      }
      const hostBox = host.getBoundingClientRect();
      const paneBox = pane.getBoundingClientRect();
      return {
        hostHeight: hostBox.height,
        paneHeight: paneBox.height,
        hostWidth: hostBox.width,
        paneWidth: paneBox.width,
      };
    });

    expect(metrics).not.toBeNull();
    expect(metrics!.paneHeight).toBeGreaterThan(100);
    expect(Math.abs(metrics!.paneHeight - metrics!.hostHeight)).toBeLessThanOrEqual(2);
    expect(Math.abs(metrics!.paneWidth - metrics!.hostWidth)).toBeLessThanOrEqual(2);
  });
});
