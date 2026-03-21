import type {
  GraderConfig,
  Grader,
  GradeOptions,
  GradeReport,
  DimensionResult,
  JsonSchema,
} from './types';
import { grade } from './grade';
import { scoreSchemaCompleteness } from './dimensions/schema-completeness';
import { scoreStructuralValidity } from './dimensions/structural-validity';
import { scoreContentCoherence } from './dimensions/content-coherence';
import { scoreHallucinationRisk } from './dimensions/hallucination-risk';
import { scoreTruncationRisk } from './dimensions/truncation-risk';
import { scoreRefusalDetection } from './dimensions/refusal-detection';
import { scoreRelevance } from './dimensions/relevance';
import { scoreFormatCompliance } from './dimensions/format-compliance';

/**
 * Create a preconfigured grader instance.
 *
 * The returned grader stores reusable configuration (weights, passThreshold,
 * criticalFloors, customPatterns, stopwords) and exposes a `grade()` method
 * that merges instance config with per-call options (per-call takes precedence).
 *
 * Also exposes per-dimension convenience methods that delegate to the
 * underlying dimension scorers.
 */
export function createGrader(config: GraderConfig = {}): Grader {
  // Freeze a copy of the config so callers cannot mutate internal state.
  const frozenConfig: GraderConfig = Object.freeze({ ...config });

  return {
    grade(output: string, options?: GradeOptions): GradeReport {
      // Merge instance config with per-call options (per-call takes precedence).
      const merged: GradeOptions = {
        // Per-call scalar options (prompt, schema, expected, format) come only
        // from options — they are not part of GraderConfig.
        ...options,
        // For shared fields, per-call overrides instance config.
        weights: options?.weights ?? frozenConfig.weights,
        passThreshold: options?.passThreshold ?? frozenConfig.passThreshold,
        criticalFloors: options?.criticalFloors ?? frozenConfig.criticalFloors,
        customPatterns: options?.customPatterns ?? frozenConfig.customPatterns,
        stopwords: options?.stopwords ?? frozenConfig.stopwords,
      };
      return grade(output, merged);
    },

    gradeSchema(output: string, schema: JsonSchema): DimensionResult {
      return scoreSchemaCompleteness(output, schema);
    },

    gradeStructure(output: string, format?: string): DimensionResult {
      return scoreStructuralValidity(output, format);
    },

    gradeCoherence(output: string): DimensionResult {
      return scoreContentCoherence(output);
    },

    detectHallucinations(output: string): DimensionResult {
      return scoreHallucinationRisk(output);
    },

    detectTruncation(output: string): DimensionResult {
      return scoreTruncationRisk(output);
    },

    detectRefusal(output: string): DimensionResult {
      return scoreRefusalDetection(output);
    },

    gradeRelevance(output: string, prompt: string): DimensionResult {
      return scoreRelevance(output, prompt);
    },

    gradeFormatCompliance(output: string, format: string): DimensionResult {
      return scoreFormatCompliance(output, format);
    },

    get config(): GraderConfig {
      return frozenConfig;
    },
  };
}
