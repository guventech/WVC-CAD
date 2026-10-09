import { useCallback, useMemo, useState } from "react";
import {
  canRedo,
  canUndo,
  createCommandHistory,
  executeCommand,
  peekRedoLabel,
  peekUndoLabel,
  redoCommand,
  undoCommand,
  type CommandHistory,
} from "../sketch/commands/Command.ts";
import { createDeleteConstraintCommand } from "../sketch/commands/DeleteConstraintCommand.ts";
import {
  createAddArcCommand,
  createAddCircleCommand,
  createAddLineCommand,
  createAddPointCommand,
} from "../sketch/commands/CreateGeometryCommand.ts";
import { createAddRectangleCommand } from "../sketch/commands/CreateRectangleCommand.ts";
import { createDeleteGeometryCommand } from "../sketch/commands/DeleteGeometryCommand.ts";
import { createAddCoincidentCommand } from "../sketch/commands/AddCoincidentCommand.ts";
import {
  createAddMaintainedConstraintCommand,
  type ConstraintCommandOutcome,
  type ConstraintCreateRequest,
} from "../sketch/commands/AddMaintainedConstraintCommand.ts";
import {
  createEditDimensionCommand,
  type DimensionEdit,
  type EditDimensionOutcome,
} from "../sketch/commands/EditDimensionCommand.ts";
import { parseDimensionInput } from "../sketch/constraints/DimensionInput.ts";
import { isSupportedDimensionType } from "../sketch/constraints/Dimensions.ts";
import type { GeometryDragTarget } from "../sketch/commands/GeometryDrag.ts";
import { createMoveGeometryCommand } from "../sketch/commands/GeometryEdit.ts";
import {
  createExtendCommand,
  createTrimCommand,
} from "../sketch/commands/TrimExtendCommand.ts";
import { createMirrorCommand } from "../sketch/commands/MirrorCommand.ts";
import {
  createChamferCommand,
  createFilletCommand,
} from "../sketch/commands/FilletChamferCommand.ts";
import { createToggleConstructionCommand } from "../sketch/commands/ToggleConstructionCommand.ts";
import type { Point2D } from "../sketch/geometry/Point2D.ts";
import type { ConstraintReference } from "../sketch/model/Constraint.ts";
import type { SnapCandidate } from "../sketch/selection/SnapTypes.ts";
import { createEmptySketch, type Sketch } from "../sketch/model/Sketch.ts";
import type { ConstraintConflict } from "../sketch/constraints/OverConstraint.ts";
import { analyzeUnderConstrainedVisualization } from "../sketch/constraints/UnderConstrainedViz.ts";
import { solve } from "../sketch/solver/Solver.ts";
import type { TrimExtendRequest } from "../sketch/tools/TrimExtendTool.ts";
import type { MirrorRequest } from "../sketch/tools/MirrorTool.ts";
import type { FilletChamferRequest } from "../sketch/tools/FilletChamferTool.ts";
import {
  clearSelection,
  type SelectionState,
} from "../sketch/selection/SelectionManager.ts";

export type DocumentState = {
  readonly sketch: Sketch;
  readonly history: CommandHistory;
};

export type UseSketchDocumentOptions = {
  readonly selectedIds: readonly string[];
  readonly createAsConstruction: boolean;
  readonly setSelection: (
    updater: (current: SelectionState) => SelectionState,
  ) => void;
};

