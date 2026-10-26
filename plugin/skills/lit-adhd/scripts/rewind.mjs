#!/usr/bin/env node
// Fallback CLI entry point for the lit-adhd collector. Run as:
//   node <skill-root>/scripts/rewind.mjs [--json] [--here] [--since 7d] [--max 12]
import { runRewindCli } from '../../../hooks/lib/rewind/collect.mjs';
process.exit(runRewindCli(process.argv.slice(2)));
