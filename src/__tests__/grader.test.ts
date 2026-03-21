import { describe, it, expect } from 'vitest';
import { createGrader } from '../grader';
import type { GraderConfig, GradeReport } from '../types';

// ── Factory Basics ──────────────────────────────────────────────────────────

describe('createGrader() — factory basics', () => {
  it('returns a Grader with a grade method', () => {
    const grader = createGrader();
    expect(typeof grader.grade).toBe('function');
  });

  it('returns a Grader with all per-dimension methods', () => {
    const grader = createGrader();
    expect(typeof grader.gradeSchema).toBe('function');
    expect(typeof grader.gradeStructure).toBe('function');
    expect(typeof grader.gradeCoherence).toBe('function');
    expect(typeof grader.detectHallucinations).toBe('function');
    expect(typeof grader.detectTruncation).toBe('function');
    expect(typeof grader.detectRefusal).toBe('function');
    expect(typeof grader.gradeRelevance).toBe('function');
    expect(typeof grader.gradeFormatCompliance).toBe('function');
  });

  it('exposes readonly config property', () => {
    const config: GraderConfig = { passThreshold: 0.8 };
    const grader = createGrader(config);
    expect(grader.config).toBeDefined();
    expect(grader.config.passThreshold).toBe(0.8);
  });

  it('default grader works without config', () => {
    const grader = createGrader();
    const report = grader.grade('This is a normal, well-formed response.');
    expect(report).toHaveProperty('score');
    expect(report).toHaveProperty('pass');
    expect(report).toHaveProperty('dimensions');
    expect(typeof report.score).toBe('number');
    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(report.score).toBeLessThanOrEqual(1);
  });
});

// ── Instance Config Persistence ─────────────────────────────────────────────

describe('createGrader() — instance config persistence', () => {
  it('instance config persists across calls', () => {
    const grader = createGrader({ passThreshold: 0.9 });
    const report1 = grader.grade('First call with some reasonable output.');
    const report2 = grader.grade('Second call with different content here.');
    expect(report1.passThreshold).toBe(0.9);
    expect(report2.passThreshold).toBe(0.9);
  });

  it('custom weights from config are used', () => {
    const grader = createGrader({
      weights: {
        'structural-validity': 1.0,
        'content-coherence': 0,
        'hallucination-risk': 0,
        'truncation-risk': 0,
        'refusal-detection': 0,
        'schema-completeness': 0,
        'relevance': 0,
        'format-compliance': 0,
      },
    });
    const report = grader.grade('{"valid": "json object"}');
    // Structural validity should dominate since it's the only weight
    expect(report.meta.weights['structural-validity']).toBeGreaterThan(0);
  });

  it('custom passThreshold from config is used', () => {
    const grader = createGrader({ passThreshold: 0.99 });
    const report = grader.grade('A normal output sentence.');
    expect(report.passThreshold).toBe(0.99);
  });

  it('custom criticalFloors from config are used', () => {
    const grader = createGrader({
      criticalFloors: {
        'structural-validity': { threshold: 0.5, ceiling: 0.1 },
      },
    });
    // Broken JSON with format hint triggers structural validity floor
    const report = grader.grade('{"broken": json with no closing', {
      format: 'json',
    });
    expect(report.meta.criticalFloorTriggered).toBe('structural-validity');
  });
});

// ── Per-Call Override ────────────────────────────────────────────────────────

describe('createGrader() — per-call options override', () => {
  it('per-call options override instance config', () => {
    const grader = createGrader({ passThreshold: 0.5 });
    const report = grader.grade('Some output text.', { passThreshold: 0.99 });
    expect(report.passThreshold).toBe(0.99);
  });

  it('per-call weights override instance weights', () => {
    const grader = createGrader({
      weights: { 'structural-validity': 0.5 },
    });
    const report = grader.grade('Some text output.', {
      weights: { 'structural-validity': 0.1 },
    });
    // The per-call weight should be used
    expect(report.meta.weights['structural-validity']).toBeLessThan(0.5);
  });

  it('per-call criticalFloors override instance criticalFloors', () => {
    const grader = createGrader({
      criticalFloors: {
        'structural-validity': { threshold: 0.99, ceiling: 0.01 },
      },
    });
    // Override with no critical floors
    const report = grader.grade('Hello world, this is a well-formed response.', {
      criticalFloors: {},
    });
    expect(report.meta.criticalFloorTriggered).toBeNull();
  });

  it('per-call prompt is passed through', () => {
    const grader = createGrader();
    const report = grader.grade('Paris is the capital of France.', {
      prompt: 'What is the capital of France?',
    });
    // Relevance should be applicable when prompt is provided
    expect(report.meta.applicableDimensions).toContain('relevance');
  });
});

