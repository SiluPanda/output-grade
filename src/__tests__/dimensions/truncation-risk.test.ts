import { describe, it, expect } from 'vitest';
import { scoreTruncationRisk } from '../../dimensions/truncation-risk';

// ── Complete Output ──────────────────────────────────────────────────────────

describe('scoreTruncationRisk — complete output', () => {
  it('scores complete text ending with period as 1.0', () => {
    const result = scoreTruncationRisk('This is a complete sentence.', 'text');
    expect(result.score).toBe(1.0);
    expect(result.signals).toHaveLength(0);
  });

  it('scores complete text ending with exclamation as 1.0', () => {
    const result = scoreTruncationRisk('Hello world!', 'text');
    expect(result.score).toBe(1.0);
    expect(result.signals).toHaveLength(0);
  });

  it('scores complete text ending with question mark as 1.0', () => {
    const result = scoreTruncationRisk('What is this?', 'text');
    expect(result.score).toBe(1.0);
    expect(result.signals).toHaveLength(0);
  });

  it('scores JSON ending with } as 1.0', () => {
    const result = scoreTruncationRisk('{"key": "value"}', 'json');
    expect(result.score).toBe(1.0);
    expect(result.signals).toHaveLength(0);
  });

  it('scores JSON ending with ] as 1.0', () => {
    const result = scoreTruncationRisk('[1, 2, 3]', 'json');
    expect(result.score).toBe(1.0);
    expect(result.signals).toHaveLength(0);
  });

  it('scores code ending with ; as 1.0', () => {
    const result = scoreTruncationRisk('const x = 42;', 'code');
    expect(result.score).toBe(1.0);
    expect(result.signals).toHaveLength(0);
  });

  it('scores code ending with } as 1.0', () => {
    const input = 'function hello() {\n  console.log("hi");\n}';
    const result = scoreTruncationRisk(input, 'code');
    expect(result.score).toBe(1.0);
    expect(result.signals).toHaveLength(0);
  });

  it('scores empty output as 1.0 (nothing to truncate)', () => {
    const result = scoreTruncationRisk('', 'text');
    expect(result.score).toBe(1.0);
    expect(result.signals).toHaveLength(0);
  });

  it('scores clean markdown as 1.0', () => {
    const input = '# Title\n\nSome paragraph text.\n\n```js\ncode();\n```';
    const result = scoreTruncationRisk(input, 'markdown');
    expect(result.score).toBe(1.0);
    expect(result.signals).toHaveLength(0);
  });
});

// ── Unclosed Brackets ────────────────────────────────────────────────────────

describe('scoreTruncationRisk — unclosed brackets', () => {
  it('detects unclosed curly bracket with critical signal', () => {
    const result = scoreTruncationRisk('{"key": "value"', 'json');
    expect(result.score).toBeLessThan(1.0);
    const signal = result.signals.find(
      (s) => s.id === 'truncation-unclosed-brackets',
    );
    expect(signal).toBeDefined();
    expect(signal!.severity).toBe('critical');
  });

  it('scores lower with more unclosed brackets', () => {
    const one = scoreTruncationRisk('{"a": {', 'json');
    const two = scoreTruncationRisk('{"a": {"b": {', 'json');
    expect(two.score).toBeLessThanOrEqual(one.score);
  });

  it('deducts 0.3 per unclosed bracket depth', () => {
    // 1 unclosed curly => sub-score = 1.0 - 0.3 = 0.7
    const result = scoreTruncationRisk('{', 'code');
    const signal = result.signals.find(
      (s) => s.id === 'truncation-unclosed-brackets',
    );
    expect(signal).toBeDefined();
    // With incomplete ending too, worst score wins
    expect(result.score).toBeLessThanOrEqual(0.7);
  });
});

// ── Incomplete Sentence ──────────────────────────────────────────────────────

