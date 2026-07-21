export interface CollisionTask {
  id: string;
  files: string[];
}

export interface CollisionPlan {
  /** Tasks whose file sets are disjoint from every other task; safe to run concurrently. */
  parallelizable: string[];
  /** Tasks that share at least one file with another task; must be serialized. */
  serialized: string[];
}

/**
 * Conservative collision analysis: a task is parallelizable only if its file set
 * does not overlap any other task's. Any overlap forces serialization, so two
 * runs never edit the same file at once (rules/loop-gate.md: lg-collision-serialize).
 */
export function analyzeCollisions(tasks: CollisionTask[]): CollisionPlan {
  const overlaps = (a: CollisionTask, b: CollisionTask): boolean =>
    a.files.some((f) => b.files.includes(f));

  const parallelizable: string[] = [];
  const serialized: string[] = [];
  for (const t of tasks) {
    const conflicts = tasks.some((o) => o.id !== t.id && overlaps(t, o));
    (conflicts ? serialized : parallelizable).push(t.id);
  }
  return { parallelizable, serialized };
}
