const MUSTACHE_VARIABLE_REGEX = /{{\s*([\w\.]+)\s*}}/g;
const DATA_VARIABLE_SPAN_REGEX = /<span\b[^>]*\bdata-variable\s*=\s*(["'])([\w.]+)\1[^>]*>(.*?)<\/span>/gis;
const HTML_TAG_REGEX = /<[^>]*>/g;
const BLOCK_BREAK_TAG_REGEX = /<\/(p|div|section|article|blockquote|h[1-6]|li|tr|table|thead|tbody|tfoot)>/gi;
const LIST_ITEM_OPEN_TAG_REGEX = /<li\b[^>]*>/gi;
const LINE_BREAK_TAG_REGEX = /<br\s*\/?\s*>/gi;
const NBSP_REGEX = /&nbsp;/gi;
const hasOwn = Object.prototype.hasOwnProperty;

function stripHtmlTags(value: string): string {
  if (!value) return '';

  const withLineBreaks = value
    .replace(NBSP_REGEX, ' ')
    .replace(LINE_BREAK_TAG_REGEX, '\n')
    .replace(BLOCK_BREAK_TAG_REGEX, '\n')
    .replace(LIST_ITEM_OPEN_TAG_REGEX, '\n• ');

  const withoutTags = withLineBreaks.replace(HTML_TAG_REGEX, '');

  const normalizedLineBreaks = withoutTags
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!normalizedLineBreaks) {
    return '';
  }

  return normalizedLineBreaks.replace(/\n/g, '<br />');
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
