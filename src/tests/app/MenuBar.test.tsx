import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import App from "../../app/App.tsx";
import { resetEntityIdCounter } from "../../sketch/model/EntityId.ts";

describe("Chunk 27 menu bar", () => {
  beforeEach(() => {
    resetEntityIdCounter();
  });

  it("exposes File Edit Sketch Constraints Tools menus", () => {
    render(<App />);
    expect(screen.getByTestId("menu-file")).toBeInTheDocument();
    expect(screen.getByTestId("menu-edit")).toBeInTheDocument();
    expect(screen.getByTestId("menu-sketch")).toBeInTheDocument();
    expect(screen.getByTestId("menu-constraints")).toBeInTheDocument();
    expect(screen.getByTestId("menu-tools")).toBeInTheDocument();
    expect(screen.getByTestId("app-title")).toHaveTextContent("Sketcher");
    expect(screen.getByText("2D Sketch")).toBeInTheDocument();
  });

  it("activates the Line tool from the Sketch menu", () => {
    render(<App />);
    fireEvent.click(screen.getByTestId("menu-sketch"));
    fireEvent.click(screen.getByTestId("menu-action-tool:line"));
    expect(screen.getByRole("button", { name: "Line" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    fireEvent.click(screen.getByTestId("status-session-toggle"));
    expect(screen.getByRole("status")).toHaveTextContent("Tool: line");
  });

  it("opens Constraints menu and selects Coincident", () => {
    render(<App />);
    fireEvent.click(screen.getByTestId("menu-constraints"));
    fireEvent.click(screen.getByTestId("menu-action-tool:coincident"));
    expect(screen.getByRole("button", { name: "Coincident" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
