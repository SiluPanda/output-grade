import type { PatternEntry } from './hedging';

export const CONFIDENCE_PATTERNS: PatternEntry[] = [
  { pattern: /\bdefinitely\b/i, category: 'confidence-inflation', severity: 'warning', label: 'definitely' },
  { pattern: /\bcertainly\b/i, category: 'confidence-inflation', severity: 'info', label: 'certainly' },
  { pattern: /\bwithout a doubt\b/i, category: 'confidence-inflation', severity: 'warning', label: 'without a doubt' },
  { pattern: /\b100%/i, category: 'confidence-inflation', severity: 'warning', label: '100%' },
  { pattern: /\bguaranteed?\b/i, category: 'confidence-inflation', severity: 'warning', label: 'guaranteed' },
  { pattern: /\balways\b/i, category: 'confidence-inflation', severity: 'info', label: 'always' },
  { pattern: /\bnever\b/i, category: 'confidence-inflation', severity: 'info', label: 'never' },
  { pattern: /\babsolutely\b/i, category: 'confidence-inflation', severity: 'warning', label: 'absolutely' },
];
