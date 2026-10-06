import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import App from "../../app/App.tsx";
import { resetEntityIdCounter } from "../../sketch/model/EntityId.ts";

describe("App point tool", () => {
  beforeEach(() => {
    resetEntityIdCounter();
  });

  it("starts empty and can create a snapped point with the Point tool", () => {
    render(<App />);

    expect(screen.getByRole("region", { name: "Sketch canvas" })).toBeInTheDocument();
    expect(screen.getByText(/Empty sketch/)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Geometry: 0");
    expect(screen.getByRole("status")).toHaveTextContent("Tool: select");

    fireEvent.click(screen.getByRole("button", { name: "Point" }));
    expect(screen.getByRole("button", { name: "Point" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("status")).toHaveTextContent("Tool: point");

    const canvas = screen.getByLabelText("Sketch viewport");
    // With centered camera at 2 px/mm, screen (420, 280) is near world (10, 10)
    // and should snap to the 10 mm grid at (10, 10).
    fireEvent.pointerDown(canvas, {
      button: 0,
      clientX: 420,
      clientY: 280,
      altKey: false,
    });

    expect(screen.getByRole("status")).toHaveTextContent("Geometry: 1");
    expect(screen.getByText(/1 entities/)).toBeInTheDocument();
  });

  it("returns to select mode on Escape", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Point" }));
    fireEvent.keyDown(window, { key: "Escape" });

    expect(screen.getByRole("button", { name: "Select" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("status")).toHaveTextContent("Tool: select");
  });
});

describe("App line tool", () => {
  beforeEach(() => {
    resetEntityIdCounter();
  });

  it("creates a line with two clicks and shows length/angle", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Line" }));
    expect(screen.getByRole("button", { name: "Line" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("status")).toHaveTextContent("Tool: line");

    const canvas = screen.getByLabelText("Sketch viewport");
    // Default camera: origin at (400, 300), scale 2 px/mm.
    // World (0,0) → screen (400, 300); world (50, 0) → screen (500, 300).
    fireEvent.pointerDown(canvas, {
      button: 0,
      clientX: 400,
      clientY: 300,
      altKey: false,
    });
    fireEvent.pointerMove(canvas, {
      button: 0,
      clientX: 500,
      clientY: 300,
      altKey: false,
    });

    expect(screen.getByRole("status")).toHaveTextContent("L: 50.00 mm");
    expect(screen.getByRole("status")).toHaveTextContent("∠: 0.0°");

    fireEvent.pointerDown(canvas, {
      button: 0,
      clientX: 500,
      clientY: 300,
      altKey: false,
    });

    expect(screen.getByRole("status")).toHaveTextContent("Geometry: 1");
    expect(screen.getByText(/1 entities/)).toBeInTheDocument();
  });

  it("Escape cancels an unfinished segment then exits to select", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Line" }));
    const canvas = screen.getByLabelText("Sketch viewport");
    fireEvent.pointerDown(canvas, {
      button: 0,
      clientX: 400,
      clientY: 300,
      altKey: false,
    });

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.getByRole("button", { name: "Line" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("status")).toHaveTextContent("Geometry: 0");

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.getByRole("button", { name: "Select" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});

describe("App rectangle tool", () => {
  beforeEach(() => {
    resetEntityIdCounter();
  });

  it("creates a rectangle with two corner clicks", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Rectangle" }));
    expect(screen.getByRole("status")).toHaveTextContent("Tool: rectangle");

    const canvas = screen.getByLabelText("Sketch viewport");
    // Scale 2 → 20 mm grid. World (40,20) → screen (480, 260).
    fireEvent.pointerDown(canvas, {
      button: 0,
      clientX: 400,
      clientY: 300,
      altKey: false,
    });
    fireEvent.pointerMove(canvas, {
      button: 0,
      clientX: 480,
      clientY: 260,
      altKey: false,
    });
    expect(screen.getByRole("status")).toHaveTextContent("W: 40.00 mm");
    expect(screen.getByRole("status")).toHaveTextContent("H: 20.00 mm");

    fireEvent.pointerDown(canvas, {
      button: 0,
      clientX: 480,
      clientY: 260,
      altKey: false,
    });

    expect(screen.getByRole("status")).toHaveTextContent("Geometry: 8");
    expect(screen.getByRole("status")).toHaveTextContent(/Constraints: [1-9]/);
  });
});

describe("App circle tool", () => {
  beforeEach(() => {
    resetEntityIdCounter();
  });

  it("creates a circle with center and radius clicks", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Circle" }));
    expect(screen.getByRole("status")).toHaveTextContent("Tool: circle");

    const canvas = screen.getByLabelText("Sketch viewport");
    // Center origin, radius point world (40,0) → screen (480, 300).
    fireEvent.pointerDown(canvas, {
      button: 0,
      clientX: 400,
      clientY: 300,
      altKey: false,
    });
    fireEvent.pointerMove(canvas, {
      button: 0,
      clientX: 480,
      clientY: 300,
      altKey: false,
    });
    expect(screen.getByRole("status")).toHaveTextContent("R: 40.00 mm");

    fireEvent.pointerDown(canvas, {
      button: 0,
      clientX: 480,
      clientY: 300,
      altKey: false,
    });

    expect(screen.getByRole("status")).toHaveTextContent("Geometry: 1");
  });
});

describe("App construction mode", () => {
  beforeEach(() => {
    resetEntityIdCounter();
  });

  it("toggles create-as-construction mode from the toolbar", () => {
    render(<App />);

    expect(screen.getByRole("status")).toHaveTextContent("Create: solid");
    fireEvent.click(screen.getByRole("button", { name: "Construction" }));
    expect(screen.getByRole("button", { name: "Construction" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("status")).toHaveTextContent("Create: construction");
  });
});

describe("App arc tool", () => {
  beforeEach(() => {
    resetEntityIdCounter();
  });

  it("creates a center-point arc with three clicks", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Arc" }));
    expect(screen.getByRole("status")).toHaveTextContent("Tool: arc");

    const canvas = screen.getByLabelText("Sketch viewport");
    // Center origin; start world (40,0) → (480,300); end world (0,40) → (400,220).
    fireEvent.pointerDown(canvas, {
      button: 0,
      clientX: 400,
      clientY: 300,
      altKey: false,
    });
    fireEvent.pointerDown(canvas, {
      button: 0,
      clientX: 480,
      clientY: 300,
      altKey: false,
    });
    fireEvent.pointerMove(canvas, {
      button: 0,
      clientX: 400,
      clientY: 220,
      altKey: false,
    });
    expect(screen.getByRole("status")).toHaveTextContent("R: 40.00 mm");
    expect(screen.getByRole("status")).toHaveTextContent("Sweep: 90.0°");

    fireEvent.pointerDown(canvas, {
      button: 0,
      clientX: 400,
      clientY: 220,
      altKey: false,
    });

    expect(screen.getByRole("status")).toHaveTextContent("Geometry: 1");
  });
});
