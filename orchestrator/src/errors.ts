/** Raised when a payload fails schema validation at a boundary. */
export class ValidationError extends Error {
  readonly issues: string[];
  constructor(message: string, issues: string[]) {
    super(message);
    this.name = 'ValidationError';
    this.issues = issues;
  }
}
