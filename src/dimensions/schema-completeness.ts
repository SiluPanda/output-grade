import type { DimensionResult, Signal, JsonSchema } from '../types';
import { lenientJsonParse } from '../utils/json-parse';

/**
 * Score the schema completeness of an LLM output against a JSON Schema.
 *
 * Checks required/optional field presence, type correctness, and emptiness.
 * Returns a weighted composite score from 0.0 (no fields match) to 1.0
 * (all fields present and correct).
 *
 * If no schema is provided, returns 1.0 (neutral). If the output is not
 * valid JSON, returns 0.0 with a critical signal.
 */
export function scoreSchemaCompleteness(
  output: string,
  schema?: JsonSchema,
): DimensionResult {
  const signals: Signal[] = [];

  // No schema = neutral.
  if (!schema) {
    return { score: 1.0, signals };
  }

  // Parse JSON.
  const parseResult = lenientJsonParse(output);
  if (!parseResult.success) {
    signals.push({
      id: 'schema-parse-failure',
      severity: 'critical',
      dimension: 'schema-completeness',
      message: 'Output is not valid JSON',
      location: null,
    });
    return { score: 0.0, signals };
  }

  const data = parseResult.value as Record<string, unknown>;
  const required = schema.required || [];
  const properties = schema.properties || {};
  const fieldScores: { score: number; weight: number }[] = [];

  // Check required fields.
  for (const key of required) {
    const propSchema = properties[key];
    const value = data[key];

    if (value === undefined) {
      signals.push({
        id: `schema-missing-required-${key}`,
        severity: 'critical',
        dimension: 'schema-completeness',
        message: `Required field "${key}" is missing`,
        location: null,
      });
      fieldScores.push({ score: 0, weight: 1.0 });
    } else if (propSchema?.type && !checkType(value, propSchema.type)) {
      signals.push({
        id: `schema-wrong-type-${key}`,
        severity: 'warning',
        dimension: 'schema-completeness',
        message: `Field "${key}" has wrong type (expected ${propSchema.type})`,
        location: null,
      });
      fieldScores.push({ score: 0.5, weight: 1.0 });
    } else if (isEmpty(value)) {
      signals.push({
        id: `schema-empty-${key}`,
        severity: 'warning',
        dimension: 'schema-completeness',
        message: `Required field "${key}" is empty`,
        location: null,
      });
      fieldScores.push({ score: 0.7, weight: 1.0 });
    } else {
      fieldScores.push({ score: 1.0, weight: 1.0 });
    }
  }

  // Check optional fields (properties not in required).
  for (const key of Object.keys(properties)) {
    if (required.includes(key)) continue;
    const propSchema = properties[key];
    const value = data[key];

    if (value === undefined) {
      fieldScores.push({ score: 0.8, weight: 0.5 });
    } else if (propSchema?.type && !checkType(value, propSchema.type)) {
      signals.push({
        id: `schema-optional-wrong-type-${key}`,
        severity: 'info',
        dimension: 'schema-completeness',
        message: `Optional field "${key}" has wrong type`,
        location: null,
      });
      fieldScores.push({ score: 0.5, weight: 0.5 });
    } else {
      fieldScores.push({ score: 1.0, weight: 0.5 });
    }
  }

  // Composite: weighted average.
  if (fieldScores.length === 0) {
    return { score: 1.0, signals };
  }

  const totalWeight = fieldScores.reduce((sum, f) => sum + f.weight, 0);
  const weightedSum = fieldScores.reduce(
    (sum, f) => sum + f.score * f.weight,
    0,
  );
  const score = weightedSum / totalWeight;

  return { score: Math.max(0, Math.min(1, score)), signals };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function checkType(value: unknown, expectedType: string): boolean {
  switch (expectedType) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number';
    case 'integer':
      return typeof value === 'number' && Number.isInteger(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'array':
      return Array.isArray(value);
    case 'object':
      return value !== null && typeof value === 'object' && !Array.isArray(value);
    case 'null':
      return value === null;
    default:
      return true;
  }
}

function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
}
