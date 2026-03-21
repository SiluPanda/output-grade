export interface PatternEntry {
  pattern: RegExp;
  category: string;
  severity: 'info' | 'warning' | 'critical';
  label: string;
}

export const HEDGING_PATTERNS: PatternEntry[] = [
  // Belief qualifiers
  { pattern: /\bI think\b/i, category: 'belief-qualifier', severity: 'info', label: 'I think' },
  { pattern: /\bI believe\b/i, category: 'belief-qualifier', severity: 'info', label: 'I believe' },
  { pattern: /\bI'm not sure\b/i, category: 'belief-qualifier', severity: 'warning', label: "I'm not sure" },
  { pattern: /\bI'm not certain\b/i, category: 'belief-qualifier', severity: 'warning', label: "I'm not certain" },
  // Possibility markers
  { pattern: /\bprobably\b/i, category: 'possibility', severity: 'info', label: 'probably' },
  { pattern: /\bpossibly\b/i, category: 'possibility', severity: 'info', label: 'possibly' },
  { pattern: /\bperhaps\b/i, category: 'possibility', severity: 'info', label: 'perhaps' },
  { pattern: /\bmight\b/i, category: 'possibility', severity: 'info', label: 'might' },
  { pattern: /\bcould be\b/i, category: 'possibility', severity: 'info', label: 'could be' },
  // Approximation markers
  { pattern: /\bapproximately\b/i, category: 'approximation', severity: 'info', label: 'approximately' },
  { pattern: /\broughly\b/i, category: 'approximation', severity: 'info', label: 'roughly' },
  { pattern: /\babout\b/i, category: 'approximation', severity: 'info', label: 'about' },
  // Uncertainty disclaimers
  { pattern: /\bI'm not 100% sure\b/i, category: 'uncertainty', severity: 'warning', label: "I'm not 100% sure" },
  { pattern: /\bdon't quote me\b/i, category: 'uncertainty', severity: 'warning', label: "don't quote me" },
  // Knowledge cutoff
  { pattern: /\bas of my (?:last |knowledge )?(?:update|cutoff|training)\b/i, category: 'knowledge-cutoff', severity: 'warning', label: 'knowledge cutoff reference' },
  { pattern: /\bmy training data\b/i, category: 'knowledge-cutoff', severity: 'warning', label: 'training data reference' },
];
