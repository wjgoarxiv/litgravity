export class VisualQaError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "VisualQaError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

export function messageOf(error) {
  return error instanceof Error ? error.message : String(error);
}