describe('scoreTruncationRisk — incomplete ending', () => {
  it('detects text not ending with terminal punctuation', () => {
    const result = scoreTruncationRisk(
      'This sentence is not finished',
      'text',
    );
    expect(result.score).toBe(0.3);
    expect(result.signals).toHaveLength(1);
    expect(result.signals[0].id).toBe('truncation-incomplete-ending');
    expect(result.signals[0].severity).toBe('warning');
  });

  it('does not flag text ending with colon', () => {
    const result = scoreTruncationRisk('The items are:', 'text');
    expect(result.signals.find((s) => s.id === 'truncation-incomplete-ending')).toBeUndefined();
  });

  it('does not flag text ending with semicolon', () => {
    const result = scoreTruncationRisk('End of statement;', 'text');
    expect(result.signals.find((s) => s.id === 'truncation-incomplete-ending')).toBeUndefined();
  });
});

// ── Unclosed Markdown Fence ──────────────────────────────────────────────────

describe('scoreTruncationRisk — unclosed fence', () => {
  it('detects unclosed markdown code fence', () => {
    const input = '```javascript\nconsole.log("hi");\n';
    const result = scoreTruncationRisk(input, 'markdown');
    expect(result.score).toBeLessThanOrEqual(0.2);
    const signal = result.signals.find(
      (s) => s.id === 'truncation-unclosed-fence',
    );
    expect(signal).toBeDefined();
    expect(signal!.severity).toBe('critical');
  });

  it('does not flag balanced markdown fences', () => {
    const input = '```\ncode\n```';
    const result = scoreTruncationRisk(input, 'markdown');
    expect(
      result.signals.find((s) => s.id === 'truncation-unclosed-fence'),
    ).toBeUndefined();
  });

  it('detects odd number of fences as unclosed', () => {
    const input = '```\nblock1\n```\n\n```\nblock2\n```\n\n```\nblock3\n';
    const result = scoreTruncationRisk(input, 'markdown');
    expect(
      result.signals.find((s) => s.id === 'truncation-unclosed-fence'),
    ).toBeDefined();
  });
});

// ── Hyphenated Word Break ────────────────────────────────────────────────────

describe('scoreTruncationRisk — hyphenated break', () => {
  it('detects hyphenated word break at end', () => {
    const result = scoreTruncationRisk(
      'This is an impor-',
      'text',
    );
    const signal = result.signals.find(
      (s) => s.id === 'truncation-hyphenated-break',
    );
    expect(signal).toBeDefined();
    expect(signal!.severity).toBe('critical');
  });

  it('includes hyphenated break in composite score', () => {
    const result = scoreTruncationRisk(
      'This is an impor-',
      'text',
    );
    // Sub-score for hyphenated break is 0.1, incomplete ending is 0.3
    // Worst case (min) = 0.1
    expect(result.score).toBe(0.1);
  });
});

// ── Incomplete List ──────────────────────────────────────────────────────────

describe('scoreTruncationRisk — incomplete list', () => {
  it('detects promised items not delivered', () => {
    const input =
      'Here are 10 examples:\n1. First\n2. Second\n3. Third\n';
    const result = scoreTruncationRisk(input, 'text');
    const signal = result.signals.find(
      (s) => s.id === 'truncation-incomplete-list',
    );
    expect(signal).toBeDefined();
    expect(signal!.severity).toBe('warning');
    expect(signal!.message).toContain('10');
    expect(signal!.message).toContain('3');
  });

  it('does not flag when enough items are present', () => {
    const input =
      'Here are 3 items:\n1. First\n2. Second\n3. Third\n';
    const result = scoreTruncationRisk(input, 'text');
    expect(
      result.signals.find((s) => s.id === 'truncation-incomplete-list'),
    ).toBeUndefined();
  });

  it('detects "the following N" pattern', () => {
    const input =
      'The following 8 steps:\n1. Step one\n2. Step two\n';
    const result = scoreTruncationRisk(input, 'text');
    const signal = result.signals.find(
      (s) => s.id === 'truncation-incomplete-list',
    );
    expect(signal).toBeDefined();
    expect(signal!.message).toContain('8');
    expect(signal!.message).toContain('2');
  });
});

