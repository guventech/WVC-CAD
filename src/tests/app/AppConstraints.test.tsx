import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import App from "../../app/App.tsx";
import { resetEntityIdCounter } from "../../sketch/model/EntityId.ts";

function openSessionStatus(): void {
  const toggle = screen.getByTestId("status-session-toggle");
  if (toggle.getAttribute("aria-expanded") !== "true") {
    fireEvent.click(toggle);
  }
}

// Default camera: world origin at screen (400, 300), 2 px/mm, Y up.
function drawLine(canvas: HTMLElement, from: [number, number], to: [number, number]) {
  fireEvent.click(screen.getByRole("button", { name: "Line" }));
  fireEvent.pointerDown(canvas, { button: 0, clientX: from[0], clientY: from[1] });
  fireEvent.pointerMove(canvas, { button: 0, clientX: to[0], clientY: to[1] });
  fireEvent.pointerDown(canvas, { button: 0, clientX: to[0], clientY: to[1] });
  fireEvent.keyDown(window, { key: "Escape" });
}

describe("App constraints and dimensions (Chunks 12–13)", () => {
  beforeEach(() => {
    resetEntityIdCounter();
  });

  it("constrains a line horizontal, dimensions it, edits the value, and undoes", () => {
    render(<App />);
    const canvas = screen.getByLabelText("Sketch viewport");
    const panel = screen.getByRole("region", { name: "Constraint status" });

    // World (0,0) → (40,20): slanted line.
    drawLine(canvas, [400, 300], [480, 260]);
    openSessionStatus();
    expect(screen.getByRole("status")).toHaveTextContent("Geometry: 1");

    fireEvent.click(screen.getByRole("button", { name: "Horizontal" }));
    fireEvent.pointerDown(canvas, { button: 0, clientX: 440, clientY: 280 });
    expect(screen.getByRole("status")).toHaveTextContent("Constraints: 1");
    expect(within(panel).getByText(/Horizontal/)).toBeInTheDocument();

    // After H the line sits at y = 10 mm (screen y 280). Distance tool: same line twice → length.
    fireEvent.click(screen.getByRole("button", { name: "Distance" }));
    fireEvent.pointerDown(canvas, { button: 0, clientX: 440, clientY: 280 });
    fireEvent.pointerDown(canvas, { button: 0, clientX: 440, clientY: 280 });
    expect(screen.getByRole("status")).toHaveTextContent("Constraints: 2");

    const input = within(panel).getByRole("textbox", { name: /Length .* value/ });
    expect(input).toHaveValue("40.00");
    fireEvent.change(input, { target: { value: "75" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(within(panel).getByRole("textbox", { name: /Length .* value/ })).toHaveValue("75.00");

    fireEvent.change(within(panel).getByRole("textbox", { name: /Length .* value/ }), {
      target: { value: "-3" },
    });
    fireEvent.keyDown(within(panel).getByRole("textbox", { name: /Length .* value/ }), {
      key: "Enter",
    });
    expect(within(panel).getByRole("alert")).toHaveTextContent(/greater than 0|Invalid length/i);
    expect(within(panel).getByRole("textbox", { name: /Length .* value/ })).toHaveValue("-3");

    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    expect(within(panel).getByRole("textbox", { name: /Length .* value/ })).toHaveValue("40.00");
  });

  it("rejects vertical on a horizontal line with a visible message", () => {
    render(<App />);
    const canvas = screen.getByLabelText("Sketch viewport");
    drawLine(canvas, [400, 300], [480, 300]);

    fireEvent.click(screen.getByRole("button", { name: "Horizontal" }));
    fireEvent.pointerDown(canvas, { button: 0, clientX: 440, clientY: 300 });
    fireEvent.click(screen.getByRole("button", { name: "Vertical" }));
    fireEvent.pointerDown(canvas, { button: 0, clientX: 440, clientY: 300 });

    openSessionStatus();
    expect(screen.getByRole("status")).toHaveTextContent("Constraints: 1");
    expect(screen.getByRole("alert")).toHaveTextContent(/No changes were made/);
  });
});
