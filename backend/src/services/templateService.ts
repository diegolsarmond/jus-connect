export function replaceVariables(
  content: string,
  values: Record<string, string | number>
): string {
  return content.replace(/{{\s*([\w\.]+)\s*}}/g, (match, key) => {
    const value = values[key];
    return value !== undefined ? String(value) : match;
  });
}
