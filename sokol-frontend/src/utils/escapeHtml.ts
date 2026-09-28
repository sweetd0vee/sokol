function replaceHtml(value: string, replacements: Array<[string, string]>) {
  return replacements.reduce((text, [from, to]) => text.replaceAll(from, to), value);
}

/** Text and double-quoted attributes, including apostrophes. */
export function escapeHtml(value: string) {
  return replaceHtml(value, [
    ['&', '&amp;'],
    ['<', '&lt;'],
    ['>', '&gt;'],
    ['"', '&quot;'],
    ["'", '&#39;'],
  ]);
}

/** Matrix HTML: quotes are escaped, apostrophes stay literal. */
export function escapeHtmlQuoted(value: string) {
  return replaceHtml(value, [
    ['&', '&amp;'],
    ['<', '&lt;'],
    ['>', '&gt;'],
    ['"', '&quot;'],
  ]);
}

export function escapeAttr(value: string) {
  return replaceHtml(value, [
    ['&', '&amp;'],
    ['"', '&quot;'],
    ['<', '&lt;'],
    ['>', '&gt;'],
  ]);
}

export function escapeText(value: string) {
  return replaceHtml(value, [
    ['&', '&amp;'],
    ['<', '&lt;'],
    ['>', '&gt;'],
  ]);
}
