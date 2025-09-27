const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DIGITS_REGEX = /^\d+$/;

export function normalizeFinancialFlowIdentifier(value: unknown): number | string | null {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value > 0 ? value : null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    if (DIGITS_REGEX.test(trimmed)) {
      const parsed = Number.parseInt(trimmed, 10);
      return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
    }

    if (UUID_REGEX.test(trimmed)) {
      return trimmed;
    }

    return null;
  }

  return null;
}

export function requireFinancialFlowIdentifier(value: unknown, errorFactory?: () => Error): number | string {
  const normalized = normalizeFinancialFlowIdentifier(value);
  if (normalized === null) {
    if (errorFactory) {
      throw errorFactory();
    }
    throw new Error('Identificador do fluxo financeiro inválido');
  }

  return normalized;
}

export function normalizeFinancialFlowIdentifierFromRow(value: unknown): number | string {
  const normalized = normalizeFinancialFlowIdentifier(value);
  if (normalized === null) {
    throw new Error('Identificador do fluxo financeiro inválido');
  }

  return normalized;
}
