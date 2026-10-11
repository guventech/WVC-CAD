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

test.describe("DXF export", () => {
  test("downloads geometry-only DXF and shows info (not error) tone", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Reflect.deleteProperty(window, "showSaveFilePicker");
      Reflect.deleteProperty(window, "showOpenFilePicker");
    });

    await page.goto("/");
    await dismissRecoveryIfPresent(page);
    await dismissFirstRunIfPresent(page);

    await page.getByTestId("tool-line").click();
    await clickWorld(page, 0, 0);
    await clickWorld(page, 40, 0);
    await page.keyboard.press("Escape");

    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("menu-file").click();
    await page.getByTestId("menu-action-file-export-dxf").click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.dxf$/i);

    await expect(page.getByTestId("constraint-info")).toContainText(
      /geometry-only DXF/i,
    );
    await expect(page.getByTestId("constraint-conflict")).toHaveCount(0);
  });
});
