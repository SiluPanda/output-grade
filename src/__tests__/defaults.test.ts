import { describe, it, expect } from 'vitest';
import {
  DEFAULT_WEIGHTS,
  CRITICAL_FLOORS,
  DEFAULT_PASS_THRESHOLD,
  redistributeWeights,
} from '../defaults';
import type { DimensionId } from '../types';

const ALL_DIMENSION_IDS: DimensionId[] = [
  'schema-completeness',
  'structural-validity',
  'content-coherence',
  'hallucination-risk',
  'truncation-risk',
  'refusal-detection',
  'relevance',
  'format-compliance',
];

describe('DEFAULT_WEIGHTS', () => {
  it('has exactly 8 keys — one per DimensionId', () => {
    expect(Object.keys(DEFAULT_WEIGHTS)).toHaveLength(8);
  });

  it('contains every DimensionId as a key', () => {
    for (const id of ALL_DIMENSION_IDS) {
      expect(DEFAULT_WEIGHTS).toHaveProperty(id);
    }
  });

  it('values sum to 1.0 within floating-point tolerance (1e-10)', () => {
    const sum = Object.values(DEFAULT_WEIGHTS).reduce((acc, w) => acc + w, 0);
    expect(Math.abs(sum - 1.0)).toBeLessThan(1e-10);
  });

  it('all values are positive (> 0)', () => {
    for (const [id, w] of Object.entries(DEFAULT_WEIGHTS)) {
      expect(w, `weight for "${id}" should be positive`).toBeGreaterThan(0);
    }
  });

  it("schema-completeness weight = 0.20", () => {
    expect(DEFAULT_WEIGHTS['schema-completeness']).toBe(0.20);
  });

  it("structural-validity weight = 0.20", () => {
    expect(DEFAULT_WEIGHTS['structural-validity']).toBe(0.20);
  });

  it("content-coherence weight = 0.15", () => {
    expect(DEFAULT_WEIGHTS['content-coherence']).toBe(0.15);
  });

  it("hallucination-risk weight = 0.15", () => {
    expect(DEFAULT_WEIGHTS['hallucination-risk']).toBe(0.15);
  });

  it("truncation-risk weight = 0.10", () => {
    expect(DEFAULT_WEIGHTS['truncation-risk']).toBe(0.10);
  });

  it("refusal-detection weight = 0.10", () => {
    expect(DEFAULT_WEIGHTS['refusal-detection']).toBe(0.10);
  });

  it("relevance weight = 0.05", () => {
    expect(DEFAULT_WEIGHTS['relevance']).toBe(0.05);
  });

  it("format-compliance weight = 0.05", () => {
    expect(DEFAULT_WEIGHTS['format-compliance']).toBe(0.05);
  });
});

describe('DEFAULT_PASS_THRESHOLD', () => {
  it('equals 0.7', () => {
    expect(DEFAULT_PASS_THRESHOLD).toBe(0.7);
  });
});

describe('CRITICAL_FLOORS', () => {
  it('has exactly 3 entries', () => {
    expect(Object.keys(CRITICAL_FLOORS)).toHaveLength(3);
  });

  it("structural-validity floor: threshold=0.2, ceiling=0.3", () => {
    expect(CRITICAL_FLOORS['structural-validity']).toEqual({ threshold: 0.2, ceiling: 0.3 });
  });

  it("truncation-risk floor: threshold=0.2, ceiling=0.3", () => {
    expect(CRITICAL_FLOORS['truncation-risk']).toEqual({ threshold: 0.2, ceiling: 0.3 });
  });

  it("refusal-detection floor: threshold=0.3, ceiling=0.2", () => {
    expect(CRITICAL_FLOORS['refusal-detection']).toEqual({ threshold: 0.3, ceiling: 0.2 });
  });
});

describe('redistributeWeights', () => {
  it('with no exclusions: returned weights sum to 1.0', () => {
    const result = redistributeWeights(DEFAULT_WEIGHTS, []);
    const sum = Object.values(result).reduce((acc, w) => acc + w, 0);
    expect(Math.abs(sum - 1.0)).toBeLessThan(1e-10);
  });

  it('with no exclusions: values equal original values', () => {
    const result = redistributeWeights(DEFAULT_WEIGHTS, []);
    for (const id of ALL_DIMENSION_IDS) {
      expect(result[id]).toBeCloseTo(DEFAULT_WEIGHTS[id], 10);
    }
  });

  it('excluding one dimension: remaining weights sum to 1.0', () => {
    const result = redistributeWeights(DEFAULT_WEIGHTS, ['schema-completeness']);
    const sum = Object.values(result).reduce((acc, w) => acc + w, 0);
    expect(Math.abs(sum - 1.0)).toBeLessThan(1e-10);
  });

  it('excluding one dimension: excluded dimension has weight 0', () => {
    const result = redistributeWeights(DEFAULT_WEIGHTS, ['schema-completeness']);
    expect(result['schema-completeness']).toBe(0);
  });

  it('excluding one dimension: non-excluded dimensions all have positive weights', () => {
    const excluded = new Set<DimensionId>(['schema-completeness']);
    const result = redistributeWeights(DEFAULT_WEIGHTS, ['schema-completeness']);
    for (const id of ALL_DIMENSION_IDS) {
      if (!excluded.has(id)) {
        expect(result[id], `weight for "${id}" should be > 0`).toBeGreaterThan(0);
      }
    }
  });

  it('excluding multiple dimensions: remaining weights sum to 1.0', () => {
    const excluded: DimensionId[] = ['schema-completeness', 'relevance', 'format-compliance'];
    const result = redistributeWeights(DEFAULT_WEIGHTS, excluded);
    const sum = Object.values(result).reduce((acc, w) => acc + w, 0);
    expect(Math.abs(sum - 1.0)).toBeLessThan(1e-10);
  });

  it('excluding multiple dimensions: each excluded dimension has weight 0', () => {
    const excluded: DimensionId[] = ['schema-completeness', 'relevance', 'format-compliance'];
    const result = redistributeWeights(DEFAULT_WEIGHTS, excluded);
    for (const id of excluded) {
      expect(result[id]).toBe(0);
    }
  });

  it('does not mutate the original base object', () => {
    const original = { ...DEFAULT_WEIGHTS };
    redistributeWeights(DEFAULT_WEIGHTS, ['schema-completeness', 'relevance']);
    for (const id of ALL_DIMENSION_IDS) {
      expect(DEFAULT_WEIGHTS[id]).toBe(original[id]);
    }
  });

  it('gracefully handles all dimensions excluded: returns original weights unchanged', () => {
    const result = redistributeWeights(DEFAULT_WEIGHTS, ALL_DIMENSION_IDS);
    for (const id of ALL_DIMENSION_IDS) {
      expect(result[id]).toBe(DEFAULT_WEIGHTS[id]);
    }
  });

  it('redistributed weights are proportionally scaled from original non-excluded weights', () => {
    // Exclude schema-completeness (0.20). Remaining sum = 0.80.
    // Each remaining dimension should be scaled by 1/0.80 = 1.25.
    const excluded: DimensionId[] = ['schema-completeness'];
    const result = redistributeWeights(DEFAULT_WEIGHTS, excluded);
    const scale = 1 / 0.80;
    for (const id of ALL_DIMENSION_IDS) {
      if (id !== 'schema-completeness') {
        expect(result[id]).toBeCloseTo(DEFAULT_WEIGHTS[id] * scale, 10);
      }
    }
  });
});
