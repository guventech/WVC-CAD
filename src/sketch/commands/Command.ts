import type { Sketch } from "../model/Sketch.ts";

/**
 * Immutable sketch transform with an inverse.
 * Prefer this over mutating React state ad hoc.
 */
export interface SketchCommand {
  readonly label: string;
  apply(sketch: Sketch): Sketch;
  /** Applied to the post-`apply` sketch to restore the prior sketch. */
  undo(sketch: Sketch): Sketch;
}

export interface CommandHistory {
  readonly undoStack: readonly SketchCommand[];
  readonly redoStack: readonly SketchCommand[];
}

export function createCommandHistory(): CommandHistory {
  return {
    undoStack: [],
    redoStack: [],
  };
}

export function executeCommand(
  history: CommandHistory,
  sketch: Sketch,
  command: SketchCommand,
): { readonly sketch: Sketch; readonly history: CommandHistory } {
  const nextSketch = command.apply(sketch);
  if (nextSketch === sketch) {
    return { sketch, history };
  }

  return {
    sketch: nextSketch,
    history: {
      undoStack: [...history.undoStack, command],
      redoStack: [],
    },
  };
}

export function undoCommand(
  history: CommandHistory,
  sketch: Sketch,
): { readonly sketch: Sketch; readonly history: CommandHistory } {
  if (history.undoStack.length === 0) {
    return { sketch, history };
  }

  const command = history.undoStack[history.undoStack.length - 1]!;
  const previous = command.undo(sketch);

  return {
    sketch: previous,
    history: {
      undoStack: history.undoStack.slice(0, -1),
      redoStack: [...history.redoStack, command],
    },
  };
}

export function redoCommand(
  history: CommandHistory,
  sketch: Sketch,
): { readonly sketch: Sketch; readonly history: CommandHistory } {
  if (history.redoStack.length === 0) {
    return { sketch, history };
  }

  const command = history.redoStack[history.redoStack.length - 1]!;
  const next = command.apply(sketch);

  return {
    sketch: next,
    history: {
      undoStack: [...history.undoStack, command],
      redoStack: history.redoStack.slice(0, -1),
    },
  };
}

export function canUndo(history: CommandHistory): boolean {
  return history.undoStack.length > 0;
}

export function canRedo(history: CommandHistory): boolean {
  return history.redoStack.length > 0;
}

/** Drop undo/redo stacks (e.g. after load). Sketch is unchanged. */
export function clearCommandHistory(): CommandHistory {
  return createCommandHistory();
}

export function peekUndoLabel(history: CommandHistory): string | null {
  const command = history.undoStack[history.undoStack.length - 1];
  return command?.label ?? null;
}

export function peekRedoLabel(history: CommandHistory): string | null {
  const command = history.redoStack[history.redoStack.length - 1];
  return command?.label ?? null;
}
