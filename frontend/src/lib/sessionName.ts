const removeAccents = (value: string): string =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").normalize("NFC");

const capitalizeSegment = (segment: string): string => {
  if (!segment) {
    return "";
  }
  const first = segment.charAt(0).toUpperCase();
  const rest = segment.slice(1).toLowerCase();
  return `${first}${rest}`;
};

export const sanitizeSessionName = (rawValue: string | null | undefined): string => {
  if (typeof rawValue !== "string") {
    return "";
  }

  const trimmed = rawValue.trim();
  if (!trimmed) {
    return "";
  }

  const normalized = removeAccents(trimmed);
  const segments = normalized.split(/[^A-Za-z0-9]+/).filter(Boolean);
  if (segments.length === 0) {
    return "";
  }

  return segments.map(capitalizeSegment).join("");
};
