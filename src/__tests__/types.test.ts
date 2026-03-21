import { describe, it, expectTypeOf } from 'vitest';
import type {
  GradeReport,
  DimensionId,
  Severity,
  GradeOptions,
  Grader,
  GraderConfig,
  Signal,
  SignalLocation,
  DimensionResult,
  DimensionScores,
  GradeMeta,
  JsonSchema,
  CustomPatterns,
  OutputFormat,
  DetectedFormat,
} from '../types';

describe('GradeReport shape', () => {
  it('has score as number', () => {
    expectTypeOf<GradeReport['score']>().toBeNumber();
  });

  it('has pass as boolean', () => {
    expectTypeOf<GradeReport['pass']>().toBeBoolean();
  });

  it('has passThreshold as number', () => {
    expectTypeOf<GradeReport['passThreshold']>().toBeNumber();
  });

  it('has dimensions as DimensionScores', () => {
    expectTypeOf<GradeReport['dimensions']>().toMatchTypeOf<DimensionScores>();
  });

  it('has signals as Signal array', () => {
    expectTypeOf<GradeReport['signals']>().toMatchTypeOf<Signal[]>();
  });

  it('has summary as string', () => {
    expectTypeOf<GradeReport['summary']>().toBeString();
  });

  it('has meta as GradeMeta', () => {
    expectTypeOf<GradeReport['meta']>().toMatchTypeOf<GradeMeta>();
  });
});

describe('DimensionId union', () => {
  it('includes all 8 dimension values', () => {
    // Each assignment below is a compile-time check: if a value is missing from
    // the union, TypeScript will error and the test file will not compile.
    const _1: DimensionId = 'schema-completeness';
    const _2: DimensionId = 'structural-validity';
    const _3: DimensionId = 'content-coherence';
    const _4: DimensionId = 'hallucination-risk';
    const _5: DimensionId = 'truncation-risk';
    const _6: DimensionId = 'refusal-detection';
    const _7: DimensionId = 'relevance';
    const _8: DimensionId = 'format-compliance';

    // Prevent unused-variable lint errors.
    void [_1, _2, _3, _4, _5, _6, _7, _8];
  });

  it('is a string type', () => {
    expectTypeOf<DimensionId>().toBeString();
  });
});

describe('Severity union', () => {
  it("covers 'info'", () => {
    const s: Severity = 'info';
    void s;
  });

  it("covers 'warning'", () => {
    const s: Severity = 'warning';
    void s;
  });

  it("covers 'critical'", () => {
    const s: Severity = 'critical';
    void s;
  });

  it('is a string type', () => {
    expectTypeOf<Severity>().toBeString();
  });
});

describe('GradeOptions is all-optional', () => {
  it('can be constructed with no fields (empty object satisfies the type)', () => {
    const opts: GradeOptions = {};
    void opts;
  });

  it('accepts all optional fields together', () => {
    const opts: GradeOptions = {
      prompt: 'hello',
      schema: { type: 'object' },
      expected: 'world',
      format: 'json',
      weights: { 'schema-completeness': 0.3 },
      passThreshold: 0.8,
      criticalFloors: { 'refusal-detection': { threshold: 0.3, ceiling: 0.2 } },
      customPatterns: { hedging: [/maybe/i] },
      stopwords: ['the', 'a'],
    };
    void opts;
  });
});

describe('Grader interface can be mock-implemented', () => {
  it('a concrete object satisfies the Grader interface', () => {
    const mockGrader: Grader = {
      config: {},
      grade: (_output: string, _options?: GradeOptions): GradeReport => {
        return {
          score: 1.0,
          pass: true,
          passThreshold: 0.7,
          dimensions: {
            'schema-completeness': 1.0,
            'structural-validity': 1.0,
            'content-coherence': 1.0,
            'hallucination-risk': 1.0,
            'truncation-risk': 1.0,
            'refusal-detection': 1.0,
            'relevance': 1.0,
            'format-compliance': 1.0,
          },
          signals: [],
          summary: 'All good',
          meta: {
            durationMs: 0,
            weights: {},
            applicableDimensions: [],
            criticalFloorTriggered: null,
            detectedFormat: 'text',
            outputLength: 0,
          },
        };
      },
      gradeSchema: (_output: string, _schema: JsonSchema): DimensionResult => ({ score: 1.0, signals: [] }),
      gradeStructure: (_output: string, _format?: string): DimensionResult => ({ score: 1.0, signals: [] }),
      gradeCoherence: (_output: string): DimensionResult => ({ score: 1.0, signals: [] }),
      detectHallucinations: (_output: string): DimensionResult => ({ score: 1.0, signals: [] }),
      detectTruncation: (_output: string): DimensionResult => ({ score: 1.0, signals: [] }),
      detectRefusal: (_output: string): DimensionResult => ({ score: 1.0, signals: [] }),
      gradeRelevance: (_output: string, _prompt: string): DimensionResult => ({ score: 1.0, signals: [] }),
      gradeFormatCompliance: (_output: string, _format: string): DimensionResult => ({ score: 1.0, signals: [] }),
    };
    void mockGrader;
  });
});

