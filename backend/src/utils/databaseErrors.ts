export function isUndefinedTableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' && code.toUpperCase() === '42P01';
}

