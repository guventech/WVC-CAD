import { fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../../app/App.tsx";
import fixtureJson from "../fixtures/fillet-chamfer-radius-edit.sketch.json?raw";

vi.mock("../../app/sketchFileIo.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../app/sketchFileIo.ts")>();
  return {
    ...actual,
    pickSketchFileText: vi.fn(),
  };
});

import { pickSketchFileText } from "../../app/sketchFileIo.ts";

describe("App fillet radius edit", () => {
  beforeEach(() => {
    vi.mocked(pickSketchFileText).mockResolvedValue(fixtureJson);
  });

  it("opens a filleted sketch and edits a fillet radius from the Constraints panel", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Open" }));

    const panel = await screen.findByRole("region", { name: "Constraint status" });
    const input = await within(panel).findByRole("textbox", {
      name: "Radius constraint-249 value",
    });
    expect(input).toHaveValue("20.00");
    fireEvent.change(input, { target: { value: "25" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(screen.getByTestId("undo-button")).toHaveAttribute(
        "title",
        expect.stringContaining("Edit dimension constraint-249"),
      );
    });
    expect(within(panel).queryByRole("alert")).not.toBeInTheDocument();
  });
});