// ── Multiple Calls Independence ─────────────────────────────────────────────

describe('createGrader() — call independence', () => {
  it('multiple calls share config but are independent', () => {
    const grader = createGrader({ passThreshold: 0.6 });

    const report1 = grader.grade('A short response.');
    const report2 = grader.grade('{"key": "value", "nested": {"inner": true}}');

    // Both use the same threshold
    expect(report1.passThreshold).toBe(0.6);
    expect(report2.passThreshold).toBe(0.6);

    // But scores differ because inputs differ
    expect(report1.score).not.toBe(report2.score);
  });
});

// ── GradeReport Validity ────────────────────────────────────────────────────

describe('createGrader() — GradeReport validity', () => {
  it('grader.grade() returns a valid GradeReport', () => {
    const grader = createGrader();
    const report: GradeReport = grader.grade('A well-formed answer to a question.');

    // Required fields
    expect(typeof report.score).toBe('number');
    expect(typeof report.pass).toBe('boolean');
    expect(typeof report.passThreshold).toBe('number');
    expect(typeof report.summary).toBe('string');
    expect(Array.isArray(report.signals)).toBe(true);
    expect(report.dimensions).toBeDefined();
    expect(report.meta).toBeDefined();

    // Score in range
    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(report.score).toBeLessThanOrEqual(1);

    // All 8 dimensions present
    const dims = Object.keys(report.dimensions);
    expect(dims).toHaveLength(8);
    expect(dims).toContain('structural-validity');
    expect(dims).toContain('truncation-risk');
    expect(dims).toContain('refusal-detection');
    expect(dims).toContain('content-coherence');
    expect(dims).toContain('hallucination-risk');
    expect(dims).toContain('schema-completeness');
    expect(dims).toContain('relevance');
    expect(dims).toContain('format-compliance');

    // Meta structure
    expect(typeof report.meta.durationMs).toBe('number');
    expect(typeof report.meta.outputLength).toBe('number');
    expect(report.meta.detectedFormat).toBeDefined();
  });
});

// ── Per-Dimension Methods ───────────────────────────────────────────────────

describe('createGrader() — per-dimension methods', () => {
  it('gradeSchema returns DimensionResult', () => {
    const grader = createGrader();
    const result = grader.gradeSchema('{"name": "Alice", "age": 30}', {
      type: 'object',
      properties: { name: { type: 'string' }, age: { type: 'number' } },
      required: ['name', 'age'],
    });
    expect(typeof result.score).toBe('number');
    expect(Array.isArray(result.signals)).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
  });

  it('gradeStructure returns DimensionResult', () => {
    const grader = createGrader();
    const result = grader.gradeStructure('{"valid": true}', 'json');
    expect(typeof result.score).toBe('number');
    expect(Array.isArray(result.signals)).toBe(true);
  });

  it('gradeCoherence returns DimensionResult', () => {
    const grader = createGrader();
    const result = grader.gradeCoherence(
      'The quick brown fox jumps over the lazy dog. This is a coherent sentence.',
    );
    expect(typeof result.score).toBe('number');
    expect(Array.isArray(result.signals)).toBe(true);
  });

  it('detectHallucinations returns DimensionResult', () => {
    const grader = createGrader();
    const result = grader.detectHallucinations(
      'I think maybe perhaps this might possibly be correct, but I am not sure.',
    );
    expect(typeof result.score).toBe('number');
    expect(Array.isArray(result.signals)).toBe(true);
  });

  it('detectTruncation returns DimensionResult', () => {
    const grader = createGrader();
    const result = grader.detectTruncation('Complete sentence with proper ending.');
    expect(typeof result.score).toBe('number');
    expect(Array.isArray(result.signals)).toBe(true);
  });

  it('detectRefusal returns DimensionResult', () => {
    const grader = createGrader();
    const result = grader.detectRefusal("I'm sorry, I can't help with that request.");
    expect(typeof result.score).toBe('number');
    expect(Array.isArray(result.signals)).toBe(true);
  });

  it('gradeRelevance returns DimensionResult', () => {
    const grader = createGrader();
    const result = grader.gradeRelevance(
      'Paris is the capital of France.',
      'What is the capital of France?',
    );
    expect(typeof result.score).toBe('number');
    expect(Array.isArray(result.signals)).toBe(true);
  });

  it('gradeFormatCompliance returns DimensionResult', () => {
    const grader = createGrader();
    const result = grader.gradeFormatCompliance('{"key": "value"}', 'json');
    expect(typeof result.score).toBe('number');
    expect(Array.isArray(result.signals)).toBe(true);
  });
});
