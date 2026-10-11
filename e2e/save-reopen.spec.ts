import { expect, test, type Page } from "@playwright/test";

async function dismissRecoveryIfPresent(page: Page): Promise<void> {
  const discard = page.getByTestId("recovery-discard");
  if (await discard.isVisible().catch(() => false)) {
    await discard.click();
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

test.describe("save overwrite + reopen", () => {
  test("save → edit → save → reopen via memory FileStorage", async ({ page }) => {
    await page.addInitScript(() => {
      const files = new Map<string, string>();
      let last: string | null = null;
      const write = (name: string, text: string) => {
        files.set(name, text);
        last = name;
        return {
          id: `memory:${name}`,
          displayName: name,
          kind: "memory" as const,
          resource: name,
        };
      };
      window.__WVC_FILE_STORAGE__ = {
        async open() {
          if (last === null) {
            return null;
          }
          const text = files.get(last);
          if (text === undefined) {
            return null;
          }
          return { text, ref: write(last, text) };
        },
        async save(text, ref, suggestedName) {
          if (ref?.kind === "memory" && typeof ref.resource === "string") {
            return write(ref.resource, text);
          }
          return write(suggestedName, text);
        },
        async saveAs(text, suggestedName) {
          return write(suggestedName, text);
        },
        async openRef(ref) {
          if (ref.kind !== "memory" || typeof ref.resource !== "string") {
            return null;
          }
          const text = files.get(ref.resource);
          if (text === undefined) {
            return null;
          }
          return { text, ref: write(ref.resource, text) };
        },
      };
    });

    await page.goto("/");
    await dismissRecoveryIfPresent(page);

    await page.getByTestId("tool-shape-flyout").click();
    await page.getByTestId("tool-rectangle").click();
    await clickWorld(page, 0, 0);
    await clickWorld(page, 80, 40);
    await expect(page.getByTestId("unsaved-indicator")).toHaveText("Unsaved changes");

    await page.getByTestId("save-button").click();
    await expect(page.getByTestId("document-label")).toContainText(".sketch.json");
    await expect(page.getByTestId("unsaved-indicator")).toHaveText("Saved");

    await page.getByTestId("tool-point").click();
    await clickWorld(page, 10, 10);
    await expect(page.getByTestId("unsaved-indicator")).toHaveText("Unsaved changes");

    await page.getByTestId("save-button").click();
    await expect(page.getByTestId("unsaved-indicator")).toHaveText("Saved");

    await page.getByTestId("menu-file").click();
    await page.locator('[data-testid^="menu-action-file-recent:"]').first().click();
    await expect(page.getByTestId("document-label")).toContainText(".sketch.json");
    await expect(page.getByTestId("unsaved-indicator")).toHaveText("Saved");
  });
});
