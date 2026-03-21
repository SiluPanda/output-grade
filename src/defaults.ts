import type { DimensionId } from './types';

/** Default weight for each dimension. All 8 weights sum to 1.0. */
export const DEFAULT_WEIGHTS: Record<DimensionId, number> = {
  'schema-completeness': 0.20,
  'structural-validity': 0.20,
  'content-coherence':   0.15,
  'hallucination-risk':  0.15,
  'truncation-risk':     0.10,
  'refusal-detection':   0.10,
  'relevance':           0.05,
  'format-compliance':   0.05,
};

/** Configuration for a critical dimension floor. */
export interface CriticalFloorConfig {
  /** If dimension score < threshold, apply the composite ceiling. */
  threshold: number;

  /** Maximum composite score when this floor is active. */
  ceiling: number;
}

/**
 * Default critical dimension floors.
 *
 * If a dimension's score falls below its threshold, the composite score
 * is capped at the associated ceiling regardless of other dimension scores.
 */
export const CRITICAL_FLOORS: Partial<Record<DimensionId, CriticalFloorConfig>> = {
  'structural-validity': { threshold: 0.2, ceiling: 0.3 },
  'truncation-risk':     { threshold: 0.2, ceiling: 0.3 },
  'refusal-detection':   { threshold: 0.3, ceiling: 0.2 },
};

/** Composite score >= this value is considered a pass. */
export const DEFAULT_PASS_THRESHOLD = 0.7;

/**
 * Redistribute weights when some dimensions are excluded (e.g., because
 * no schema, prompt, or format was provided).
 *
 * Returns a new weights map where:
 * - Excluded dimensions have weight 0.
 * - Active dimensions' weights are scaled so they sum to 1.0.
 * - If ALL dimensions are excluded, returns the original map unchanged.
 * - The original `base` object is never mutated.
 */
export function redistributeWeights(
  base: Record<DimensionId, number>,
  excluded: DimensionId[],
): Record<DimensionId, number> {
  const excludedSet = new Set(excluded);
  const active = (Object.entries(base) as [DimensionId, number][]).filter(
    ([id]) => !excludedSet.has(id),
  );
  const total = active.reduce((sum, [, w]) => sum + w, 0);

  // Graceful: if everything excluded (total == 0), return original unchanged.
  if (total === 0) {
    return { ...base };
  }

  const result: Record<DimensionId, number> = { ...base };

  for (const [id, w] of active) {
    result[id] = w / total;
  }

  for (const id of excluded) {
    result[id] = 0;
  }

  return result;
}
