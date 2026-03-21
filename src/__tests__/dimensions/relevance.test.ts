import { describe, it, expect } from 'vitest';
import { scoreRelevance } from '../../dimensions/relevance';

// ── No Prompt (Neutral) ────────────────────────────────────────────────────

describe('scoreRelevance — no prompt', () => {
  it('returns 1.0 when no prompt is provided', () => {
    const result = scoreRelevance('Some random output text.');
    expect(result.score).toBe(1.0);
    expect(result.signals).toHaveLength(0);
  });

  it('returns 1.0 when prompt is undefined', () => {
    const result = scoreRelevance('Output text.', undefined);
    expect(result.score).toBe(1.0);
    expect(result.signals).toHaveLength(0);
  });

  it('returns 1.0 when prompt is empty string', () => {
    const result = scoreRelevance('Output text.', '');
    expect(result.score).toBe(1.0);
    expect(result.signals).toHaveLength(0);
  });
});

// ── Keyword Overlap ────────────────────────────────────────────────────────

describe('scoreRelevance — keyword overlap', () => {
  it('scores high when output contains many prompt keywords', () => {
    const prompt = 'Explain TypeScript generics and type inference';
    const output =
      'TypeScript generics allow you to write reusable components. ' +
      'Type inference in TypeScript automatically deduces types from context. ' +
      'Generics combined with inference make TypeScript powerful.';
    const result = scoreRelevance(output, prompt);
    expect(result.score).toBeGreaterThanOrEqual(0.7);
  });

  it('scores low with warning when output has little keyword overlap', () => {
    const prompt = 'Explain quantum physics and wave-particle duality';
    const output =
      'Here is a recipe for chocolate cake. ' +
      'First, preheat your oven to 350 degrees. ' +
      'Mix flour, sugar, and cocoa powder together.';
    const result = scoreRelevance(output, prompt);
    expect(result.score).toBeLessThanOrEqual(0.5);
    expect(
      result.signals.some((s) => s.id === 'relevance-low-keyword-overlap'),
    ).toBe(true);
  });

  it('emits warning when overlap ratio is below 0.2', () => {
    const prompt = 'Describe the architecture of neural networks';
    const output = 'The weather today is sunny and warm.';
    const result = scoreRelevance(output, prompt);
    const warning = result.signals.find(
      (s) => s.id === 'relevance-low-keyword-overlap',
    );
    expect(warning).toBeDefined();
    expect(warning!.severity).toBe('warning');
    expect(warning!.dimension).toBe('relevance');
  });

  it('does not emit warning when overlap is sufficient', () => {
    const prompt = 'Explain JavaScript closures';
    const output =
      'JavaScript closures are functions that capture their surrounding scope. ' +
      'A closure retains access to variables from its enclosing function.';
    const result = scoreRelevance(output, prompt);
    expect(
      result.signals.some((s) => s.id === 'relevance-low-keyword-overlap'),
    ).toBe(false);
  });
});

// ── Structural Alignment ────────────────────────────────────────────────────

describe('scoreRelevance — structural alignment', () => {
  it('deducts when prompt says "list" but output has no list items', () => {
    const prompt = 'List the top programming languages';
    const output =
      'Programming languages are important for software development. ' +
      'They allow developers to create applications and systems.';
    const result = scoreRelevance(output, prompt);
    expect(
      result.signals.some((s) => s.id === 'relevance-missing-list'),
    ).toBe(true);
  });

  it('does not deduct when prompt says "list" and output has list items', () => {
    const prompt = 'List the top programming languages';
    const output =
      '1. Python\n2. JavaScript\n3. TypeScript\n4. Java\n5. C++';
    const result = scoreRelevance(output, prompt);
    expect(
      result.signals.some((s) => s.id === 'relevance-missing-list'),
    ).toBe(false);
  });

  it('deducts when prompt says "JSON" but output has no JSON structure', () => {
    const prompt = 'Return the result as JSON';
    const output = 'The result is that the temperature is 72 degrees.';
    const result = scoreRelevance(output, prompt);
    expect(
      result.signals.some((s) => s.id === 'relevance-missing-json'),
    ).toBe(true);
  });

  it('does not deduct when prompt says "JSON" and output has JSON', () => {
    const prompt = 'Return the result as JSON';
    const output = '{"temperature": 72, "unit": "fahrenheit"}';
    const result = scoreRelevance(output, prompt);
    expect(
      result.signals.some((s) => s.id === 'relevance-missing-json'),
    ).toBe(false);
  });

  it('deducts when prompt says "code" but output lacks code patterns', () => {
    const prompt = 'Write a function to sort an array';
    const output =
      'Sorting is the process of arranging elements in a particular order. ' +
      'There are many sorting algorithms available.';
    const result = scoreRelevance(output, prompt);
    expect(
      result.signals.some((s) => s.id === 'relevance-missing-code'),
    ).toBe(true);
  });

  it('does not deduct when prompt says "implement" and output has code', () => {
    const prompt = 'Implement a binary search function';
    const output =
      '```typescript\nfunction binarySearch(arr: number[], target: number): number {\n' +
      '  let left = 0, right = arr.length - 1;\n' +
      '  while (left <= right) {\n' +
      '    const mid = Math.floor((left + right) / 2);\n' +
      '    if (arr[mid] === target) return mid;\n' +
      '    if (arr[mid] < target) left = mid + 1;\n' +
      '    else right = mid - 1;\n' +
      '  }\n  return -1;\n}\n```';
    const result = scoreRelevance(output, prompt);
    expect(
      result.signals.some((s) => s.id === 'relevance-missing-code'),
    ).toBe(false);
  });
});

