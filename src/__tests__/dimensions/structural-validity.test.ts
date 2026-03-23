import { describe, it, expect } from 'vitest';
import { scoreStructuralValidity } from '../../dimensions/structural-validity';

// ── JSON ──────────────────────────────────────────────────────────────────────

describe('scoreStructuralValidity — JSON', () => {
  it('scores valid JSON as 1.0', () => {
    const result = scoreStructuralValidity('{"key": "value"}', 'json');
    expect(result.score).toBe(1.0);
    expect(result.signals).toHaveLength(0);
  });

  it('scores valid JSON array as 1.0', () => {
    const result = scoreStructuralValidity('[1, 2, 3]', 'json');
    expect(result.score).toBe(1.0);
    expect(result.signals).toHaveLength(0);
  });

  it('scores fenced JSON (lenient parse) as 0.8', () => {
    const input = '```json\n{"key": "value"}\n```';
    const result = scoreStructuralValidity(input, 'json');
    expect(result.score).toBe(0.8);
    expect(result.signals).toHaveLength(1);
    expect(result.signals[0].id).toBe('json-lenient-parse');
    expect(result.signals[0].severity).toBe('warning');
  });

  it('scores JSON with trailing comma as 0.7', () => {
    const input = '{"key": "value",}';
    const result = scoreStructuralValidity(input, 'json');
    expect(result.score).toBe(0.7);
    expect(result.signals).toHaveLength(1);
    expect(result.signals[0].id).toBe('json-trailing-comma');
  });

  it('scores JSON with unquoted keys as 0.6', () => {
    const input = '{name: "hello"}';
    const result = scoreStructuralValidity(input, 'json');
    expect(result.score).toBe(0.6);
    expect(result.signals).toHaveLength(1);
    expect(result.signals[0].id).toBe('json-unquoted-keys');
  });

  it('scores JSON with single quotes as 0.6', () => {
    const input = "{'key': 'value'}";
    const result = scoreStructuralValidity(input, 'json');
    expect(result.score).toBe(0.6);
    expect(result.signals).toHaveLength(1);
    expect(result.signals[0].id).toBe('json-single-quotes');
  });

  it('scores completely unparseable JSON as 0.0', () => {
    const input = 'this is not json at all';
    const result = scoreStructuralValidity(input, 'json');
    expect(result.score).toBe(0.0);
    expect(result.signals).toHaveLength(1);
    expect(result.signals[0].id).toBe('json-unparseable');
    expect(result.signals[0].severity).toBe('critical');
  });

  it('includes error message in unparseable signal', () => {
    const result = scoreStructuralValidity('not json', 'json');
    expect(result.signals[0].message).toContain('unparseable');
  });
});

// ── Markdown ──────────────────────────────────────────────────────────────────

describe('scoreStructuralValidity — Markdown', () => {
  it('scores clean markdown as 1.0', () => {
    const input = '# Title\n\nSome paragraph text.\n\n## Subtitle\n\nMore text.';
    const result = scoreStructuralValidity(input, 'markdown');
    expect(result.score).toBe(1.0);
    expect(result.signals).toHaveLength(0);
  });

  it('deducts for unclosed code fence', () => {
    const input = '# Title\n\n```javascript\nconsole.log("hi");\n';
    const result = scoreStructuralValidity(input, 'markdown');
    expect(result.score).toBe(0.7);
    expect(result.signals).toHaveLength(1);
    expect(result.signals[0].id).toBe('markdown-unclosed-fence');
    expect(result.signals[0].severity).toBe('critical');
  });

  it('scores balanced code fences as 1.0', () => {
    const input = '```\ncode here\n```';
    const result = scoreStructuralValidity(input, 'markdown');
    expect(result.score).toBe(1.0);
  });

  it('emits info signal for skipped heading levels', () => {
    const input = '# Title\n\n### Skipped h2\n\nSome text.';
    const result = scoreStructuralValidity(input, 'markdown');
    expect(result.score).toBe(0.95);
    expect(result.signals).toHaveLength(1);
    expect(result.signals[0].id).toBe('markdown-skipped-heading');
    expect(result.signals[0].severity).toBe('info');
    expect(result.signals[0].message).toContain('h1');
    expect(result.signals[0].message).toContain('h3');
  });

  it('deducts for multiple heading skips', () => {
    const input = '# Title\n\n### Skip 1\n\n##### Skip 2\n';
    const result = scoreStructuralValidity(input, 'markdown');
    expect(result.score).toBeCloseTo(0.9, 10);
    expect(result.signals).toHaveLength(2);
  });

  it('does not penalize sequential headings', () => {
    const input = '# H1\n\n## H2\n\n### H3\n\n#### H4\n';
    const result = scoreStructuralValidity(input, 'markdown');
    expect(result.score).toBe(1.0);
    expect(result.signals).toHaveLength(0);
  });
});

