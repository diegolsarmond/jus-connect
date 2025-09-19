const DATAJUD_ALIAS_PATTERN = /api_publica_[a-z0-9_-]+/;

const sanitizeAliasSegment = (segment: string): string => {
  const cleaned = segment.replace(/[^a-z0-9_-]/g, '');
  return cleaned;
};

export const canonicalizeDatajudAlias = (
  value: unknown,
): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const lower = trimmed.toLowerCase();

  const directMatch = lower.match(DATAJUD_ALIAS_PATTERN);
  if (directMatch && directMatch[0]) {
    return directMatch[0];
  }

  let candidate = lower;

  if (candidate.includes('://')) {
    try {
      const url = new URL(candidate);
      candidate = url.pathname;
    } catch (error) {
      // ignore invalid URL and fallback to manual normalization
    }
  }

  candidate = candidate
    .replace(/^https?:\/\//, '')
    .replace(/^(?:www\.)?(?:api[-_]?publica\.)?datajud\.cnj\.jus\.br/, '')
    .replace(/^\/+/, '');

  const withoutQueryOrFragment = candidate.split(/[?#]/)[0] ?? '';
  if (!withoutQueryOrFragment) {
    return null;
  }

  const firstSegment = withoutQueryOrFragment.split('/')[0] ?? '';
  const sanitizedSegment = sanitizeAliasSegment(firstSegment);

  if (!sanitizedSegment) {
    return null;
  }

  const withoutPrefix = sanitizedSegment.replace(/^api_publica_/, '');
  if (!withoutPrefix) {
    return null;
  }

  return `api_publica_${withoutPrefix}`;
};
