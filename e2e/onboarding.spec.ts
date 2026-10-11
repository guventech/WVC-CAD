import { expect, test, type Page } from "@playwright/test";

async function dismissRecoveryIfPresent(page: Page): Promise<void> {
  const discard = page.getByTestId("recovery-discard");
  if (await discard.isVisible().catch(() => false)) {
    await discard.click();
  }
}

test.describe("first-run onboarding", () => {
  test("shows quick-start tip once, then stays dismissed after reload", async ({
    page,
  }) => {
    await page.goto("/");
    // Clear after first load so reload is not wiped by a re-run init script.
    await page.evaluate(() => {
      try {
        window.localStorage.removeItem("wvc-cad.first-run-hint.v1");
      } catch {
        // ignore
      }
    });
    await page.reload();
    await dismissRecoveryIfPresent(page);

    const hint = page.getByTestId("first-run-hint");
    await expect(hint).toBeVisible();
    await expect(hint).toContainText("Quick start");
    await expect(hint).toContainText("File → Sample:");

    await page.getByTestId("first-run-dismiss").click();
    await expect(hint).toHaveCount(0);

    await page.reload();
    await dismissRecoveryIfPresent(page);
    await expect(page.getByTestId("first-run-hint")).toHaveCount(0);
  });
});
