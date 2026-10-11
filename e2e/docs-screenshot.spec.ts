import { test } from "@playwright/test";
import path from "node:path";

test("capture README canvas screenshot", async ({ page }) => {
  await page.goto("/");
  const discard = page.getByTestId("recovery-discard");
  if (await discard.isVisible().catch(() => false)) {
    await discard.click();
  }
  const tip = page.getByTestId("first-run-dismiss");
  if (await tip.isVisible().catch(() => false)) {
    await tip.click();
  }
  await page.getByTestId("menu-file").click();
  await page.getByTestId("menu-action-file-sample:filleted-plate").click();
  await page.waitForTimeout(400);
  await page.screenshot({
    path: path.join("docs", "images", "app-canvas.png"),
    fullPage: false,
  });
});
