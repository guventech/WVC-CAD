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
});
