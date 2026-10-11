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

/** World → client on the sketch canvas (default scale 2 px/mm, origin at center). */
async function worldClient(
  page: Page,
  worldX: number,
  worldY: number,
): Promise<{ x: number; y: number }> {
  const canvas = page.getByLabel("Sketch viewport");
  const box = await canvas.boundingBox();
  if (box === null) {
    throw new Error("Sketch viewport has no bounding box");
  }
  const scale = 2;
  return {
    x: box.x + box.width / 2 + worldX * scale,
    y: box.y + box.height / 2 - worldY * scale,
  };
}

async function clickWorld(page: Page, worldX: number, worldY: number): Promise<void> {
  const { x, y } = await worldClient(page, worldX, worldY);
  await page.mouse.click(x, y);
}

test.describe("select move", () => {
  test("Escape mid-drag leaves the original length", async ({ page }) => {
    await page.goto("/");
    await dismissRecoveryIfPresent(page);
    await dismissFirstRunIfPresent(page);

    // Commit-path drag is covered by App select-drag unit tests; this journey
    // locks the Escape-abort UX (discard preview, no move command).
    await page.getByTestId("tool-line").click();
    await clickWorld(page, 0, 0);
    await clickWorld(page, 40, 0);
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");

    await page.getByTestId("tool-select").click();
    const from = await worldClient(page, 40, 0);
    const to = await worldClient(page, 80, 0);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 8 });
    await page.keyboard.press("Escape");
    await page.mouse.up();

    await page.getByTestId("tool-dim-distance").click();
    await clickWorld(page, 20, 0);
    await clickWorld(page, 20, 0);

    const panel = page.getByRole("region", { name: "Constraint status" });
    await expect(
      panel.getByRole("textbox", { name: /Length .* value/ }),
    ).toHaveValue("40.00");
  });
});
