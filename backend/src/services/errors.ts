export class MissingDependencyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MissingDependencyError';
  }
}