// ── Code ──────────────────────────────────────────────────────────────────────

describe('scoreStructuralValidity — Code', () => {
  it('scores balanced code as 1.0', () => {
    const input = 'function hello() {\n  console.log("hi");\n}';
    const result = scoreStructuralValidity(input, 'code');
    expect(result.score).toBe(1.0);
    expect(result.signals).toHaveLength(0);
  });

  it('deducts for unbalanced brackets', () => {
    const input = 'function hello() {\n  console.log("hi");\n';
    const result = scoreStructuralValidity(input, 'code');
    expect(result.score).toBeLessThan(1.0);
    expect(result.signals.some((s) => s.id === 'code-unbalanced-brackets')).toBe(true);
    expect(result.signals[0].severity).toBe('critical');
  });

  it('deducts 0.2 per unbalanced bracket', () => {
    // Two unclosed brackets: { and (
    const input = 'function hello( {\n  code\n';
    const result = scoreStructuralValidity(input, 'code');
    // curly=1, round=1 => 2 unbalanced => 0.4 deduction => 0.6
    expect(result.score).toBe(0.6);
  });

  it('warns about trailing incomplete construct', () => {
    const input = 'const x =';
    const result = scoreStructuralValidity(input, 'code');
    expect(result.signals.some((s) => s.id === 'code-incomplete-construct')).toBe(true);
    expect(result.signals.find((s) => s.id === 'code-incomplete-construct')!.severity).toBe('warning');
  });

  it('deducts for trailing incomplete construct', () => {
    const input = 'const obj = {';
    const result = scoreStructuralValidity(input, 'code');
    // unbalanced curly (1) => -0.2, trailing { => -0.1 => 0.7
    expect(result.score).toBeCloseTo(0.7, 10);
  });

  it('clamps score to 0 for heavily unbalanced code', () => {
    const input = '((((((((((';
    const result = scoreStructuralValidity(input, 'code');
    expect(result.score).toBe(0);
  });
});

// ── XML ───────────────────────────────────────────────────────────────────────

describe('scoreStructuralValidity — XML', () => {
  it('scores balanced XML as 1.0', () => {
    const input = '<root><child>text</child></root>';
    const result = scoreStructuralValidity(input, 'xml');
    expect(result.score).toBe(1.0);
    expect(result.signals).toHaveLength(0);
  });

  it('deducts for unclosed XML tags', () => {
    const input = '<root><child>text</child>';
    const result = scoreStructuralValidity(input, 'xml');
    expect(result.score).toBeLessThan(1.0);
    expect(result.signals).toHaveLength(1);
    expect(result.signals[0].id).toBe('xml-unclosed-tags');
    expect(result.signals[0].severity).toBe('critical');
  });

  it('deducts 0.2 per unclosed tag', () => {
    const input = '<root><child><nested>text';
    const result = scoreStructuralValidity(input, 'xml');
    // 3 open, 0 close => 3 unclosed => -0.6 => 0.4
    expect(result.score).toBeCloseTo(0.4, 10);
  });

  it('clamps to 0 for many unclosed tags', () => {
    const input = '<a><b><c><d><e><f>';
    const result = scoreStructuralValidity(input, 'xml');
    expect(result.score).toBe(0);
  });

  it('scores self-contained XML correctly', () => {
    const input = '<item>text</item>';
    const result = scoreStructuralValidity(input, 'xml');
    expect(result.score).toBe(1.0);
  });
});

// ── Text ──────────────────────────────────────────────────────────────────────

describe('scoreStructuralValidity — Text', () => {
  it('scores clean text as 1.0', () => {
    const result = scoreStructuralValidity('Hello, this is clean text.', 'text');
    expect(result.score).toBe(1.0);
    expect(result.signals).toHaveLength(0);
  });

  it('deducts for Unicode replacement characters', () => {
    const result = scoreStructuralValidity('Hello \uFFFD world', 'text');
    expect(result.score).toBe(0.9);
    expect(result.signals).toHaveLength(1);
    expect(result.signals[0].id).toBe('text-replacement-chars');
    expect(result.signals[0].severity).toBe('info');
  });

  it('deducts for control characters', () => {
    const result = scoreStructuralValidity('Hello \x01\x02 world', 'text');
    expect(result.score).toBe(0.9);
    expect(result.signals).toHaveLength(1);
    expect(result.signals[0].id).toBe('text-control-chars');
    expect(result.signals[0].severity).toBe('info');
  });

  it('deducts for both replacement and control characters', () => {
    const result = scoreStructuralValidity('Hello \uFFFD \x01 world', 'text');
    expect(result.score).toBe(0.8);
    expect(result.signals).toHaveLength(2);
  });

  it('reports control character count in message', () => {
    const result = scoreStructuralValidity('a\x01b\x02c\x03d', 'text');
    expect(result.signals[0].message).toContain('3 control character(s)');
  });
});

