export const parseOptionalString = (value: unknown): string | null => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  return null;
};

export const ensureArray = <T,>(value: unknown): T[] => {
  if (Array.isArray(value)) {
    return value as T[];
  }

  if (value === null || value === undefined) {
    return [];
  }

  return [value as T];
};

export const toRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
};

export const formatResponseKey = (key: string): string => {
  return key
    .replace(/[_\s]+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase())
    .trim();
};

export interface MetadataEntry {
  key: string;
  label: string;
  value: string | MetadataEntry[];
}

export type FormattedMetadataValue = string | MetadataEntry[];

const isStructuredRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
};

const buildMetadataEntriesFromRecord = (record: Record<string, unknown>): MetadataEntry[] => {
  return Object.entries(record).map(([childKey, childValue]) => ({
    key: childKey,
    label: formatResponseKey(childKey),
    value: formatResponseValue(childValue),
  }));
};

export const isMetadataEntryList = (
  value: FormattedMetadataValue,
): value is MetadataEntry[] => {
  return Array.isArray(value);
};

export const formatResponseValue = (value: unknown): FormattedMetadataValue => {
  if (value === null || value === undefined) {
    return "Não informado";
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : "Não informado";
  }

  if (typeof value === "number") {
    return Number.isFinite(value)
      ? value.toLocaleString("pt-BR")
      : String(value);
  }

  if (typeof value === "boolean") {
    return value ? "Sim" : "Não";
  }

  if (value instanceof Date) {
    return value.toLocaleString("pt-BR");
  }

  if (Array.isArray(value)) {
    const hasStructuredItems = value.some((item) => {
      if (item === null || item === undefined) {
        return false;
      }

      if (item instanceof Date) {
        return false;
      }

      return Array.isArray(item) || isStructuredRecord(item);
    });

    if (!hasStructuredItems) {
      const rendered = value
        .map((item) => formatResponseValue(item))
        .filter((item): item is string => typeof item === "string" && item !== "Não informado");

      return rendered.length > 0 ? rendered.join(", ") : "Não informado";
    }

    return value.map((item, index) => ({
      key: `${index}`,
      label: `Item ${index + 1}`,
      value: formatResponseValue(item),
    }));
  }

  if (isStructuredRecord(value)) {
    return buildMetadataEntriesFromRecord(value);
  }

  return String(value);
};
