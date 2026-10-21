import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { resolve } from "node:path"
import process from "node:process"

import { diffImages } from "./image-diff.ts"
import { decodePng } from "./png-decode.ts"
import { checkTui } from "./tui-grid.ts"
import type { ImageDiffResult, TuiCheckResult } from "./types.ts"

export class CliError extends Error {
	readonly name = "CliError"
}

const DEFAULT_COLUMNS = 80
const COLS_FLAG = "--cols"

export function runImageDiff(args: readonly string[]): ImageDiffResult {
	const referencePath = args[0]
	const actualPath = args[1]
	if (referencePath === undefined || actualPath === undefined) {
		throw new CliError("usage: image-diff <reference.png> <actual.png>")
	}
	const reference = decodePng(readFileSync(referencePath))
	const actual = decodePng(readFileSync(actualPath))
	return diffImages(reference, actual)
}

function parseColumns(args: readonly string[]): number {
	for (let index = 0; index < args.length; index++) {
		const arg = args[index] ?? ""
		if (arg === COLS_FLAG) {
			const parsed = Number(args[index + 1])
			if (!Number.isInteger(parsed) || parsed <= 0) {
				throw new CliError(`${COLS_FLAG} requires a positive integer`)
			}
			return parsed
		}
		if (arg.startsWith(`${COLS_FLAG}=`)) {
			const parsed = Number(arg.slice(COLS_FLAG.length + 1))
			if (!Number.isInteger(parsed) || parsed <= 0) {
				throw new CliError(`${COLS_FLAG} requires a positive integer`)
			}
			return parsed
		}
	}
	return DEFAULT_COLUMNS
}

export function runTuiCheck(args: readonly string[]): TuiCheckResult {
	const capturePath = args[0]
	if (capturePath === undefined || capturePath.startsWith("--")) {
		throw new CliError("usage: tui-check <capture.txt> [--cols N]")
	}
	const text = readFileSync(capturePath, "utf8")
	return checkTui(text, parseColumns(args.slice(1)))
}

export function run(argv: readonly string[]): ImageDiffResult | TuiCheckResult {
	const command = argv[0]
	const rest = argv.slice(1)
	switch (command) {
		case "image-diff":
			return runImageDiff(rest)
		case "tui-check":
			return runTuiCheck(rest)
		default:
			throw new CliError(`unknown command "${command ?? ""}"; expected "image-diff" or "tui-check"`)
	}
}

function main(argv: readonly string[]): void {
	try {
		const result = run(argv)
		process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error)
		process.stderr.write(`visual-qa error: ${message}\n`)
		process.exitCode = 1
	}
}

// Entry guard that works under both bun and Node (`--experimental-strip-types`).
function isMainModule(): boolean {
	const entry = process.argv[1]
	if (entry === undefined) return false
	try {
		return resolve(fileURLToPath(import.meta.url)) === resolve(entry)
	} catch {
		return false
	}
}

if (isMainModule()) {
	main(process.argv.slice(2))
}
