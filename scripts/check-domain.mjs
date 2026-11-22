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
			'src/lib/domain/coachHints.ts',
			'src/lib/domain/coachInsights.ts',
			'src/lib/domain/trainingLoad.ts',
			'src/lib/domain/progressOverview.ts',
			'src/lib/domain/feedback.ts',
			'src/lib/domain/rateLimitWindow.ts',
			'src/lib/domain/articles.ts',
			'src/lib/domain/sessionLifecycle.ts',
			'src/lib/domain/sessionLog.ts',
			'src/lib/domain/sessionPayoff.ts',
			'src/lib/domain/networkError.ts',
			'src/lib/domain/entitlement.ts',
			'src/lib/domain/recognizeProgram.ts',
			'src/lib/domain/planTune.ts',
			'src/lib/domain/homeKit.ts',
			'src/lib/domain/athleteProfile.ts',
			'src/lib/domain/replacementCandidates.ts',
			'src/lib/domain/cycle.ts',
			'src/lib/domain/tools.ts',
			'src/lib/domain/sessionRating.ts',
			'src/lib/domain/programs.ts',
			'src/lib/domain/exercisePick.ts',
			'src/lib/seo/alternates.ts',
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
	const coachHints = require(join(outDir, 'domain', 'coachHints.js'));
	const coachInsights = require(join(outDir, 'domain', 'coachInsights.js'));
	const trainingLoad = require(join(outDir, 'domain', 'trainingLoad.js'));
	const progressOverview = require(join(outDir, 'domain', 'progressOverview.js'));
	const feedback = require(join(outDir, 'domain', 'feedback.js'));
	const rateLimitWindow = require(join(outDir, 'domain', 'rateLimitWindow.js'));
	const articlesDomain = require(join(outDir, 'domain', 'articles.js'));
	const sessionLifecycle = require(join(outDir, 'domain', 'sessionLifecycle.js'));
	const sessionLog = require(join(outDir, 'domain', 'sessionLog.js'));
	const sessionPayoff = require(join(outDir, 'domain', 'sessionPayoff.js'));
	const networkError = require(join(outDir, 'domain', 'networkError.js'));
	const entitlement = require(join(outDir, 'domain', 'entitlement.js'));
	const recognizeProgram = require(join(outDir, 'domain', 'recognizeProgram.js'));
	const planTune = require(join(outDir, 'domain', 'planTune.js'));
	const homeKit = require(join(outDir, 'domain', 'homeKit.js'));
	const athleteProfile = require(join(outDir, 'domain', 'athleteProfile.js'));
	const replacementCandidates = require(join(outDir, 'domain', 'replacementCandidates.js'));
	const cycleDomain = require(join(outDir, 'domain', 'cycle.js'));
	const toolsDomain = require(join(outDir, 'domain', 'tools.js'));
	const sessionRatingDomain = require(join(outDir, 'domain', 'sessionRating.js'));
	const programsDomain = require(join(outDir, 'domain', 'programs.js'));
	const exercisePickDomain = require(join(outDir, 'domain', 'exercisePick.js'));
	const alternates = require(join(outDir, 'seo', 'alternates.js'));
	const catalog = JSON.parse(
		readFileSync(join(root, 'static', 'data', 'exercises.index.json'), 'utf8')
	);

	domain.runImportCsvSelfCheck();
	console.log('✓ import self-check');
	coach.runCoachSelfCheck();
	console.log('✓ coach self-check');
	coachHints.runCoachHintsSelfCheck();
	console.log('✓ coach hints self-check');
	coachInsights.runCoachInsightsSelfCheck();
	console.log('✓ coach insights self-check');
	trainingLoad.runTrainingLoadSelfCheck();
	console.log('✓ training load self-check');
	progressOverview.runProgressOverviewSelfCheck();
	console.log('✓ progress overview self-check');
	feedback.runFeedbackSelfCheck();
	console.log('✓ feedback self-check');
	rateLimitWindow.runRateLimitWindowSelfCheck();
	console.log('✓ rate limit window self-check');
	articlesDomain.runArticlesSelfCheck();
	console.log('✓ articles self-check');
	sessionLifecycle.runSessionLifecycleSelfCheck();
	console.log('✓ session lifecycle self-check');
	sessionLog.runSessionLogSelfCheck();
	console.log('✓ session log self-check');
	sessionPayoff.runSessionPayoffSelfCheck();
	console.log('✓ session payoff self-check');
	networkError.runNetworkErrorSelfCheck();
	console.log('✓ network error self-check');
	entitlement.runEntitlementSelfCheck();
	console.log('✓ entitlement self-check');
	recognizeProgram.runRecognizeProgramSelfCheck();
	console.log('✓ recognize program self-check');
	planTune.runPlanTuneSelfCheck();
	console.log('✓ plan tune self-check');
	homeKit.runHomeKitSelfCheck();
	console.log('✓ home kit self-check');
	athleteProfile.runAthleteProfileSelfCheck();
	console.log('✓ athlete profile self-check');
	replacementCandidates.runReplacementCandidatesSelfCheck();
	console.log('✓ replacement candidates self-check');
	cycleDomain.runCycleSelfCheck();
	console.log('✓ cycle self-check');
	toolsDomain.runToolsSelfCheck();
	console.log('✓ tools self-check');
	sessionRatingDomain.runSessionRatingSelfCheck();
	console.log('✓ session rating self-check');
	programsDomain.runProgramsSelfCheck();
	console.log('✓ programs self-check');
	exercisePickDomain.runExercisePickSelfCheck();
	console.log('✓ exercise pick self-check');
	alternates.runAlternatesSelfCheck();
	console.log('✓ URL alternates self-check');

	// Real catalog: every program session must still build after a catalog rebuild.
	const realCatalog = JSON.parse(
		readFileSync(join(root, 'static/data/exercises.index.json'), 'utf8')
	);
	const catalogProblems = [];
	let programSessions = 0;
	for (const program of programsDomain.PROGRAMS) {
		for (const session of program.sessions) {
			for (let week = 1; week <= program.weeks; week++) {
				const prescription = programsDomain.sessionPrescription(session, week);
				const rows = programsDomain.buildSessionExercises({
					session,
					prescription,
					catalog: realCatalog,
					equipment: program.equipment
				});
				programSessions += 1;
				const ids = new Set(rows.map((row) => row.exerciseId));
				const label = `${program.slug}/${session.id}/w${week}`;
				if (rows.length < 3) catalogProblems.push(`${label}: ${rows.length} exercises`);
				if (ids.size !== rows.length) catalogProblems.push(`${label}: duplicate ids`);
				if (rows.some((row) => row.sets !== prescription.sets || row.reps !== prescription.reps)) {
					catalogProblems.push(`${label}: prescription drift`);
				}
				for (const row of rows) {
					const picked = realCatalog.find((item) => item.id === row.exerciseId);
					if (!picked || !exercisePickDomain.exerciseMatchesEquipment(picked, program.equipment)) {
						catalogProblems.push(`${label}: ${row.exerciseId} outside the advertised kit`);
					}
				}
			}
		}
	}
	for (const program of programsDomain.PROGRAMS) {
		const minutes = programsDomain.programSessionMinutes(program);
		if (minutes.min < 15 || minutes.max > 120) {
			catalogProblems.push(`${program.slug}: session minutes ${minutes.min}-${minutes.max}`);
		}
		for (const kit of program.equipment) {
			if (kit !== 'body weight' && !realCatalog.some((item) => item.equipment === kit)) {
				catalogProblems.push(`${program.slug}: kit value «${kit}» is missing from the catalog`);
			}
		}
	}
	if (catalogProblems.length > 0) {
		throw new Error(`programs: real catalog\n${catalogProblems.join('\n')}`);
	}
	console.log(`✓ programs against real catalog (${programSessions} sessions)`);

	// Real catalog: the swap list for a bench press must lead with the same target
	// muscle and never offer the exercise being replaced.
	const seedPress = catalog.find((item) => item.id === '0025');
	const swapTop = seedPress
		? replacementCandidates.rankReplacementCandidates(catalog, seedPress, { limit: 10 })
		: [];
	if (
		swapTop.length !== 10 ||
		swapTop[0].item.target !== seedPress?.target ||
		swapTop.some((row) => row.item.id === seedPress?.id)
	) {
		throw new Error('replacementCandidates: real catalog lead/target drift');
	}

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
