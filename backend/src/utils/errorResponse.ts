interface ResolveErrorMessageOptions {
  expose?: boolean;
}

const isErrorWithMessage = (error: unknown): error is { message: unknown } =>
  typeof error === 'object' && error !== null && 'message' in error;

const extractErrorMessage = (error: unknown): string | undefined => {
  if (error instanceof Error && typeof error.message === 'string') {
    return error.message;
  }

  if (isErrorWithMessage(error) && typeof error.message === 'string') {
    return error.message;
  }

  return undefined;
};

export const resolveErrorMessage = (
  error: unknown,
  fallback: string,
  options: ResolveErrorMessageOptions = {}
): string => {
  const message = extractErrorMessage(error);
  const normalizedFallback = fallback && fallback.trim() ? fallback : 'Internal server error';

  if (options.expose) {
    return message ?? normalizedFallback;
  }

  if (process.env.NODE_ENV && process.env.NODE_ENV !== 'production') {
    return message ?? normalizedFallback;
  }

  return normalizedFallback;
};

export const buildErrorResponse = (
  error: unknown,
  fallback: string,
  options?: ResolveErrorMessageOptions
): { error: string } => ({
  error: resolveErrorMessage(error, fallback, options),
});

export type { ResolveErrorMessageOptions };