export function useSketchDocument({
  selectedIds,
  createAsConstruction,
  setSelection,
}: UseSketchDocumentOptions) {
  const [documentState, setDocumentState] = useState<DocumentState>(() => ({
    sketch: createEmptySketch(),
    history: createCommandHistory(),
  }));
  const { sketch, history } = documentState;
  const solverResult = useMemo(() => solve(sketch), [sketch]);
  const underConstrained = useMemo(
    () => analyzeUnderConstrainedVisualization(sketch),
    [sketch],
  );
  const [constraintMessage, setConstraintMessage] = useState<string | null>(
    null,
  );
  const [constraintConflict, setConstraintConflict] =
    useState<ConstraintConflict | null>(null);

  const toggleSelectedConstruction = useCallback(() => {
    setDocumentState((current) => {
      const command = createToggleConstructionCommand(
        current.sketch,
        selectedIds,
      );
      if (command === null) {
        return current;
      }
      const result = executeCommand(current.history, current.sketch, command);
      return { sketch: result.sketch, history: result.history };
    });
  }, [selectedIds]);

  const handleUndo = useCallback(() => {
    setDocumentState((current) => {
      const result = undoCommand(current.history, current.sketch);
      return { sketch: result.sketch, history: result.history };
    });
    setSelection((current) => clearSelection(current));
  }, [setSelection]);

  const handleRedo = useCallback(() => {
    setDocumentState((current) => {
      const result = redoCommand(current.history, current.sketch);
      return { sketch: result.sketch, history: result.history };
    });
    setSelection((current) => clearSelection(current));
  }, [setSelection]);

  const handleDeleteConstraint = useCallback((constraintId: string) => {
    setDocumentState((current) => {
      const command = createDeleteConstraintCommand(
        current.sketch,
        constraintId,
      );
      if (command === null) {
        return current;
      }
      const result = executeCommand(current.history, current.sketch, command);
      return { sketch: result.sketch, history: result.history };
    });
    setConstraintMessage(null);
    setConstraintConflict(null);
  }, []);

  const handleDeleteSelectedGeometry = useCallback(() => {
    setDocumentState((current) => {
      const command = createDeleteGeometryCommand(current.sketch, selectedIds);
      if (command === null) {
        return current;
      }
      const result = executeCommand(current.history, current.sketch, command);
      return { sketch: result.sketch, history: result.history };
    });
    setSelection((current) => clearSelection(current));
    setConstraintMessage(null);
  }, [selectedIds, setSelection]);

  const handleCreatePoint = useCallback(
    (position: Point2D, options?: { readonly midpointOf?: string }) => {
      setDocumentState((current) => {
        const command = createAddPointCommand(position, {
          construction: createAsConstruction,
          midpointOf: options?.midpointOf,
        });
        const result = executeCommand(current.history, current.sketch, command);
        return { sketch: result.sketch, history: result.history };
      });
    },
    [createAsConstruction],
  );

  const handleCreateLine = useCallback(
    (
      start: Point2D,
      end: Point2D,
      options?: {
        readonly startMidpointOf?: string;
        readonly endMidpointOf?: string;
      },
    ) => {
      setDocumentState((current) => {
        const command = createAddLineCommand(start, end, {
          construction: createAsConstruction,
          startMidpointOf: options?.startMidpointOf,
          endMidpointOf: options?.endMidpointOf,
        });
        if (command === null) {
          return current;
        }
        const result = executeCommand(current.history, current.sketch, command);
        return { sketch: result.sketch, history: result.history };
      });
    },
    [createAsConstruction],
  );

  const handleCreateRectangle = useCallback(
    (
      cornerA: Point2D,
      cornerB: Point2D,
      options?: {
        readonly cornerASnap?: SnapCandidate | null;
        readonly cornerBSnap?: SnapCandidate | null;
      },
    ) => {
      setDocumentState((current) => {
        const command = createAddRectangleCommand(cornerA, cornerB, {
          construction: createAsConstruction,
          cornerASnap: options?.cornerASnap,
          cornerBSnap: options?.cornerBSnap,
        });
        if (command === null) {
          return current;
        }
        const result = executeCommand(current.history, current.sketch, command);
        return { sketch: result.sketch, history: result.history };
      });
    },
    [createAsConstruction],
  );

  const handleCreateCircle = useCallback(
    (
      center: Point2D,
      radiusPoint: Point2D,
      options?: {
        readonly centerMidpointOf?: string;
        readonly centerSnap?: SnapCandidate | null;
      },
    ) => {
      setDocumentState((current) => {
        const command = createAddCircleCommand(center, radiusPoint, {
          construction: createAsConstruction,
          centerMidpointOf: options?.centerMidpointOf,
          centerSnap: options?.centerSnap,
        });
        if (command === null) {
          return current;
        }
        const result = executeCommand(current.history, current.sketch, command);
        return { sketch: result.sketch, history: result.history };
      });
    },
    [createAsConstruction],
  );

  const handleCreateArc = useCallback(
    (center: Point2D, startPoint: Point2D, endPoint: Point2D) => {
      setDocumentState((current) => {
        const command = createAddArcCommand(center, startPoint, endPoint, {
          construction: createAsConstruction,
        });
        if (command === null) {
          return current;
        }
        const result = executeCommand(current.history, current.sketch, command);
        return { sketch: result.sketch, history: result.history };
      });
    },
    [createAsConstruction],
  );

  const handleCommitPointMove = useCallback(
    (target: GeometryDragTarget, from: Point2D, to: Point2D) => {
      setDocumentState((current) => {
        const command = createMoveGeometryCommand(
          current.sketch,
          target,
          from,
          to,
        );
        if (command === null) {
          return current;
        }
        const result = executeCommand(current.history, current.sketch, command);
        return { sketch: result.sketch, history: result.history };
      });
    },
    [],
  );

  const handleCreateCoincident = useCallback(
    (first: ConstraintReference, second: ConstraintReference) => {
      setDocumentState((current) => {
        const command = createAddCoincidentCommand(
          current.sketch,
          first,
          second,
        );
        if (command === null) {
          setConstraintMessage(
            "Coincident could not be added. The picks are invalid or conflict with existing constraints.",
          );
          setConstraintConflict(null);
          return current;
        }
        setConstraintMessage(null);
        setConstraintConflict(null);
        const result = executeCommand(current.history, current.sketch, command);
        return { sketch: result.sketch, history: result.history };
      });
    },
    [],
  );

  const runConstraintCommand = useCallback(
    (
      build: (
        sketch: Sketch,
      ) => ConstraintCommandOutcome | EditDimensionOutcome,
    ) => {
      setDocumentState((current) => {
        const outcome = build(current.sketch);
        if (!outcome.ok) {
          setConstraintMessage(outcome.reason);
          setConstraintConflict(outcome.conflict ?? null);
          return current;
        }
        setConstraintMessage(null);
        setConstraintConflict(null);
        const before = current.sketch;
        const result = executeCommand(current.history, before, outcome.command);
        if (result.sketch === before) {
          setConstraintMessage(
            "Dimension could not be applied. No changes were made.",
          );
          setConstraintConflict(null);
          return current;
        }
        return { sketch: result.sketch, history: result.history };
      });
    },
    [],
  );

  const dismissConstraintConflict = useCallback(() => {
    setConstraintMessage(null);
    setConstraintConflict(null);
  }, []);

  const handleDimensionParseError = useCallback((reason: string) => {
    setConstraintMessage(reason);
    setConstraintConflict(null);
  }, []);

  const handleCreateConstraint = useCallback(
    (request: ConstraintCreateRequest) => {
      runConstraintCommand((live) =>
        createAddMaintainedConstraintCommand(live, request),
      );
    },
    [runConstraintCommand],
  );

  const handleTrim = useCallback((request: TrimExtendRequest) => {
    setDocumentState((current) => {
      const outcome = createTrimCommand(
        current.sketch,
        request.entityId,
        request.clickWorld,
      );
      if (!outcome.ok) {
        setConstraintMessage(outcome.reason);
        setConstraintConflict(null);
        return current;
      }
      setConstraintMessage(null);
      setConstraintConflict(null);
      const result = executeCommand(
        current.history,
        current.sketch,
        outcome.command,
      );
      return { sketch: result.sketch, history: result.history };
    });
  }, []);

  const handleExtend = useCallback((request: TrimExtendRequest) => {
    setDocumentState((current) => {
      const outcome = createExtendCommand(
        current.sketch,
        request.entityId,
        request.clickWorld,
      );
      if (!outcome.ok) {
        setConstraintMessage(outcome.reason);
        setConstraintConflict(null);
        return current;
      }
      setConstraintMessage(null);
      setConstraintConflict(null);
      const result = executeCommand(
        current.history,
        current.sketch,
        outcome.command,
      );
      return { sketch: result.sketch, history: result.history };
    });
  }, []);

  const handleMirror = useCallback(
    (request: MirrorRequest) => {
      setDocumentState((current) => {
        const outcome = createMirrorCommand(
          current.sketch,
          selectedIds,
          request.axis,
        );
        if (!outcome.ok) {
          setConstraintMessage(outcome.reason);
          setConstraintConflict(null);
          return current;
        }
        setConstraintMessage(null);
        setConstraintConflict(null);
        const result = executeCommand(
          current.history,
          current.sketch,
          outcome.command,
        );
        return { sketch: result.sketch, history: result.history };
      });
    },
    [selectedIds],
  );

  const handleFillet = useCallback((request: FilletChamferRequest) => {
    setDocumentState((current) => {
      const outcome = createFilletCommand(current.sketch, request);
      if (!outcome.ok) {
        setConstraintMessage(outcome.reason);
        setConstraintConflict(null);
        return current;
      }
      setConstraintMessage(null);
      setConstraintConflict(null);
      const result = executeCommand(
        current.history,
        current.sketch,
        outcome.command,
      );
      return { sketch: result.sketch, history: result.history };
    });
  }, []);

  const handleChamfer = useCallback((request: FilletChamferRequest) => {
    setDocumentState((current) => {
      const outcome = createChamferCommand(current.sketch, request);
      if (!outcome.ok) {
        setConstraintMessage(outcome.reason);
        setConstraintConflict(null);
        return current;
      }
      setConstraintMessage(null);
      setConstraintConflict(null);
      const result = executeCommand(
        current.history,
        current.sketch,
        outcome.command,
      );
      return { sketch: result.sketch, history: result.history };
    });
  }, []);

  const handleEditDimension = useCallback(
    (constraintId: string, edit: DimensionEdit) => {
      runConstraintCommand((live) =>
        createEditDimensionCommand(live, constraintId, edit),
      );
    },
    [runConstraintCommand],
  );

  const handleCommitDimensionText = useCallback(
    (constraintId: string, text: string) => {
      setDocumentState((current) => {
        const constraint = current.sketch.constraints.find(
          (item) => item.id === constraintId,
        );
        if (
          constraint === undefined ||
          !isSupportedDimensionType(constraint.type)
        ) {
          setConstraintMessage(`Dimension ${constraintId} not found.`);
          setConstraintConflict(null);
          return current;
        }
        const kind = constraint.type === "angle" ? "angle" : "length";
        const parsed = parseDimensionInput(text, kind);
        if (!parsed.ok) {
          setConstraintMessage(parsed.reason);
          setConstraintConflict(null);
          return current;
        }
        const outcome = createEditDimensionCommand(
          current.sketch,
          constraintId,
          {
            value: parsed.value,
          },
        );
        if (!outcome.ok) {
          setConstraintMessage(outcome.reason);
          setConstraintConflict(outcome.conflict ?? null);
          return current;
        }
        setConstraintMessage(null);
        setConstraintConflict(null);
        const before = current.sketch;
        const result = executeCommand(current.history, before, outcome.command);
        if (result.sketch === before) {
          setConstraintMessage(
            "Dimension could not be applied. No changes were made.",
          );
          setConstraintConflict(null);
          return current;
        }
        return { sketch: result.sketch, history: result.history };
      });
    },
    [],
  );

  return {
    sketch,
    history,
    setDocumentState,
    solverResult,
    underConstrained,
    constraintMessage,
    constraintConflict,
    setConstraintMessage,
    setConstraintConflict,
    canUndo: canUndo(history),
    canRedo: canRedo(history),
    undoLabel: peekUndoLabel(history),
    redoLabel: peekRedoLabel(history),
    toggleSelectedConstruction,
    handleUndo,
    handleRedo,
    handleDeleteConstraint,
    handleDeleteSelectedGeometry,
    handleCreatePoint,
    handleCreateLine,
    handleCreateRectangle,
    handleCreateCircle,
    handleCreateArc,
    handleCommitPointMove,
    handleCreateCoincident,
    handleCreateConstraint,
    handleTrim,
    handleExtend,
    handleMirror,
    handleFillet,
    handleChamfer,
    handleEditDimension,
    handleCommitDimensionText,
    dismissConstraintConflict,
    handleDimensionParseError,
  };
}
