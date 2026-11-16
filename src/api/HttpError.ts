export class HttpError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`Country search failed: HTTP ${status}`);
    this.name = 'HttpError';
    this.status = status;
  }
}
