#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import { grade } from './grade';
import type { GradeOptions, GradeReport } from './types';

// ── Argument Parsing ─────────────────────────────────────────────────────────

interface CliArgs {
  input: string;
  format: 'json' | 'human';
  prompt?: string;
  schema?: string;
}

function parseArgs(argv: string[]): CliArgs | null {
  // argv[0] = node, argv[1] = script
  const args = argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    return null;
  }

  let inputArg = args[0]!;
  let format: 'json' | 'human' = 'human';
  let prompt: string | undefined;
  let schema: string | undefined;

  let i = 1;
  while (i < args.length) {
    const flag = args[i]!;
    if (flag === '--format' && i + 1 < args.length) {
      const val = args[++i]!;
      if (val === 'json' || val === 'human') {
        format = val;
      } else {
        process.stderr.write(`Unknown format: ${val}. Use json or human.\n`);
        process.exit(1);
      }
    } else if (flag === '--prompt' && i + 1 < args.length) {
      prompt = args[++i];
    } else if (flag === '--schema' && i + 1 < args.length) {
      schema = args[++i];
    } else {
      process.stderr.write(`Unknown option: ${flag}\n`);
      process.exit(1);
    }
    i++;
  }

  return { input: inputArg, format, prompt, schema };
}

function printHelp(): void {
  process.stdout.write([
    'Usage: output-grade <text-or-file> [options]',
    '',
    'Arguments:',
    '  <text-or-file>  Text to grade, or path to a file containing text',
    '',
    'Options:',
    '  --format <json|human>  Output format (default: human)',
    '  --prompt <text>        Original prompt for relevance scoring',
    '  --schema <json>        JSON schema string for schema-completeness scoring',
    '  --help, -h             Show this help message',
    '',
  ].join('\n'));
}

// ── Input Resolution ─────────────────────────────────────────────────────────

function resolveInput(input: string): string {
  // Treat as a file path if: starts with ./ or ../ or /, or has a known extension
  const looksLikePath = /^[./]/.test(input) || /\.\w{1,5}$/.test(input);
  if (looksLikePath) {
    const resolved = path.resolve(input);
    try {
      return fs.readFileSync(resolved, 'utf8');
    } catch {
      process.stderr.write(`Cannot read file: ${resolved}\n`);
      process.exit(1);
    }
  }
  return input;
}

// ── Human Output ─────────────────────────────────────────────────────────────

function printHuman(report: GradeReport): void {
  const { score, pass, dimensions, signals, summary, meta } = report;

  process.stdout.write(`\noutput-grade report\n`);
  process.stdout.write(`${'─'.repeat(40)}\n`);
  process.stdout.write(`Score:   ${(score * 100).toFixed(1)}%  (${pass ? 'PASS' : 'FAIL'})\n`);
  process.stdout.write(`Summary: ${summary}\n\n`);

  process.stdout.write(`Dimensions:\n`);
  for (const [dim, val] of Object.entries(dimensions)) {
    const pct = ((val as number) * 100).toFixed(1).padStart(5);
    process.stdout.write(`  ${dim.padEnd(24)} ${pct}%\n`);
  }

  if (signals.length > 0) {
    process.stdout.write(`\nSignals (${signals.length}):\n`);
    for (const sig of signals) {
      const loc = sig.location ? ` [${sig.location.start}-${sig.location.end}]` : '';
      process.stdout.write(`  [${sig.severity.toUpperCase().padEnd(8)}] ${sig.message}${loc}\n`);
    }
  }

  process.stdout.write(`\nFormat detected: ${meta.detectedFormat}  |  Length: ${meta.outputLength} chars  |  ${meta.durationMs}ms\n`);
}

// ── Main ─────────────────────────────────────────────────────────────────────

function main(): void {
  const parsed = parseArgs(process.argv);

  if (parsed === null) {
    printHelp();
    process.exit(0);
  }

  const text = resolveInput(parsed.input);

  const options: GradeOptions = {};
  if (parsed.prompt) options.prompt = parsed.prompt;
  if (parsed.schema) {
    try {
      options.schema = JSON.parse(parsed.schema);
    } catch {
      process.stderr.write(`Invalid JSON schema: ${parsed.schema}\n`);
      process.exit(1);
    }
  }

  const report = grade(text, options);

  if (parsed.format === 'json') {
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  } else {
    printHuman(report);
  }

  process.exit(report.pass ? 0 : 1);
}

main();
