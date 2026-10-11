import { expect, test, type Page } from "@playwright/test";

async function dismissRecoveryIfPresent(page: Page): Promise<void> {
  const discard = page.getByTestId("recovery-discard");
  if (await discard.isVisible().catch(() => false)) {
    await discard.click();
  }
}

async function dismissFirstRunIfPresent(page: Page): Promise<void> {
  const hint = page.getByTestId("first-run-hint");
  if (await hint.isVisible().catch(() => false)) {
    await page.getByTestId("first-run-dismiss").click();
  }
}

test.describe("sample: over-constrained line", () => {
  test("status bar reports OVER-CONSTRAINED or INCONSISTENT", async ({ page }) => {
    await page.goto("/");
    await dismissRecoveryIfPresent(page);
    await dismissFirstRunIfPresent(page);

    await page.getByTestId("menu-file").click();
    await page
      .getByTestId("menu-action-file-sample:over-constrained-line")
      .click();

    await expect(page.getByTestId("constraint-status")).toContainText(
      /OVER-CONSTRAINED|INCONSISTENT|SOLVER FAILED/i,
    );
    await expect(page.getByTestId("panel-constraint-status")).toContainText(
      /OVER-CONSTRAINED|INCONSISTENT|SOLVER FAILED/i,
    );
  });
});
