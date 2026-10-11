import { expect, test, type Page } from "@playwright/test";

async function dismissRecoveryIfPresent(page: Page): Promise<void> {
  const discard = page.getByTestId("recovery-discard");
  if (await discard.isVisible().catch(() => false)) {
    await discard.click();
  }
}

test.describe("sample: anchored rectangle", () => {
  test("open sample, edit length, profile stays closed", async ({ page }) => {
    await page.goto("/");
    await dismissRecoveryIfPresent(page);

    const hint = page.getByTestId("first-run-hint");
    if (await hint.isVisible().catch(() => false)) {
      await page.getByTestId("first-run-dismiss").click();
    }

    await page.getByTestId("menu-file").click();
    await page.getByTestId("menu-action-file-sample:anchored-rectangle").click();

    await expect(page.getByTestId("panel-constraint-status")).toContainText(
      /FULLY CONSTRAINED|0 DOF/i,
    );
    await expect(page.getByTestId("profile-outer-count")).toContainText("1 outer loop");

    const panel = page.getByRole("region", { name: "Constraint status" });
    const value = panel.getByRole("textbox", { name: /Length .* value/ }).first();
    await expect(value).toBeVisible();
    const before = await value.inputValue();
    await value.fill("110");
    await value.press("Enter");
    await expect(value).toHaveValue("110.00");
    expect(before).not.toBe("110.00");

    await expect(page.getByTestId("profile-outer-count")).toContainText("1 outer loop");
  });
});
