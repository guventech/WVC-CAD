import { expect, test, type Page } from "@playwright/test";

async function dismissRecoveryIfPresent(page: Page): Promise<void> {
  const discard = page.getByTestId("recovery-discard");
  if (await discard.isVisible().catch(() => false)) {
    await discard.click();
  }
}

test.describe("accessibility and compact layout", () => {
  test("icon tools expose accessible names; canvas usable at compact size", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    await dismissRecoveryIfPresent(page);

    await expect(page.getByRole("button", { name: "Select" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Line" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Save" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: /shapes$/i }),
    ).toBeVisible();

    // Compact width: side panels hide below 720px; canvas must remain.
    await page.setViewportSize({ width: 680, height: 520 });
    const canvas = page.getByLabel("Sketch viewport");
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(120);
    expect(box!.height).toBeGreaterThan(80);

    await expect(page.locator("footer.status-bar")).toBeVisible();
    await expect(page.getByTestId("constraint-status")).toBeVisible();
  });

  test("Tab reaches a toolbar control with a visible focus ring style", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1100, height: 700 });
    await page.goto("/");
    await dismissRecoveryIfPresent(page);

    const hint = page.getByTestId("first-run-hint");
    if (await hint.isVisible().catch(() => false)) {
      await page.getByTestId("first-run-dismiss").click();
    }

    await page.keyboard.press("Tab");
    const focusedName = await page.evaluate(() => {
      const el = document.activeElement;
      if (!(el instanceof HTMLElement)) {
        return null;
      }
      return el.getAttribute("aria-label") ?? el.textContent?.trim() ?? el.tagName;
    });
    expect(focusedName).not.toBeNull();
    expect(String(focusedName).length).toBeGreaterThan(0);

    const outline = await page.evaluate(() => {
      const el = document.activeElement;
      if (!(el instanceof HTMLElement)) {
        return null;
      }
      return getComputedStyle(el).outlineStyle;
    });
    // :focus-visible should yield a non-none outline on keyboard focus.
    expect(outline).not.toBe("none");
  });
});
