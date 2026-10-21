export class UiuxContractError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "UiuxContractError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

export function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
