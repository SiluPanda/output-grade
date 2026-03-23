import { describe, it, expect } from 'vitest';
import { scoreFormatCompliance } from '../../dimensions/format-compliance';

// ── No Format / No Prompt (Neutral) ──────────────────────────────────────────

describe('scoreFormatCompliance — neutral', () => {
  it('returns 1.0 when no format and no prompt provided', () => {
    const result = scoreFormatCompliance('Some random text.');
    expect(result.score).toBe(1.0);
    expect(result.signals).toHaveLength(0);
  });

  it('returns 1.0 when format is undefined and prompt is undefined', () => {
    const result = scoreFormatCompliance('Output text.', undefined, undefined);
    expect(result.score).toBe(1.0);
    expect(result.signals).toHaveLength(0);
  });

  it('returns 1.0 when prompt has no format keywords', () => {
    const result = scoreFormatCompliance(
      'Some output.',
      undefined,
      'Tell me about cats',
    );
    expect(result.score).toBe(1.0);
    expect(result.signals).toHaveLength(0);
  });
});

// ── JSON Compliance ──────────────────────────────────────────────────────────

describe('scoreFormatCompliance — JSON', () => {
  it('scores pure JSON as 1.0', () => {
    const result = scoreFormatCompliance('{"name": "test", "value": 42}', 'json');
    expect(result.score).toBe(1.0);
    expect(result.signals).toHaveLength(0);
  });

  it('scores JSON array as 1.0', () => {
    const result = scoreFormatCompliance('[1, 2, 3]', 'json');
    expect(result.score).toBe(1.0);
  });

  it('scores JSON in code fence as 0.9', () => {
    const input = '```json\n{"key": "value"}\n```';
    const result = scoreFormatCompliance(input, 'json');
    expect(result.score).toBe(0.9);
    expect(result.signals).toHaveLength(1);
    expect(result.signals[0].id).toBe('format-json-in-fence');
    expect(result.signals[0].severity).toBe('info');
  });

  it('scores JSON embedded in prose as 0.7', () => {
    const input = 'Here is the result:\n{"name": "test"}\nThat was the JSON.';
    const result = scoreFormatCompliance(input, 'json');
    expect(result.score).toBe(0.7);
    expect(result.signals).toHaveLength(1);
    expect(result.signals[0].id).toBe('format-json-in-prose');
    expect(result.signals[0].severity).toBe('warning');
  });

  it('scores prose with no JSON as 0.0', () => {
    const input = 'There is no JSON here at all, just plain text.';
    const result = scoreFormatCompliance(input, 'json');
    expect(result.score).toBe(0.0);
    expect(result.signals).toHaveLength(1);
    expect(result.signals[0].id).toBe('format-no-json');
    expect(result.signals[0].severity).toBe('critical');
  });
});

// ── Markdown Compliance ──────────────────────────────────────────────────────

describe('scoreFormatCompliance — Markdown', () => {
  it('scores rich markdown as 1.0', () => {
    const input =
      '# Title\n\n- Item 1\n- Item 2\n\n**Bold text** and [link](url)\n\n```code```';
    const result = scoreFormatCompliance(input, 'markdown');
    expect(result.score).toBe(1.0);
    expect(result.signals).toHaveLength(0);
  });

  it('scores minimal markdown as 0.7', () => {
    const input = '# Just a heading\n\nSome plain text without other formatting.';
    const result = scoreFormatCompliance(input, 'markdown');
    expect(result.score).toBe(0.7);
    expect(result.signals.some((s) => s.id === 'format-minimal-markdown')).toBe(true);
  });

  it('scores plain text as 0.3', () => {
    const input = 'This is just plain text with no markdown formatting at all.';
    const result = scoreFormatCompliance(input, 'markdown');
    expect(result.score).toBe(0.3);
    expect(result.signals.some((s) => s.id === 'format-no-markdown')).toBe(true);
  });
});

// ── Code Compliance ──────────────────────────────────────────────────────────

