import type { ConstraintReference } from "../model/Constraint.ts";
import { handleKey } from "./ConstraintRef.ts";

/**
 * Point-like handles grouped by point–point coincident constraints.
 * Every member of a cluster shares one world position.
 */
export interface HandleClusters {
  /** Stable cluster key; a handle outside any cluster is its own root. */
  rootOf(ref: ConstraintReference): string;
  /** All handles in the same cluster as `ref` (including `ref`). */
  membersOf(ref: ConstraintReference): readonly ConstraintReference[];
  /** Every clustered handle, in first-seen order. */
  readonly clusteredRefs: readonly ConstraintReference[];
}

export function buildHandleClusters(
  pairs: readonly (readonly [ConstraintReference, ConstraintReference])[],
): HandleClusters {
  const parent = new Map<string, string>();
  const refsByKey = new Map<string, ConstraintReference>();

  const find = (key: string): string => {
    const current = parent.get(key) ?? key;
    if (current !== key) {
      const root = find(current);
      parent.set(key, root);
      return root;
    }
    return key;
  };

  for (const [a, b] of pairs) {
    const keyA = handleKey(a);
    const keyB = handleKey(b);
    if (!refsByKey.has(keyA)) {
      refsByKey.set(keyA, a);
    }
    if (!refsByKey.has(keyB)) {
      refsByKey.set(keyB, b);
    }
    const rootA = find(keyA);
    const rootB = find(keyB);
    if (rootA !== rootB) {
      parent.set(rootB, rootA);
    }
  }

  const membersByRoot = new Map<string, ConstraintReference[]>();
  for (const [key, ref] of refsByKey) {
    const root = find(key);
    const members = membersByRoot.get(root) ?? [];
    members.push(ref);
    membersByRoot.set(root, members);
  }

  return {
    rootOf(ref) {
      return find(handleKey(ref));
    },
    membersOf(ref) {
      return membersByRoot.get(find(handleKey(ref))) ?? [ref];
    },
    clusteredRefs: [...refsByKey.values()],
  };
}