// ── Topic Drift ─────────────────────────────────────────────────────────────

describe('scoreRelevance — topic drift', () => {
  it('detects drift when first quarter is relevant but last quarter is not', () => {
    const prompt = 'Explain machine learning algorithms';
    // First quarter: relevant keywords. Last quarter: completely off-topic.
    const output =
      'Machine learning algorithms are computational methods that learn from data. ' +
      'Common algorithms include decision trees, neural networks, and support vector machines. ' +
      'These algorithms can be supervised or unsupervised. ' +
      'Training involves feeding data into the model. ' +
      // Drift into completely unrelated topic
      'Speaking of food, pizza is a popular Italian dish. ' +
      'The best pizza comes from Naples, Italy. ' +
      'Margherita pizza was named after Queen Margherita. ' +
      'Pizza dough requires flour, water, yeast, and salt. ' +
      'Baking pizza in a wood-fired oven gives the best results. ' +
      'Mozzarella cheese melts beautifully on pizza.';
    const result = scoreRelevance(output, prompt);
    expect(
      result.signals.some((s) => s.id === 'relevance-topic-drift'),
    ).toBe(true);
  });

  it('does not flag drift for consistently relevant output', () => {
    const prompt = 'Explain TypeScript types';
    const output =
      'TypeScript provides a rich type system for JavaScript. ' +
      'Types include primitive types like string, number, and boolean. ' +
      'You can define custom types using interfaces and type aliases. ' +
      'Union types allow a value to be one of several types. ' +
      'Intersection types combine multiple types into one. ' +
      'TypeScript types help catch errors at compile time. ' +
      'Generic types enable reusable, type-safe components. ' +
      'TypeScript infers types automatically in many cases.';
    const result = scoreRelevance(output, prompt);
    expect(
      result.signals.some((s) => s.id === 'relevance-topic-drift'),
    ).toBe(false);
  });

  it('does not check drift for short outputs (< 200 chars)', () => {
    const prompt = 'Explain gravity';
    const output = 'Gravity pulls objects toward Earth.';
    const result = scoreRelevance(output, prompt);
    expect(
      result.signals.some((s) => s.id === 'relevance-topic-drift'),
    ).toBe(false);
  });
});

// ── Length Reasonableness ───────────────────────────────────────────────────

describe('scoreRelevance — length reasonableness', () => {
  it('deducts when prompt requests detail but output is too short', () => {
    const prompt = 'Explain in detail how compilers work';
    const output = 'Compilers translate code.';
    const result = scoreRelevance(output, prompt);
    expect(
      result.signals.some((s) => s.id === 'relevance-too-short'),
    ).toBe(true);
    const signal = result.signals.find((s) => s.id === 'relevance-too-short')!;
    expect(signal.severity).toBe('warning');
  });

  it('deducts when prompt requests brevity but output is too long', () => {
    const prompt = 'Briefly describe what an API is';
    // Generate output > 2000 characters
    const longOutput = 'An API is an Application Programming Interface. '.repeat(
      50,
    );
    const result = scoreRelevance(longOutput, prompt);
    expect(
      result.signals.some((s) => s.id === 'relevance-too-long'),
    ).toBe(true);
    const signal = result.signals.find((s) => s.id === 'relevance-too-long')!;
    expect(signal.severity).toBe('info');
  });

  it('does not flag length for normal prompt and normal output', () => {
    const prompt = 'What is TypeScript?';
    const output =
      'TypeScript is a typed superset of JavaScript that compiles to plain JavaScript. ' +
      'It adds optional static typing and class-based object-oriented programming.';
    const result = scoreRelevance(output, prompt);
    expect(
      result.signals.some(
        (s) =>
          s.id === 'relevance-too-short' || s.id === 'relevance-too-long',
      ),
    ).toBe(false);
  });
});

// ── Expected Output Comparison ──────────────────────────────────────────────

