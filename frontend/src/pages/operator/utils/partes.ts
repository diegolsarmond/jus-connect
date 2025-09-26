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
    const trimmedValue = value.trim();

    if (!trimmedValue) {
      return false;
    }

    return (
      stringMatchesInterested(trimmedValue) ||
      (allowBooleanMatches && coerceBoolean(trimmedValue))
    );
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

type ParteRecord = Record<string, unknown>;

const collectPartesFromValue = (value: unknown): ParteRecord[] => {
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectPartesFromValue(item));
  }

  if (!value || typeof value !== "object") {
    return [];
  }

  return [value as ParteRecord];
};

const normalizarPartes = (partes: unknown): ParteRecord[] => {
  if (Array.isArray(partes)) {
    return partes.flatMap((parte) => collectPartesFromValue(parte));
  }

  if (partes && typeof partes === "object") {
    return Object.values(partes as Record<string, unknown>).flatMap((value) =>
      collectPartesFromValue(value),
    );
  }

  return [];
};

export const filtrarPartesInteressadas = (partes: unknown): ParteRecord[] =>
  normalizarPartes(partes).filter((parte) => isParteInteressada(parte));

