import type { DetectedFormat } from '../types';

/**
 * Auto-detect the format of an LLM output string.
 *
 * Detection order:
 * 1. JSON — starts with `{` or `[` and parses successfully.
 * 2. XML — starts with `<` and contains a closing tag.
 * 3. Markdown — contains headings, code fences, or list markers.
 * 4. Text — fallback.
 */
export function detectFormat(output: string): DetectedFormat {
  const trimmed = output.trim();

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      JSON.parse(trimmed);
      return 'json';
    } catch {
      /* not valid JSON */
    }
  }

  if (trimmed.startsWith('<') && /<\/\w+>/.test(trimmed)) {
    return 'xml';
  }

  if (/^#{1,6}\s/m.test(trimmed) || /```/.test(trimmed) || /^[-*]\s/m.test(trimmed)) {
    return 'markdown';
  }

  return 'text';
}