// ── Multiple Indicators ──────────────────────────────────────────────────────

describe('scoreTruncationRisk — multiple indicators', () => {
  it('uses worst score when multiple truncation indicators present', () => {
    // Unclosed fence (0.2) + incomplete ending + unclosed brackets
    const input = '```json\n{"key": "val';
    const result = scoreTruncationRisk(input, 'markdown');
    // Multiple sub-scores: unclosed brackets, unclosed fence, incomplete ending
    // Composite = min of all sub-scores
    expect(result.score).toBeLessThanOrEqual(0.2);
    expect(result.signals.length).toBeGreaterThanOrEqual(2);
  });

  it('worst score wins in composite', () => {
    // Unclosed fence = 0.2, incomplete ending = 0.3
    // min(0.2, 0.3) = 0.2
    const input = '```\nsome code without closing';
    const result = scoreTruncationRisk(input, 'text');
    expect(result.score).toBeLessThanOrEqual(0.3);
  });
});

// ── Format Auto-Detection ────────────────────────────────────────────────────

describe('scoreTruncationRisk — format auto-detection', () => {
  it('auto-detects JSON and uses JSON completion chars', () => {
    const result = scoreTruncationRisk('{"complete": true}');
    expect(result.score).toBe(1.0);
  });

  it('auto-detects text for plain prose', () => {
    const result = scoreTruncationRisk('Just some text.');
    expect(result.score).toBe(1.0);
  });
});

// ── Signal Shape ─────────────────────────────────────────────────────────────

describe('scoreTruncationRisk — signal shape', () => {
  it('emits signals with correct structure', () => {
    const result = scoreTruncationRisk('Incomplete text', 'text');
    const signal = result.signals[0];
    expect(signal).toHaveProperty('id');
    expect(signal).toHaveProperty('severity');
    expect(signal).toHaveProperty('dimension');
    expect(signal).toHaveProperty('message');
    expect(signal).toHaveProperty('location');
    expect(signal.dimension).toBe('truncation-risk');
    expect(signal.location).toBeNull();
    expect(typeof signal.id).toBe('string');
    expect(typeof signal.message).toBe('string');
  });

  it('uses correct severity levels for different indicators', () => {
    // Critical: unclosed brackets
    const bracketResult = scoreTruncationRisk('{"key": {', 'json');
    const bracketSignal = bracketResult.signals.find(
      (s) => s.id === 'truncation-unclosed-brackets',
    );
    expect(bracketSignal!.severity).toBe('critical');

    // Warning: incomplete ending
    const endingResult = scoreTruncationRisk('Not finished', 'text');
    const endingSignal = endingResult.signals.find(
      (s) => s.id === 'truncation-incomplete-ending',
    );
    expect(endingSignal!.severity).toBe('warning');

    // Critical: unclosed fence
    const fenceResult = scoreTruncationRisk('```\ncode', 'markdown');
    const fenceSignal = fenceResult.signals.find(
      (s) => s.id === 'truncation-unclosed-fence',
    );
    expect(fenceSignal!.severity).toBe('critical');
  });
});

// ── Score Clamping ───────────────────────────────────────────────────────────

describe('scoreTruncationRisk — score clamping', () => {
  it('never returns score below 0', () => {
    // Many unclosed brackets to try to push below 0
    const result = scoreTruncationRisk('((((((((((', 'code');
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBe(0);
  });

  it('never returns score above 1', () => {
    const result = scoreTruncationRisk('This is complete.', 'text');
    expect(result.score).toBeLessThanOrEqual(1);
    expect(result.score).toBe(1.0);
  });

  it('clamps to 0 for heavily truncated output', () => {
    // 4+ unclosed brackets => 1.0 - 4*0.3 = negative => clamped to 0
    const result = scoreTruncationRisk('{{{{', 'code');
    const bracketSignal = result.signals.find(
      (s) => s.id === 'truncation-unclosed-brackets',
    );
    expect(bracketSignal).toBeDefined();
    expect(result.score).toBe(0);
  });
});
