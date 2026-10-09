import type { ReactElement } from "react";
import type { ActiveTool } from "../../sketch/tools/ActiveTool.ts";

type SvgProps = { readonly title?: string };

function Svg({ children }: { readonly children: ReactElement | ReactElement[] }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/** Document / chrome actions (not ActiveTool). */
export type ChromeActionId =
  | "new"
  | "open"
  | "save"
  | "undo"
  | "redo"
  | "construction"
  | "toggle-construction";

export type GlyphId = ActiveTool | ChromeActionId;

export const GEOMETRY_TOOL_IDS: readonly ActiveTool[] = [
  "select",
  "point",
  "line",
  "rectangle",
  "circle",
  "arc",
  "trim",
  "extend",
  "mirror",
  "fillet",
  "chamfer",
];

export const CONSTRAINT_TOOL_IDS: readonly ActiveTool[] = [
  "coincident",
  "horizontal",
  "vertical",
  "parallel",
  "perpendicular",
  "tangent",
  "concentric",
  "midpoint",
  "equal",
  "symmetric",
  "point-on-object",
  "fix",
  "dim-offset-x-axis",
  "dim-offset-y-axis",
];

export const DIMENSION_TOOL_IDS: readonly ActiveTool[] = [
  "dim-distance",
  "dim-radius",
  "dim-diameter",
  "dim-angle",
];

export const CHROME_ACTION_IDS: readonly ChromeActionId[] = [
  "new",
  "open",
  "save",
  "undo",
  "redo",
  "construction",
  "toggle-construction",
];

const GLYPHS: Record<GlyphId, (props?: SvgProps) => ReactElement> = {
  select: () => (
    <Svg>
      <path d="M4 2 L4 14 L7.5 11 L9.5 15.5 L11.5 14.5 L9.5 10 L13 10 Z" fill="currentColor" stroke="none" />
    </Svg>
  ),
  point: () => (
    <Svg>
      <circle cx="9" cy="9" r="2.5" fill="currentColor" stroke="none" />
    </Svg>
  ),
  line: () => (
    <Svg>
      <line x1="3" y1="14" x2="15" y2="4" />
      <circle cx="3" cy="14" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="15" cy="4" r="1.5" fill="currentColor" stroke="none" />
    </Svg>
  ),
  rectangle: () => (
    <Svg>
      <rect x="3.5" y="4.5" width="11" height="9" />
    </Svg>
  ),
  circle: () => (
    <Svg>
      <circle cx="9" cy="9" r="5.5" />
      <circle cx="9" cy="9" r="1" fill="currentColor" stroke="none" />
    </Svg>
  ),
  arc: () => (
    <Svg>
      <path d="M3.5 12 A6 6 0 0 1 14.5 12" />
      <circle cx="9" cy="12" r="1" fill="currentColor" stroke="none" />
    </Svg>
  ),
  trim: () => (
    <Svg>
      <line x1="3" y1="9" x2="8" y2="9" />
      <line x1="11" y1="9" x2="15" y2="9" strokeDasharray="2 2" />
      <line x1="9" y1="3" x2="9" y2="15" />
    </Svg>
  ),
  extend: () => (
    <Svg>
      <line x1="3" y1="9" x2="10" y2="9" />
      <line x1="10" y1="9" x2="15" y2="9" strokeDasharray="2 1.5" />
      <polyline points="13,6.5 15.5,9 13,11.5" />
    </Svg>
  ),
  mirror: () => (
    <Svg>
      <line x1="9" y1="2.5" x2="9" y2="15.5" strokeDasharray="2 2" />
      <path d="M3 5 L7 9 L3 13 Z" />
      <path d="M15 5 L11 9 L15 13 Z" />
    </Svg>
  ),
  fillet: () => (
    <Svg>
      <path d="M4 14 L4 8 A4 4 0 0 1 8 4 L14 4" />
    </Svg>
  ),
  chamfer: () => (
    <Svg>
      <path d="M4 14 L4 7 L7 4 L14 4" />
    </Svg>
  ),
  coincident: () => (
    <Svg>
      <circle cx="6.5" cy="9" r="2.2" />
      <circle cx="11.5" cy="9" r="2.2" />
    </Svg>
  ),
  horizontal: () => (
    <Svg>
      <line x1="3" y1="9" x2="15" y2="9" />
      <text x="9" y="7" textAnchor="middle" fontSize="6" fill="currentColor" stroke="none">
        H
      </text>
    </Svg>
  ),
  vertical: () => (
    <Svg>
      <line x1="9" y1="3" x2="9" y2="15" />
      <text x="12" y="10" fontSize="6" fill="currentColor" stroke="none">
        V
      </text>
    </Svg>
  ),
  parallel: () => (
    <Svg>
      <line x1="4" y1="6" x2="14" y2="4" />
      <line x1="4" y1="13" x2="14" y2="11" />
    </Svg>
  ),
  perpendicular: () => (
    <Svg>
      <line x1="4" y1="14" x2="4" y2="5" />
      <line x1="4" y1="5" x2="13" y2="5" />
    </Svg>
  ),
  tangent: () => (
    <Svg>
      <circle cx="7" cy="10" r="4" />
      <line x1="3" y1="5" x2="15" y2="5" />
    </Svg>
  ),
  concentric: () => (
    <Svg>
      <circle cx="9" cy="9" r="5.5" />
      <circle cx="9" cy="9" r="3" />
    </Svg>
  ),
  midpoint: () => (
    <Svg>
      <line x1="3" y1="12" x2="15" y2="12" />
      <circle cx="9" cy="12" r="1.8" fill="currentColor" stroke="none" />
    </Svg>
  ),
  equal: () => (
    <Svg>
      <line x1="4" y1="6" x2="14" y2="6" />
      <line x1="4" y1="12" x2="14" y2="12" />
      <line x1="7" y1="8.5" x2="11" y2="8.5" />
      <line x1="7" y1="10.5" x2="11" y2="10.5" />
    </Svg>
  ),
  symmetric: () => (
    <Svg>
      <line x1="9" y1="3" x2="9" y2="15" strokeDasharray="2 2" />
      <circle cx="5" cy="9" r="1.8" fill="currentColor" stroke="none" />
      <circle cx="13" cy="9" r="1.8" fill="currentColor" stroke="none" />
    </Svg>
  ),
  "point-on-object": () => (
    <Svg>
      <line x1="3" y1="12" x2="15" y2="6" />
      <circle cx="9" cy="9" r="1.8" fill="currentColor" stroke="none" />
    </Svg>
  ),
  fix: () => (
    <Svg>
      <rect x="6" y="6" width="6" height="6" />
      <line x1="9" y1="3" x2="9" y2="6" />
      <line x1="9" y1="12" x2="9" y2="15" />
      <line x1="3" y1="9" x2="6" y2="9" />
      <line x1="12" y1="9" x2="15" y2="9" />
    </Svg>
  ),
  "dim-offset-x-axis": () => (
    <Svg>
      <line x1="3" y1="14" x2="15" y2="14" />
      <line x1="9" y1="14" x2="9" y2="5" />
      <polyline points="7,7 9,5 11,7" />
    </Svg>
  ),
  "dim-offset-y-axis": () => (
    <Svg>
      <line x1="4" y1="3" x2="4" y2="15" />
      <line x1="4" y1="9" x2="13" y2="9" />
      <polyline points="11,7 13,9 11,11" />
    </Svg>
  ),
  "dim-distance": () => (
    <Svg>
      <line x1="3" y1="12" x2="15" y2="6" />
      <line x1="4" y1="14" x2="14" y2="8" />
      <polyline points="4.5,12 4,14 6,13.5" />
      <polyline points="13.5,6.5 14,8 12,8.5" />
    </Svg>
  ),
  "dim-radius": () => (
    <Svg>
      <circle cx="9" cy="9" r="5.5" />
      <line x1="9" y1="9" x2="13.5" y2="5.5" />
    </Svg>
  ),
  "dim-diameter": () => (
    <Svg>
      <circle cx="9" cy="9" r="5.5" />
      <line x1="4.5" y1="9" x2="13.5" y2="9" />
    </Svg>
  ),
  "dim-angle": () => (
    <Svg>
      <path d="M4 14 L4 5 L13 5" />
      <path d="M4 10 A5 5 0 0 1 9 5" />
    </Svg>
  ),
  new: () => (
    <Svg>
      <path d="M5 3.5 H11 L14 6.5 V14.5 H5 Z" />
      <line x1="11" y1="3.5" x2="11" y2="6.5" />
      <line x1="11" y1="6.5" x2="14" y2="6.5" />
    </Svg>
  ),
  open: () => (
    <Svg>
      <path d="M3 6.5 H7 L8.5 5 H15 V13.5 H3 Z" />
    </Svg>
  ),
  save: () => (
    <Svg>
      <path d="M4 3.5 H12.5 L14.5 5.5 V14.5 H4 Z" />
      <rect x="6" y="9.5" width="6" height="5" />
      <rect x="6" y="4.5" width="5" height="3" />
    </Svg>
  ),
  undo: () => (
    <Svg>
      <path d="M6 7 H12 A3.5 3.5 0 1 1 12 13 H8" />
      <polyline points="8,4.5 5.5,7 8,9.5" />
    </Svg>
  ),
  redo: () => (
    <Svg>
      <path d="M12 7 H6 A3.5 3.5 0 1 0 6 13 H10" />
      <polyline points="10,4.5 12.5,7 10,9.5" />
    </Svg>
  ),
  construction: () => (
    <Svg>
      <line x1="3" y1="14" x2="15" y2="4" strokeDasharray="2.5 2" />
    </Svg>
  ),
  "toggle-construction": () => (
    <Svg>
      <line x1="3" y1="9" x2="15" y2="9" />
      <line x1="3" y1="13" x2="15" y2="13" strokeDasharray="2.5 2" />
    </Svg>
  ),
};

export function renderToolGlyph(id: GlyphId): ReactElement {
  return GLYPHS[id]();
}

export function allGlyphIds(): readonly GlyphId[] {
  return [
    ...GEOMETRY_TOOL_IDS,
    ...CONSTRAINT_TOOL_IDS,
    ...DIMENSION_TOOL_IDS,
    ...CHROME_ACTION_IDS,
  ];
}
