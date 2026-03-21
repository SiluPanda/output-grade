import { describe, it, expect } from 'vitest';
import { HEDGING_PATTERNS } from '../patterns/hedging';
import type { PatternEntry } from '../patterns/hedging';
import { REFUSAL_PATTERNS } from '../patterns/refusal';
import { CONFIDENCE_PATTERNS } from '../patterns/confidence';
import { STOPWORDS, removeStopwords } from '../patterns/stopwords';

// ── Hedging Patterns ────────────────────────────────────────────────────────

describe('HEDGING_PATTERNS', () => {
  it('matches "I think" in text', () => {
    const entry = HEDGING_PATTERNS.find(p => p.label === 'I think')!;
    expect(entry.pattern.test('I think this is correct.')).toBe(true);
  });

  it('matches "probably" in text', () => {
    const entry = HEDGING_PATTERNS.find(p => p.label === 'probably')!;
    expect(entry.pattern.test('This is probably fine.')).toBe(true);
  });

  it('matches "approximately" in text', () => {
    const entry = HEDGING_PATTERNS.find(p => p.label === 'approximately')!;
    expect(entry.pattern.test('There are approximately 50 items.')).toBe(true);
  });

  it('matches "as of my last update"', () => {
    const entry = HEDGING_PATTERNS.find(p => p.label === 'knowledge cutoff reference')!;
    expect(entry.pattern.test('As of my last update, the answer is yes.')).toBe(true);
  });

  it('matches "as of my knowledge cutoff"', () => {
    const entry = HEDGING_PATTERNS.find(p => p.label === 'knowledge cutoff reference')!;
    expect(entry.pattern.test('As of my knowledge cutoff, this was true.')).toBe(true);
  });

  it('does not match irrelevant text', () => {
    const text = 'The quick brown fox jumps over the lazy dog.';
    const matches = HEDGING_PATTERNS.filter(p => p.pattern.test(text));
    expect(matches).toHaveLength(0);
  });

  it('is case-insensitive', () => {
    const entry = HEDGING_PATTERNS.find(p => p.label === 'I believe')!;
    expect(entry.pattern.test('I BELIEVE this is right.')).toBe(true);
  });

  it('has correct categories', () => {
    const categories = new Set(HEDGING_PATTERNS.map(p => p.category));
    expect(categories.has('belief-qualifier')).toBe(true);
    expect(categories.has('possibility')).toBe(true);
    expect(categories.has('approximation')).toBe(true);
    expect(categories.has('uncertainty')).toBe(true);
    expect(categories.has('knowledge-cutoff')).toBe(true);
  });
});

// ── Refusal Patterns ────────────────────────────────────────────────────────

describe('REFUSAL_PATTERNS', () => {
  it('matches "I can\'t help with that"', () => {
    const entry = REFUSAL_PATTERNS.find(p => p.label === "I can't help with that")!;
    expect(entry.pattern.test("I can't help with that request.")).toBe(true);
  });

  it('matches "As an AI"', () => {
    const entry = REFUSAL_PATTERNS.find(p => p.label === 'As an AI')!;
    expect(entry.pattern.test('As an AI, I cannot do that.')).toBe(true);
  });

  it('matches "As an AI language model"', () => {
    const entry = REFUSAL_PATTERNS.find(p => p.label === 'As an AI')!;
    expect(entry.pattern.test('As an AI language model, I have limitations.')).toBe(true);
  });

  it('matches "against my guidelines"', () => {
    const entry = REFUSAL_PATTERNS.find(p => p.label === 'against my guidelines')!;
    expect(entry.pattern.test('That is against my guidelines.')).toBe(true);
  });

  it('matches "please consult a professional"', () => {
    const entry = REFUSAL_PATTERNS.find(p => p.label === 'consult a professional')!;
    expect(entry.pattern.test('Please consult a professional for advice.')).toBe(true);
  });

  it('does not match normal responses', () => {
    const text = 'Here is the information you requested. The capital of France is Paris.';
    const matches = REFUSAL_PATTERNS.filter(p => p.pattern.test(text));
    expect(matches).toHaveLength(0);
  });

  it('has correct categories', () => {
    const categories = new Set(REFUSAL_PATTERNS.map(p => p.category));
    expect(categories.has('direct-refusal')).toBe(true);
    expect(categories.has('policy')).toBe(true);
    expect(categories.has('safety')).toBe(true);
    expect(categories.has('identity')).toBe(true);
    expect(categories.has('capability')).toBe(true);
    expect(categories.has('redirect')).toBe(true);
  });
});

// ── Confidence Patterns ─────────────────────────────────────────────────────

describe('CONFIDENCE_PATTERNS', () => {
  it('matches "definitely"', () => {
    const entry = CONFIDENCE_PATTERNS.find(p => p.label === 'definitely')!;
    expect(entry.pattern.test('This is definitely the right answer.')).toBe(true);
  });

  it('matches "100%"', () => {
    const entry = CONFIDENCE_PATTERNS.find(p => p.label === '100%')!;
    expect(entry.pattern.test('I am 100% sure about this.')).toBe(true);
  });

  it('matches "guaranteed"', () => {
    const entry = CONFIDENCE_PATTERNS.find(p => p.label === 'guaranteed')!;
    expect(entry.pattern.test('This is guaranteed to work.')).toBe(true);
    expect(entry.pattern.test('I can guarantee that.')).toBe(true);
  });

  it('matches "absolutely"', () => {
    const entry = CONFIDENCE_PATTERNS.find(p => p.label === 'absolutely')!;
    expect(entry.pattern.test('This is absolutely correct.')).toBe(true);
  });

  it('all entries have warning or info severity', () => {
    for (const entry of CONFIDENCE_PATTERNS) {
      expect(['info', 'warning']).toContain(entry.severity);
    }
  });
});

