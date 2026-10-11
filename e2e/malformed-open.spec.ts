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

test.describe("malformed open", () => {
  test("rejects a bad file and leaves the current sketch untouched", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const files = new Map<string, string>();
      window.__WVC_FILE_STORAGE__ = {
        async open() {
          return {
            text: JSON.stringify({
              schemaVersion: 1,
              units: "mm",
              id: "sketch-1",
              name: "Bad",
              geometry: [
                {
                  id: "line-1",
                  type: "line",
                  start: { x: 0, y: 0 },
                  end: { x: 10, y: 0 },
                  construction: false,
                },
              ],
              constraints: [
                {
                  id: "c-bad",
                  type: "horizontal",
                  references: [{ entityId: "missing-line", role: "entity" }],
                },
              ],
              settings: { gridVisible: true },
            }),
            ref: {
              id: "memory:bad.sketch.json",
              displayName: "bad.sketch.json",
              kind: "memory",
              resource: "bad.sketch.json",
            },
          };
        },
        async save(text, ref, suggestedName) {
          const name =
            ref?.kind === "memory" && typeof ref.resource === "string"
              ? ref.resource
              : suggestedName;
          files.set(name, text);
          return {
            id: `memory:${name}`,
            displayName: name,
            kind: "memory",
            resource: name,
          };
        },
        async saveAs(text, suggestedName) {
          files.set(suggestedName, text);
          return {
            id: `memory:${suggestedName}`,
            displayName: suggestedName,
            kind: "memory",
            resource: suggestedName,
          };
        },
        async openRef() {
          return null;
        },
      };
    });

    await page.goto("/");
    await dismissRecoveryIfPresent(page);

    await page.getByTestId("tool-shape-flyout").click();
    await page.getByTestId("tool-rectangle").click();
    await clickWorld(page, 0, 0);
    await clickWorld(page, 50, 25);
    await expect(page.getByTestId("profile-outer-count")).toContainText("1 outer loop");

    await page.getByTestId("open-button").click();
    await expect(page.getByTestId("constraint-conflict")).toContainText(
      /Could not open sketch/i,
    );
    await expect(page.getByTestId("constraint-conflict")).toContainText(
      /missing-line|Constraint/i,
    );
    await expect(page.getByTestId("profile-outer-count")).toContainText("1 outer loop");
  });
});
