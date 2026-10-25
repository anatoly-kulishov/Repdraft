#!/usr/bin/env node
/**
 * Domain guard: runs every `run*SelfCheck` we have plus the CSV import fixtures
 * against the real catalog. Fails loudly on drift (catalog renames, format rules).
 *
 * Why a script: the repo has no test runner, and self-checks were never invoked.
 * This makes the domain contract executable.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = mkdtempSync(join(tmpdir(), 'repdraft-domain-check-'));

function compileDomain() {
	execFileSync(
		'npx',
		[
			'tsc',
			'src/lib/domain/importCsv.ts',
			'src/lib/domain/coach.ts',
			'--ignoreConfig',
			'--ignoreDeprecations',
			'6.0',
			'--outDir',
			outDir,
			'--module',
			'commonjs',
			'--target',
			'es2022',
			'--moduleResolution',
			'node10',
			'--skipLibCheck',
			'--esModuleInterop'
		],
		{ cwd: root, stdio: 'inherit' }
	);
}

const cases = [
	{ file: 'strong.csv', format: 'strong', sessions: 2, sets: 7 },
	{ file: 'hevy.csv', format: 'hevy', sessions: 1, sets: 3 },
	{ file: 'fitnotes.csv', format: 'fitnotes', sessions: 1, sets: 3 },
	{ file: 'generic.csv', format: 'generic', sessions: 1, sets: 2 }
];

function run() {
	compileDomain();

	const require = createRequire(import.meta.url);
	const domain = require(join(outDir, 'domain', 'importCsv.js'));
	const coach = require(join(outDir, 'domain', 'coach.js'));
	const catalog = JSON.parse(
		readFileSync(join(root, 'static', 'data', 'exercises.index.json'), 'utf8')
	);

	domain.runImportCsvSelfCheck();
	console.log('✓ import self-check');
	coach.runCoachSelfCheck();
	console.log('✓ coach self-check');

	const failures = [];
	for (const testCase of cases) {
		const text = readFileSync(join(root, 'scripts', 'fixtures', 'import', testCase.file), 'utf8');
		const result = domain.parseCsvImport(text, { catalog });
		if (!result.ok) {
			failures.push(`${testCase.file}: parse failed (${result.reason})`);
			continue;
		}
		const { report } = result;
		const problems = [];
		if (report.format !== testCase.format) problems.push(`format ${report.format}`);
		if (report.sessions !== testCase.sessions) problems.push(`sessions ${report.sessions}`);
		if (report.sets !== testCase.sets) problems.push(`sets ${report.sets}`);
		if (problems.length > 0) {
			failures.push(`${testCase.file}: expected ${testCase.format}/${testCase.sessions}/${testCase.sets}, got ${problems.join(', ')}`);
			continue;
		}
		console.log(
			`✓ ${testCase.file}: ${report.sessions} sessions, ${report.sets} sets, matched ${report.matchedExercises}, new ${report.customExercises.length}`
		);
	}

	// Strong has no unit column: the lb toggle must convert.
	const lb = domain.parseCsvImport(
		readFileSync(join(root, 'scripts', 'fixtures', 'import', 'strong.csv'), 'utf8'),
		{ catalog, weightScale: 'lb' }
	);
	const lbWeight = lb.ok ? lb.payload.sessions[0]?.exercises[0]?.sets[0]?.weightKg : null;
	if (lbWeight !== 27.2) {
		failures.push(`strong.csv lb scale: expected 27.2 kg for 60, got ${lbWeight}`);
	} else {
		console.log('✓ strong.csv lb → kg conversion');
	}

	if (failures.length > 0) {
		console.error('\nImport check failed:');
		for (const failure of failures) console.error(`  • ${failure}`);
		process.exitCode = 1;
		return;
	}
	console.log('\nAll import fixtures OK');
}

try {
	run();
} finally {
	rmSync(outDir, { recursive: true, force: true });
}
