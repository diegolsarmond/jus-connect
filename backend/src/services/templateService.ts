const MUSTACHE_VARIABLE_REGEX = /{{\s*([\w\.]+)\s*}}/g;
const DATA_VARIABLE_SPAN_REGEX = /<span\b[^>]*\bdata-variable\s*=\s*(["'])([\w.]+)\1[^>]*>(.*?)<\/span>/gis;
const HTML_TAG_REGEX = /<[^>]*>/g;
const NBSP_REGEX = /&nbsp;/gi;
const hasOwn = Object.prototype.hasOwnProperty;

function stripHtmlTags(value: string): string {
  if (!value) return '';
  return value.replace(HTML_TAG_REGEX, '').replace(NBSP_REGEX, ' ');
}

export function resolveVariableValue(
  values: Record<string, string | number>,
  key: string,
): string | undefined {
  if (hasOwn.call(values, key)) {
    const value = values[key];
    if (value !== undefined && value !== null) {
      return String(value);
    }
  }
  return undefined;
}

export function replaceVariables(
  content: string,
  values: Record<string, string | number>,
): string {
  const withSpansReplaced = content.replace(
    DATA_VARIABLE_SPAN_REGEX,
    (_match, _quote, key: string, innerHtml: string) => {
      const resolved = resolveVariableValue(values, key);
      if (resolved !== undefined) {
        return resolved;
      }
      return stripHtmlTags(innerHtml);
    },
  );

  return withSpansReplaced.replace(
    MUSTACHE_VARIABLE_REGEX,
    (_match, key: string) => {
      const resolved = resolveVariableValue(values, key);
      return resolved !== undefined ? resolved : `{{${key}}}`;
    },
  );
}
