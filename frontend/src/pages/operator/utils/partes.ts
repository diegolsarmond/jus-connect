const INTERESTED_KEY_INDICATOR_SUBSTRINGS = ["interess", "interest"];

const INTERESTED_KEY_CANDIDATES = [
  "role",
  "papel",
  "tipo",
  "type",
  "participacao",
  "participation",
  "funcao",
  "side",
  "categoria",
  "category",
  "qualificacao",
  "classification",
  "identificador",
  "identifier",
  "descricao",
  "description",
  "etiqueta",
  "label",
];

const INTERESTED_VALUE_IDENTIFIERS = ["interess", "interest"];

const BOOLEAN_TRUE_VALUES = new Set(["true", "1", "sim", "yes"]);

const isInterestedKey = (key: string): boolean => {
  const normalizedKey = key.toLowerCase();

  if (
    INTERESTED_KEY_INDICATOR_SUBSTRINGS.some((substring) =>
      normalizedKey.includes(substring),
    )
  ) {
    return true;
  }

  return INTERESTED_KEY_CANDIDATES.some((candidate) =>
    normalizedKey === candidate ||
    normalizedKey.endsWith(`_${candidate}`) ||
    normalizedKey.includes(candidate),
  );
};

const stringMatchesInterested = (value: string): boolean => {
  const normalizedValue = value.toLowerCase();

  return INTERESTED_VALUE_IDENTIFIERS.some((identifier) =>
    normalizedValue.includes(identifier),
  );
};

const coerceBoolean = (value: unknown): boolean => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value === 1;
  }

  if (typeof value === "string") {
    return BOOLEAN_TRUE_VALUES.has(value.trim().toLowerCase());
  }

  return false;
};

const valueContainsInterested = (
  value: unknown,
  allowBooleanMatches: boolean,
): boolean => {
  if (typeof value === "string") {
    return stringMatchesInterested(value) ||
      (allowBooleanMatches && coerceBoolean(value));
  }

  if (typeof value === "boolean" || typeof value === "number") {
    return allowBooleanMatches && coerceBoolean(value);
  }

  if (Array.isArray(value)) {
    return value.some((item) => valueContainsInterested(item, allowBooleanMatches));
  }

  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).some(
      ([nestedKey, nestedValue]) =>
        valueContainsInterested(
          nestedValue,
          allowBooleanMatches || isInterestedKey(nestedKey),
        ),
    );
  }

  return false;
};

export const isParteInteressada = (parte: unknown): boolean => {
  if (!parte || typeof parte !== "object") {
    return false;
  }

  return Object.entries(parte as Record<string, unknown>).some(
    ([key, value]) =>
      valueContainsInterested(value, isInterestedKey(key)) ||
      (typeof value === "string" && stringMatchesInterested(value)),
  );
};

export const filtrarPartesInteressadas = <T extends unknown>(
  partes: T[],
): T[] =>
  partes.filter((parte) => isParteInteressada(parte));

