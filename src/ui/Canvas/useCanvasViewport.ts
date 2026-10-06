import { useEffect, useRef, useState, type RefObject } from "react";
import {
  createCamera,
  zoomCameraAt,
  type Camera,
} from "../../sketch/viewport/Camera.ts";
import { getCanvasPoint } from "./canvasPointer.ts";

type Size = {
  readonly width: number;
  readonly height: number;
};

type PanSession = {
  readonly pointerId: number;
  readonly lastClientX: number;
  readonly lastClientY: number;
};

export function useCanvasViewport(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  onCameraScaleChange?: (scale: number) => void,
) {
  const panRef = useRef<PanSession | null>(null);
  const hasCenteredRef = useRef(false);
  const lastReportedScaleRef = useRef<number | null>(null);
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  const [camera, setCamera] = useState<Camera>(() => createCamera(1, 1));
  const [isPanning, setIsPanning] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry === undefined) {
        return;
      }

      const width = Math.max(1, Math.floor(entry.contentRect.width));
      const height = Math.max(1, Math.floor(entry.contentRect.height));
      setSize((previous) => {
        if (previous.width === width && previous.height === height) {
          return previous;
        }
        return { width, height };
      });
    });

    observer.observe(canvas);
    return () => observer.disconnect();
  }, [canvasRef]);

  useEffect(() => {
    if (size.width <= 1 || size.height <= 1 || hasCenteredRef.current) {
      return;
    }

    hasCenteredRef.current = true;
    setCamera(createCamera(size.width, size.height));
  }, [size.height, size.width]);

  useEffect(() => {
    if (lastReportedScaleRef.current === camera.scale) {
      return;
    }
    lastReportedScaleRef.current = camera.scale;
    onCameraScaleChange?.(camera.scale);
  }, [camera.scale, onCameraScaleChange]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) {
      return;
    }

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const screenPoint = getCanvasPoint(canvas, event.clientX, event.clientY);
      const factor = event.deltaY < 0 ? 1.1 : 1 / 1.1;
      setCamera((current) => zoomCameraAt(current, screenPoint, factor));
    };

    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [canvasRef]);

  return {
    size,
    camera,
    setCamera,
    isPanning,
    setIsPanning,
    panRef,
  };
}
