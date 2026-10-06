import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});

class ResizeObserverStub {
  readonly callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }

  observe(target: Element): void {
    const width =
      target instanceof HTMLElement ? target.clientWidth || 800 : 800;
    const height =
      target instanceof HTMLElement ? target.clientHeight || 600 : 600;

    this.callback(
      [
        {
          target,
          contentRect: {
            x: 0,
            y: 0,
            width,
            height,
            top: 0,
            left: 0,
            bottom: height,
            right: width,
            toJSON() {
              return {};
            },
          },
          borderBoxSize: [],
          contentBoxSize: [],
          devicePixelContentBoxSize: [],
        } as ResizeObserverEntry,
      ],
      this,
    );
  }

  unobserve(): void {}

  disconnect(): void {}
}

if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = ResizeObserverStub;
}

HTMLCanvasElement.prototype.getContext = ((
  _contextId: string,
  _options?: unknown,
) => {
  return {
    setTransform() {},
    save() {},
    restore() {},
    clearRect() {},
    fillRect() {},
    rect() {},
    strokeRect() {},
    beginPath() {},
    closePath() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
    fill() {},
    arc() {},
    setLineDash() {},
    fillText() {},
    measureText(text: string) {
      return { width: text.length * 6 };
    },
  };
}) as unknown as typeof HTMLCanvasElement.prototype.getContext;