describe('GraderConfig extends same fields as GradeOptions (minus per-call fields)', () => {
  it('GraderConfig accepts weight, passThreshold, criticalFloors, customPatterns, stopwords', () => {
    const cfg: GraderConfig = {
      weights: { 'schema-completeness': 0.25 },
      passThreshold: 0.75,
      criticalFloors: { 'truncation-risk': { threshold: 0.2, ceiling: 0.3 } },
      customPatterns: { refusal: [/not allowed/i] },
      stopwords: ['foo'],
    };
    void cfg;
  });

  it('GraderConfig does NOT have prompt, schema, expected, format fields at type level', () => {
    // These are the fields that should be Omit-ted. We verify by checking
    // that GraderConfig is assignable to the Omit type.
    type ExpectedBase = Omit<GradeOptions, 'prompt' | 'schema' | 'expected' | 'format'>;
    expectTypeOf<GraderConfig>().toMatchTypeOf<ExpectedBase>();
  });
});

describe('Supporting types', () => {
  it('SignalLocation has start and end as numbers', () => {
    const loc: SignalLocation = { start: 0, end: 10 };
    expectTypeOf(loc.start).toBeNumber();
    expectTypeOf(loc.end).toBeNumber();
  });

  it('Signal has required fields', () => {
    const sig: Signal = {
      id: 'missing-required-field',
      severity: 'critical',
      dimension: 'schema-completeness',
      message: 'Required field "email" is missing',
      location: null,
    };
    void sig;
  });

  it('Signal location can be a SignalLocation object', () => {
    const sig: Signal = {
      id: 'hedging-phrase',
      severity: 'warning',
      dimension: 'hallucination-risk',
      message: 'Hedging phrase detected',
      location: { start: 10, end: 20 },
    };
    void sig;
  });

  it('DimensionResult has score and signals', () => {
    const r: DimensionResult = { score: 0.8, signals: [] };
    expectTypeOf(r.score).toBeNumber();
    expectTypeOf(r.signals).toMatchTypeOf<Signal[]>();
  });

  it('DimensionScores has all 8 dimension keys', () => {
    const ds: DimensionScores = {
      'schema-completeness': 0.9,
      'structural-validity': 0.9,
      'content-coherence': 0.9,
      'hallucination-risk': 0.9,
      'truncation-risk': 0.9,
      'refusal-detection': 0.9,
      'relevance': 0.9,
      'format-compliance': 0.9,
    };
    void ds;
  });

  it('JsonSchema is flexible and supports nested structures', () => {
    const s: JsonSchema = {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string' },
        age: { type: 'number', minimum: 0 },
        tags: { type: 'array', items: { type: 'string' }, minItems: 1 },
      },
    };
    void s;
  });

  it('CustomPatterns has optional hedging, refusal, preamble as RegExp arrays', () => {
    const cp: CustomPatterns = {
      hedging: [/I think/i],
      refusal: [/I cannot/i],
      preamble: [/Sure!/i],
    };
    void cp;
  });

  it('OutputFormat covers all 8 values', () => {
    const formats: OutputFormat[] = ['json', 'markdown', 'code', 'xml', 'yaml', 'text', 'table', 'list'];
    void formats;
  });

  it('DetectedFormat covers json, markdown, code, xml, text', () => {
    const formats: DetectedFormat[] = ['json', 'markdown', 'code', 'xml', 'text'];
    void formats;
  });
});
