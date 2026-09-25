/** Outcome callbacks the check reports through. */
export interface VisibleResponseIo {
  pass: () => never;
  fail: (message?: string) => never;
  notApplicable: (why?: string) => never;
}

export function runVisibleResponse(appDir: string, io: VisibleResponseIo): void;