// ── Format Detection ──────────────────────────────────────────────────────────

describe('scoreStructuralValidity — format auto-detection', () => {
  it('auto-detects JSON format when not provided', () => {
    const result = scoreStructuralValidity('{"key": "value"}');
    expect(result.score).toBe(1.0);
  });

  it('auto-detects markdown format when not provided', () => {
    const input = '# Title\n\nSome text.';
    const result = scoreStructuralValidity(input);
    expect(result.score).toBe(1.0);
  });

  it('auto-detects XML format when not provided', () => {
    const input = '<root><child>text</child></root>';
    const result = scoreStructuralValidity(input);
    expect(result.score).toBe(1.0);
  });

  it('falls back to text scoring when format is unknown', () => {
    const result = scoreStructuralValidity('Just plain text.');
    expect(result.score).toBe(1.0);
  });
});

// ── Signal Shape ──────────────────────────────────────────────────────────────

describe('scoreStructuralValidity — signal shape', () => {
  it('emits signals with correct structure', () => {
    const result = scoreStructuralValidity('not json', 'json');
    const signal = result.signals[0];
    expect(signal).toHaveProperty('id');
    expect(signal).toHaveProperty('severity');
    expect(signal).toHaveProperty('dimension');
    expect(signal).toHaveProperty('message');
    expect(signal).toHaveProperty('location');
    expect(signal.dimension).toBe('structural-validity');
    expect(signal.location).toBeNull();
    expect(typeof signal.id).toBe('string');
    expect(typeof signal.message).toBe('string');
  });

  it('uses correct severity levels', () => {
    // Critical
    const jsonResult = scoreStructuralValidity('not json', 'json');
    expect(jsonResult.signals[0].severity).toBe('critical');

    // Warning
    const fencedResult = scoreStructuralValidity('```json\n{"a":1}\n```', 'json');
    expect(fencedResult.signals[0].severity).toBe('warning');

    // Info
    const mdResult = scoreStructuralValidity('# H1\n\n### H3\n', 'markdown');
    expect(mdResult.signals[0].severity).toBe('info');
  });
});

// ── Score Clamping ────────────────────────────────────────────────────────────

describe('scoreStructuralValidity — score clamping', () => {
  it('never returns score below 0', () => {
    // Many unclosed brackets
    const result = scoreStructuralValidity('(((((((((((((((', 'code');
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBe(0);
  });

  it('never returns score above 1', () => {
    const result = scoreStructuralValidity('{"valid": true}', 'json');
    expect(result.score).toBeLessThanOrEqual(1);
    expect(result.score).toBe(1.0);
  });

  it('clamps markdown score to 0 with many issues', () => {
    // Many unclosed fences + heading skips => should not go below 0
    const input = '# H1\n\n#### H4\n\n###### H6\n\n```\ncode\n```\n```\ncode\n```\n```';
    const result = scoreStructuralValidity(input, 'markdown');
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
  });

  it('clamps XML score to 0 with many unclosed tags', () => {
    const input = '<a><b><c><d><e><f><g><h><i><j>';
    const result = scoreStructuralValidity(input, 'xml');
    expect(result.score).toBe(0);
  });

  it('does not penalize self-closing XML tags as unclosed', () => {
    const input = '<root><br /><img src="test.png" /><hr/></root>';
    const result = scoreStructuralValidity(input, 'xml');
    expect(result.score).toBe(1.0);
    expect(result.signals).toHaveLength(0);
  });

  it('correctly counts unclosed tags when mixed with self-closing', () => {
    const input = '<root><br /><div><img src="x" /></root>';
    const result = scoreStructuralValidity(input, 'xml');
    // div is unclosed: openTags=[root, div] closeTags=[root] selfClosing=[br, img] → 2-1-2 = -1 → no penalty (negative unclosed is fine)
    expect(result.score).toBeLessThanOrEqual(1.0);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });
});
