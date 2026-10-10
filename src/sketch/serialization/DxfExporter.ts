import { normalizeAngle } from "../geometry/GeometryMath.ts";
import type { Geometry } from "../model/Geometry.ts";
import type { Sketch } from "../model/Sketch.ts";

const DXF_EXTENSION = ".dxf";

/**
 * Export sketch geometry as AutoCAD R12 ASCII DXF.
 * Constraints, dimensions, and features are not represented — parametric
 * truth remains `.sketch.json`. Construction geometry goes on layer CONSTRUCTION.
 */
export function exportSketchToDxf(sketch: Sketch): string {
  const lines: string[] = [];
  pushPair(lines, 0, "SECTION");
  pushPair(lines, 2, "HEADER");
  pushPair(lines, 9, "$ACADVER");
  pushPair(lines, 1, "AC1009");
  pushPair(lines, 9, "$INSUNITS");
  pushPair(lines, 70, "4"); // millimeters
  pushPair(lines, 0, "ENDSEC");

  pushPair(lines, 0, "SECTION");
  pushPair(lines, 2, "TABLES");
  pushPair(lines, 0, "TABLE");
  pushPair(lines, 2, "LAYER");
  pushPair(lines, 70, "2");
  writeLayer(lines, "0", 7);
  writeLayer(lines, "CONSTRUCTION", 8);
  pushPair(lines, 0, "ENDTAB");
  pushPair(lines, 0, "ENDSEC");

  pushPair(lines, 0, "SECTION");
  pushPair(lines, 2, "ENTITIES");
  for (const entity of sketch.geometry) {
    writeEntity(lines, entity);
  }
  pushPair(lines, 0, "ENDSEC");
  pushPair(lines, 0, "EOF");
  return lines.join("\n") + "\n";
}

export function dxfDownloadFileName(sketchName: string): string {
  const base = sketchName
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  const stem = (base.length > 0 ? base : "sketch").toLowerCase();
  return stem.endsWith(DXF_EXTENSION) ? stem : `${stem}${DXF_EXTENSION}`;
}

function writeEntity(lines: string[], entity: Geometry): void {
  const layer = entity.construction ? "CONSTRUCTION" : "0";
  switch (entity.type) {
    case "point":
      pushPair(lines, 0, "POINT");
      pushPair(lines, 8, layer);
      pushPair(lines, 10, fmt(entity.position.x));
      pushPair(lines, 20, fmt(entity.position.y));
      pushPair(lines, 30, "0.0");
      break;
    case "line":
      pushPair(lines, 0, "LINE");
      pushPair(lines, 8, layer);
      pushPair(lines, 10, fmt(entity.start.x));
      pushPair(lines, 20, fmt(entity.start.y));
      pushPair(lines, 30, "0.0");
      pushPair(lines, 11, fmt(entity.end.x));
      pushPair(lines, 21, fmt(entity.end.y));
      pushPair(lines, 31, "0.0");
      break;
    case "circle":
      pushPair(lines, 0, "CIRCLE");
      pushPair(lines, 8, layer);
      pushPair(lines, 10, fmt(entity.center.x));
      pushPair(lines, 20, fmt(entity.center.y));
      pushPair(lines, 30, "0.0");
      pushPair(lines, 40, fmt(entity.radius));
      break;
    case "arc": {
      const startDeg = (normalizeAngle(entity.startAngle) * 180) / Math.PI;
      const endDeg = (normalizeAngle(entity.endAngle) * 180) / Math.PI;
      pushPair(lines, 0, "ARC");
      pushPair(lines, 8, layer);
      pushPair(lines, 10, fmt(entity.center.x));
      pushPair(lines, 20, fmt(entity.center.y));
      pushPair(lines, 30, "0.0");
      pushPair(lines, 40, fmt(entity.radius));
      pushPair(lines, 50, fmt(startDeg));
      pushPair(lines, 51, fmt(endDeg));
      break;
    }
  }
}

function writeLayer(lines: string[], name: string, color: number): void {
  pushPair(lines, 0, "LAYER");
  pushPair(lines, 2, name);
  pushPair(lines, 70, "0");
  pushPair(lines, 62, String(color));
  pushPair(lines, 6, "CONTINUOUS");
}

function pushPair(lines: string[], code: number, value: string): void {
  lines.push(String(code), value);
}

function fmt(value: number): string {
  if (!Number.isFinite(value)) {
    return "0.0";
  }
  return Number(value.toFixed(8)).toString();
}
