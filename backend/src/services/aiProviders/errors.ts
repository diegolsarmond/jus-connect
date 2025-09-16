export class AiProviderError extends Error {
  constructor(message: string, public readonly statusCode = 502) {
    super(message);
    this.name = 'AiProviderError';
  }
}