describe('scoreFormatCompliance — Code', () => {
  it('scores code in fence as 1.0', () => {
    const input = '```typescript\nfunction hello() {\n  return "hi";\n}\n```';
    const result = scoreFormatCompliance(input, 'code');
    expect(result.score).toBe(1.0);
    expect(result.signals).toHaveLength(0);
  });

  it('scores recognizable code without fence as 0.8', () => {
    const input = 'function hello() {\n  return "hi";\n}';
    const result = scoreFormatCompliance(input, 'code');
    expect(result.score).toBe(0.8);
    expect(result.signals.some((s) => s.id === 'format-code-no-fence')).toBe(true);
  });

  it('scores no code as 0.0', () => {
    const input = 'This is just a plain description of the task requirements.';
    const result = scoreFormatCompliance(input, 'code');
    expect(result.score).toBe(0.0);
    expect(result.signals.some((s) => s.id === 'format-no-code')).toBe(true);
  });
});

// ── XML Compliance ───────────────────────────────────────────────────────────

describe('scoreFormatCompliance — XML', () => {
  it('scores well-formed XML as 1.0', () => {
    const input = '<root><item>text</item></root>';
    const result = scoreFormatCompliance(input, 'xml');
    expect(result.score).toBe(1.0);
  });

  it('scores partial XML as 0.5', () => {
    const input = '<item>unclosed content';
    const result = scoreFormatCompliance(input, 'xml');
    expect(result.score).toBe(0.5);
    expect(result.signals.some((s) => s.id === 'format-partial-xml')).toBe(true);
  });

  it('scores no XML as 0.0', () => {
    const input = 'Just plain text, no XML.';
    const result = scoreFormatCompliance(input, 'xml');
    expect(result.score).toBe(0.0);
  });
});

// ── List Compliance ──────────────────────────────────────────────────────────

describe('scoreFormatCompliance — List', () => {
  it('scores bullet list as 1.0', () => {
    const input = '- Item 1\n- Item 2\n- Item 3';
    const result = scoreFormatCompliance(input, 'list');
    expect(result.score).toBe(1.0);
  });

  it('scores numbered list as 1.0', () => {
    const input = '1. First\n2. Second\n3. Third';
    const result = scoreFormatCompliance(input, 'list');
    expect(result.score).toBe(1.0);
  });

  it('scores paragraphs instead of list as 0.3', () => {
    const input = 'First paragraph about something.\n\nSecond paragraph about another thing.';
    const result = scoreFormatCompliance(input, 'list');
    expect(result.score).toBe(0.3);
    expect(result.signals.some((s) => s.id === 'format-paragraphs-not-list')).toBe(true);
  });

  it('scores no list content as 0.0', () => {
    const input = 'Just a single line of text.';
    const result = scoreFormatCompliance(input, 'list');
    expect(result.score).toBe(0.0);
    expect(result.signals.some((s) => s.id === 'format-no-list')).toBe(true);
  });
});

// ── YAML Compliance ──────────────────────────────────────────────────────────

describe('scoreFormatCompliance — YAML', () => {
  it('scores valid YAML key-value pairs as 1.0', () => {
    const input = 'name: John\nage: 30\ncity: NYC';
    const result = scoreFormatCompliance(input, 'yaml');
    expect(result.score).toBe(1.0);
  });

  it('scores single key-value as 0.5', () => {
    const input = 'name: John\nJust some text.';
    const result = scoreFormatCompliance(input, 'yaml');
    expect(result.score).toBe(0.5);
  });

  it('scores no YAML as 0.0', () => {
    const input = 'No yaml here at all!';
    const result = scoreFormatCompliance(input, 'yaml');
    expect(result.score).toBe(0.0);
  });
});

// ── Table Compliance ─────────────────────────────────────────────────────────