describe('scoreRelevance — expected output comparison', () => {
  it('computes Jaccard similarity when expected output is provided', () => {
    const prompt = 'What is the capital of France?';
    const expected = 'The capital of France is Paris.';
    const output = 'Paris is the capital of France.';
    const result = scoreRelevance(output, prompt, expected);
    // Near-identical tokens -> high Jaccard -> high score
    expect(result.score).toBeGreaterThanOrEqual(0.5);
  });

  it('gives lower score when output diverges from expected', () => {
    const prompt = 'What is the capital of France?';
    const expected = 'The capital of France is Paris.';
    const output =
      'Germany is a country in Europe. Berlin is its capital city. ' +
      'The Rhine river flows through several German states.';
    const result = scoreRelevance(output, prompt, expected);
    const resultWithoutExpected = scoreRelevance(output, prompt);
    // With expected, score should factor in Jaccard (which is low here)
    expect(result.score).toBeLessThan(0.8);
    // The expected path uses a different formula than the non-expected path
    expect(result.score).not.toBe(resultWithoutExpected.score);
  });

  it('handles empty expected output gracefully', () => {
    const prompt = 'What is TypeScript?';
    const expected = '';
    const output = 'TypeScript is a typed superset of JavaScript.';
    const result = scoreRelevance(output, prompt, expected);
    expect(Number.isFinite(result.score)).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
  });
});

// ── Empty Output ────────────────────────────────────────────────────────────

describe('scoreRelevance — empty output', () => {
  it('scores low for empty output with a prompt', () => {
    const prompt = 'Explain TypeScript generics';
    const result = scoreRelevance('', prompt);
    expect(result.score).toBeLessThanOrEqual(0.5);
  });

  it('scores low for whitespace-only output with a prompt', () => {
    const prompt = 'Explain TypeScript generics';
    const result = scoreRelevance('   \n  \t  ', prompt);
    expect(result.score).toBeLessThanOrEqual(0.5);
  });
});

// ── Score Clamping ──────────────────────────────────────────────────────────

describe('scoreRelevance — score clamping', () => {
  it('never returns score below 0', () => {
    const prompt =
      'Explain quantum entanglement in detail with comprehensive examples';
    const output = 'Hi.';
    const result = scoreRelevance(output, prompt);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it('never returns score above 1', () => {
    const prompt = 'TypeScript';
    const output =
      'TypeScript TypeScript TypeScript TypeScript TypeScript TypeScript';
    const result = scoreRelevance(output, prompt);
    expect(result.score).toBeLessThanOrEqual(1);
  });

  it('score is always a finite number', () => {
    const inputs: [string, string | undefined][] = [
      ['hello', 'world'],
      ['', undefined],
      ['test', ''],
      ['output', 'prompt'],
      ['TypeScript generics', 'Explain TypeScript generics'],
    ];
    for (const [output, prompt] of inputs) {
      const result = scoreRelevance(output, prompt);
      expect(Number.isFinite(result.score)).toBe(true);
    }
  });
});

// ── Signal Shape ────────────────────────────────────────────────────────────

describe('scoreRelevance — signal shape', () => {
  it('emits signals with correct structure', () => {
    const prompt = 'List the programming languages in JSON format';
    const output = 'I like cats and dogs and birds.';
    const result = scoreRelevance(output, prompt);
    expect(result.signals.length).toBeGreaterThan(0);
    for (const signal of result.signals) {
      expect(signal).toHaveProperty('id');
      expect(signal).toHaveProperty('severity');
      expect(signal).toHaveProperty('dimension');
      expect(signal).toHaveProperty('message');
      expect(signal).toHaveProperty('location');
      expect(signal.dimension).toBe('relevance');
      expect(signal.location).toBeNull();
      expect(typeof signal.id).toBe('string');
      expect(typeof signal.message).toBe('string');
      expect(['info', 'warning', 'critical']).toContain(signal.severity);
    }
  });

  it('all signals have dimension set to relevance', () => {
    const prompt = 'Explain in detail the list of JSON code functions';
    const output = 'Random unrelated text about cooking pasta recipes.';
    const result = scoreRelevance(output, prompt);
    for (const signal of result.signals) {
      expect(signal.dimension).toBe('relevance');
    }
  });
});

// ── Prompt with Only Stopwords ──────────────────────────────────────────────

describe('scoreRelevance — edge cases', () => {
  it('returns 1.0 when prompt has only stopwords (no keywords)', () => {
    const prompt = 'the and or but is are was';
    const output = 'Some meaningful output text about programming.';
    const result = scoreRelevance(output, prompt);
    expect(result.score).toBe(1.0);
    expect(result.signals).toHaveLength(0);
  });

  it('handles prompt with single meaningful keyword', () => {
    const prompt = 'TypeScript';
    const output = 'TypeScript is a programming language.';
    const result = scoreRelevance(output, prompt);
    expect(result.score).toBeGreaterThanOrEqual(0.7);
  });
});
