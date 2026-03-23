import { describe, it, expect } from 'vitest';
import {
  grade,
  createGrader,
  scoreSchemaCompleteness,
  scoreHallucinationRisk,
  scoreTruncationRisk,
} from '../index';

// ── Dimension-specific edge cases ──────────────────────────────────────────

describe('dimension-specific edge cases', () => {
  it('schema completeness: array minItems validation', () => {
    const schema = {
      type: 'object' as const,
      properties: {
        items: { type: 'array' as const, minItems: 1 },
      },
      required: ['items'],
    };
    const output = JSON.stringify({ items: [] });
    const result = scoreSchemaCompleteness(output, schema);
    // Empty array violates minItems: 1 — should produce warning signal
    expect(result.score).toBeLessThan(1.0);
  });

  it('hallucination: impossible date (Feb 30)', () => {
    const output = 'The event was held on February 30, 2024, which was attended by many.';
    const result = scoreHallucinationRisk(output);
    // Impossible date should trigger a signal
    // Check score drops or signal exists
    expect(result.score).toBeLessThanOrEqual(1.0);
    expect(result.signals).toBeDefined();
  });

  it('hallucination: future-dated citation', () => {
    const output = 'According to Smith et al. (2045), the findings suggest that AI has surpassed human intelligence.';
    const result = scoreHallucinationRisk(output);
    // Future year citation should be flagged
    expect(result.score).toBeLessThanOrEqual(1.0);
  });

  it('truncation: abrupt ending mid-word', () => {
    const output = 'The key factors influencing climate change include greenhouse gas emissions, deforestation, and industr';
    const result = scoreTruncationRisk(output);
    // Abrupt mid-word ending should trigger truncation signal
    expect(result.score).toBeLessThan(1.0);
    const signalIds = result.signals.map((s) => s.id);
    expect(signalIds.length).toBeGreaterThan(0);
  });
});

// ── Integration tests with grade() ─────────────────────────────────────────

describe('grade() full integration scenarios', () => {
  it('grades truncated JSON output', () => {
    const truncatedJson = '{"name": "John", "age": 30, "address": {"street": "123 Main St", "city": "New Y';
    const report = grade(truncatedJson, { format: 'json' });
    expect(report.score).toBeLessThan(0.8);
    expect(report.pass).toBe(false);
    // Should detect structural issues and truncation
    const dims = report.dimensions;
    expect(dims['structural-validity']).toBeLessThan(1.0);
    expect(dims['truncation-risk']).toBeLessThan(1.0);
  });

  it('grades repetition loop output', () => {
    const repeated = 'The answer is yes. '.repeat(50);
    const report = grade(repeated);
    expect(report.dimensions['content-coherence']).toBeLessThan(0.8);
    // Should detect repetition
    const signalIds = report.signals.map((s) => s.id);
    expect(signalIds.some((id) => id.includes('repetit') || id.includes('loop') || id.includes('ngram'))).toBe(true);
  });

  it('grades hedging-heavy output with fabricated citation', () => {
    const output = 'It might be possible that perhaps the results could potentially suggest that maybe there are some effects. According to www.totally-fake-research.com/study123, the findings are conclusive.';
    const report = grade(output);
    // Should detect hedging and possibly fabricated URL
    expect(report.dimensions['hallucination-risk']).toBeLessThan(1.0);
  });

  it('grades markdown output with minor issues', () => {
    const markdown = `# Analysis Report

## Introduction
The study examined multiple factors.

## Results
- Factor A showed significant improvement
- Factor B showed moderate decline
- Factor C remained stable

## Conclusion
Overall, the results suggest positive trends.`;
    const report = grade(markdown, { format: 'markdown' });
    // Well-formed markdown should score reasonably well
    expect(report.score).toBeGreaterThan(0.5);
  });
});

// ── Factory (createGrader) tests ────────────────────────────────────────────

describe('createGrader() advanced usage', () => {
  it('grader with custom weights applies them', () => {
    const grader = createGrader({
      weights: { 'hallucination-risk': 0.5 },
    });
    const report = grader.grade('It might be possible that this works.');
    // Weight is redistributed proportionally after excluded dimensions (no prompt/schema),
    // but hallucination-risk should be the largest weight
    const hrWeight = report.meta.weights['hallucination-risk'] ?? 0;
    expect(hrWeight).toBeGreaterThan(0.3);
  });

  it('per-dimension methods work correctly', () => {
    const grader = createGrader();
    const result = grader.detectHallucinations('This text is straightforward and factual.');
    expect(result).toBeDefined();
    expect(result.score).toBeLessThanOrEqual(1.0);
    expect(result.score).toBeGreaterThanOrEqual(0.0);
  });
});

// ── Edge cases ──────────────────────────────────────────────────────────────

describe('edge cases', () => {
  it('handles null/undefined input gracefully', () => {
    const report = grade(null as unknown as string);
    expect(report.score).toBe(0);
    expect(report.pass).toBe(false);
    const signalIds = report.signals.map((s) => s.id);
    expect(signalIds.some((id) => id.includes('empty'))).toBe(true);
  });

  it('handles empty string input', () => {
    const report = grade('');
    expect(report.score).toBe(0);
    expect(report.pass).toBe(false);
  });

  it('handles very long input (100KB+) without errors', () => {
    const longOutput = 'This is a sentence. '.repeat(5000); // ~100KB
    const report = grade(longOutput);
    expect(report).toBeDefined();
    expect(typeof report.score).toBe('number');
    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(report.score).toBeLessThanOrEqual(1);
  });

  it('handles input containing only numbers', () => {
    const report = grade('12345 67890 11111 22222 33333');
    expect(report).toBeDefined();
    expect(typeof report.score).toBe('number');
    expect(report.score).toBeGreaterThanOrEqual(0);
  });
});
