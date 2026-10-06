export {
  FILLET_RECTANGLE_BLOCKED_REASON,
  CHAMFER_RECTANGLE_BLOCKED_REASON,
  type FilletChamferFailureReason,
  type FilletOutcome,
  type ChamferOutcome,
} from "./FilletChamferOpsShared.ts";

export {
  filletWedgePickPoint,
  rebuildFilletGeometry,
  rebuildFilletGeometryPreservingLengths,
  applyFilletRadiusEdit,
  updateFilletRadius,
} from "./FilletRebuild.ts";

export {
  applyLengthToFilletedEdge,
  restoreUnsatisfiedFilletedLengths,
} from "./FilletLengthRestore.ts";

export {
  findChamferAngleConstraint,
  rebuildChamferGeometry,
  rebuildCornerFeaturesTouching,
  rebuildAllCornerFeatures,
  cornerFeaturesTopologyIntact,
  translateCornerFeaturesTouching,
  reconcileCornerFeaturesAfterSolve,
} from "./CornerFeatureReconcile.ts";

export { applyAxisOffsetToRectangleEdge } from "./RectangleEdgeOps.ts";

export {
  applyFilletLines,
  applyChamferLines,
  previewFilletLines,
  previewChamferLines,
  filletFeatureForArc,
} from "./FilletChamferApply.ts";