// ── Stopwords ───────────────────────────────────────────────────────────────

describe('STOPWORDS', () => {
  it('has 100+ entries', () => {
    expect(STOPWORDS.size).toBeGreaterThanOrEqual(100);
  });

  it('contains common articles', () => {
    expect(STOPWORDS.has('a')).toBe(true);
    expect(STOPWORDS.has('an')).toBe(true);
    expect(STOPWORDS.has('the')).toBe(true);
  });

  it('contains common prepositions', () => {
    expect(STOPWORDS.has('in')).toBe(true);
    expect(STOPWORDS.has('on')).toBe(true);
    expect(STOPWORDS.has('at')).toBe(true);
    expect(STOPWORDS.has('by')).toBe(true);
  });

  it('contains common pronouns', () => {
    expect(STOPWORDS.has('i')).toBe(true);
    expect(STOPWORDS.has('you')).toBe(true);
    expect(STOPWORDS.has('he')).toBe(true);
    expect(STOPWORDS.has('she')).toBe(true);
  });

  it('contains common verbs', () => {
    expect(STOPWORDS.has('is')).toBe(true);
    expect(STOPWORDS.has('are')).toBe(true);
    expect(STOPWORDS.has('was')).toBe(true);
    expect(STOPWORDS.has('were')).toBe(true);
  });

  it('does not contain content words', () => {
    expect(STOPWORDS.has('algorithm')).toBe(false);
    expect(STOPWORDS.has('computer')).toBe(false);
    expect(STOPWORDS.has('science')).toBe(false);
  });
});

describe('removeStopwords', () => {
  it('filters common words and keeps content words', () => {
    const tokens = ['the', 'quick', 'brown', 'fox', 'is', 'very', 'fast'];
    const result = removeStopwords(tokens);
    expect(result).toEqual(['quick', 'brown', 'fox', 'fast']);
  });

  it('returns empty array for all stopwords', () => {
    const tokens = ['the', 'a', 'is', 'in', 'on'];
    expect(removeStopwords(tokens)).toEqual([]);
  });

  it('returns same array when no stopwords present', () => {
    const tokens = ['algorithm', 'computer', 'science'];
    expect(removeStopwords(tokens)).toEqual(['algorithm', 'computer', 'science']);
  });

  it('handles empty array', () => {
    expect(removeStopwords([])).toEqual([]);
  });

  it('is case-insensitive', () => {
    const tokens = ['The', 'QUICK', 'Brown', 'FOX'];
    const result = removeStopwords(tokens);
    expect(result).toEqual(['QUICK', 'Brown', 'FOX']);
  });
});

// ── Pattern Shape Validation ────────────────────────────────────────────────

describe('Pattern entry shapes', () => {
  const allPatterns: PatternEntry[] = [
    ...HEDGING_PATTERNS,
    ...REFUSAL_PATTERNS,
    ...CONFIDENCE_PATTERNS,
  ];

  it('all entries have pattern, category, severity, and label', () => {
    for (const entry of allPatterns) {
      expect(entry.pattern).toBeInstanceOf(RegExp);
      expect(typeof entry.category).toBe('string');
      expect(entry.category.length).toBeGreaterThan(0);
      expect(['info', 'warning', 'critical']).toContain(entry.severity);
      expect(typeof entry.label).toBe('string');
      expect(entry.label.length).toBeGreaterThan(0);
    }
  });

  it('all patterns are case-insensitive', () => {
    for (const entry of allPatterns) {
      expect(entry.pattern.flags).toContain('i');
    }
  });
});

// ── ReDoS Safety ────────────────────────────────────────────────────────────

describe('ReDoS safety', () => {
  const allPatterns: PatternEntry[] = [
    ...HEDGING_PATTERNS,
    ...REFUSAL_PATTERNS,
    ...CONFIDENCE_PATTERNS,
  ];

  it('all patterns complete quickly on adversarial input', () => {
    const adversarialInputs = [
      'a'.repeat(10000),
      'I think '.repeat(1000),
      'x '.repeat(5000),
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa!',
    ];

    for (const entry of allPatterns) {
      for (const input of adversarialInputs) {
        const start = Date.now();
        entry.pattern.test(input);
        const elapsed = Date.now() - start;
        expect(elapsed).toBeLessThan(100); // must complete in <100ms
      }
    }
  });

  it('no patterns use nested quantifiers', () => {
    for (const entry of allPatterns) {
      const source = entry.pattern.source;
      // Nested quantifiers like (a+)+ or (a*)* are ReDoS vectors
      expect(source).not.toMatch(/\([^)]*[+*]\)[+*]/);
    }
  });
});