describe('scoreFormatCompliance — Table', () => {
  it('scores markdown table as 1.0', () => {
    const input = '| Name | Age |\n|------|-----|\n| John | 30  |';
    const result = scoreFormatCompliance(input, 'table');
    expect(result.score).toBe(1.0);
  });

  it('scores list found instead of table as 0.4', () => {
    const input = '- Name: John\n- Age: 30';
    const result = scoreFormatCompliance(input, 'table');
    expect(result.score).toBe(0.4);
    expect(result.signals.some((s) => s.id === 'format-list-not-table')).toBe(true);
  });

  it('scores no table content as 0.0', () => {
    const input = 'Just plain text without any table structure.';
    const result = scoreFormatCompliance(input, 'table');
    expect(result.score).toBe(0.0);
  });
});

// ── Prompt-Based Detection ───────────────────────────────────────────────────

describe('scoreFormatCompliance — prompt detection', () => {
  it('detects JSON from prompt', () => {
    const result = scoreFormatCompliance(
      '{"result": true}',
      undefined,
      'Return the result as JSON',
    );
    expect(result.score).toBe(1.0);
  });

  it('detects code from prompt with "function" keyword', () => {
    const result = scoreFormatCompliance(
      '```\nfunction add(a, b) { return a + b; }\n```',
      undefined,
      'Write a function to add two numbers',
    );
    expect(result.score).toBe(1.0);
  });

  it('detects list from prompt with "list" keyword', () => {
    const result = scoreFormatCompliance(
      '- Item 1\n- Item 2',
      undefined,
      'Give me a list of items',
    );
    expect(result.score).toBe(1.0);
  });

  it('explicit format overrides prompt detection', () => {
    // Prompt says "json" but format is explicitly "markdown"
    const result = scoreFormatCompliance(
      '# Title\n\n- Item\n\n**Bold** text',
      'markdown',
      'Return JSON',
    );
    // Evaluated as markdown, not JSON
    expect(result.score).toBeGreaterThanOrEqual(0.7);
  });
});

// ── Signal Shape ─────────────────────────────────────────────────────────────

describe('scoreFormatCompliance — signal shape', () => {
  it('emits signals with correct structure', () => {
    const result = scoreFormatCompliance('no json here', 'json');
    expect(result.signals.length).toBeGreaterThan(0);
    for (const signal of result.signals) {
      expect(signal).toHaveProperty('id');
      expect(signal).toHaveProperty('severity');
      expect(signal).toHaveProperty('dimension');
      expect(signal).toHaveProperty('message');
      expect(signal).toHaveProperty('location');
      expect(signal.dimension).toBe('format-compliance');
      expect(signal.location).toBeNull();
      expect(typeof signal.id).toBe('string');
      expect(typeof signal.message).toBe('string');
      expect(['info', 'warning', 'critical']).toContain(signal.severity);
    }
  });
});

// ── Score Clamping ───────────────────────────────────────────────────────────

describe('scoreFormatCompliance — score clamping', () => {
  it('never returns score below 0', () => {
    const result = scoreFormatCompliance('random text', 'json');
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it('never returns score above 1', () => {
    const result = scoreFormatCompliance('{"valid": true}', 'json');
    expect(result.score).toBeLessThanOrEqual(1);
  });

  it('score is always a finite number', () => {
    const inputs: [string, string | undefined, string | undefined][] = [
      ['hello', undefined, undefined],
      ['{"a":1}', 'json', undefined],
      ['# Title', 'markdown', undefined],
      ['text', undefined, 'return json'],
      ['<root></root>', 'xml', undefined],
    ];
    for (const [output, format, prompt] of inputs) {
      const result = scoreFormatCompliance(output, format, prompt);
      expect(Number.isFinite(result.score)).toBe(true);
    }
  });

  it('detects JSON in code fence without newlines around content', () => {
    const input = '```json{"key":"value"}```';
    const result = scoreFormatCompliance(input, 'json');
    expect(result.score).toBeGreaterThanOrEqual(0.9);
  });

  it('detects JSON in code fence with newlines (standard format)', () => {
    const input = '```json\n{"key":"value"}\n```';
    const result = scoreFormatCompliance(input, 'json');
    expect(result.score).toBeGreaterThanOrEqual(0.9);
  });
});
