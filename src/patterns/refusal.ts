import type { PatternEntry } from './hedging';

export const REFUSAL_PATTERNS: PatternEntry[] = [
  // Direct refusal
  { pattern: /\bI can't help with that\b/i, category: 'direct-refusal', severity: 'critical', label: "I can't help with that" },
  { pattern: /\bI cannot (?:help|assist|provide)\b/i, category: 'direct-refusal', severity: 'critical', label: 'I cannot help/assist/provide' },
  { pattern: /\bI'm unable to\b/i, category: 'direct-refusal', severity: 'critical', label: "I'm unable to" },
  // Policy citation
  { pattern: /\bagainst my (?:guidelines|policies|programming)\b/i, category: 'policy', severity: 'critical', label: 'against my guidelines' },
  { pattern: /\bviolates? my (?:policies|guidelines)\b/i, category: 'policy', severity: 'critical', label: 'violates policies' },
  // Safety refusal
  { pattern: /\bI (?:can't|cannot) provide information on\b/i, category: 'safety', severity: 'critical', label: "can't provide information" },
  { pattern: /\bI must decline\b/i, category: 'safety', severity: 'critical', label: 'I must decline' },
  // Identity disclosure
  { pattern: /\bAs an AI(?: language model| assistant)?\b/i, category: 'identity', severity: 'info', label: 'As an AI' },
  { pattern: /\bI'm (?:just )?an? AI\b/i, category: 'identity', severity: 'info', label: "I'm an AI" },
  // Capability limitation
  { pattern: /\bI don't have access to\b/i, category: 'capability', severity: 'warning', label: "don't have access" },
  { pattern: /\bI (?:can't|cannot) browse\b/i, category: 'capability', severity: 'warning', label: "can't browse" },
  { pattern: /\bI (?:can't|cannot) access (?:the internet|real-time)\b/i, category: 'capability', severity: 'warning', label: "can't access internet" },
  // Redirect
  { pattern: /\bI recommend consulting\b/i, category: 'redirect', severity: 'warning', label: 'recommend consulting' },
  { pattern: /\bplease consult a (?:professional|doctor|lawyer)\b/i, category: 'redirect', severity: 'warning', label: 'consult a professional' },
];
