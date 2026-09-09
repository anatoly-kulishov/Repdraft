/**
 * Mode B native web assets: static SPA into `build/`, then optional `cap sync`.
 * Mode A (CAP_SERVER_URL set): still produces a local shell sync target; runtime loads remote.
 */
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const skipSync = process.argv.includes('--no-sync');

function run(cmd, args, env = {}) {
	const result = spawnSync(cmd, args, {
		cwd: root,
		stdio: 'inherit',
		env: { ...process.env, ...env },
		shell: false
	});
	if (result.status !== 0) {
		process.exit(result.status ?? 1);
	}
}

run(process.execPath, [join(root, 'scripts/native-route-mask.mjs'), 'hide']);

let buildStatus = 0;
try {
	const build = spawnSync(
		process.execPath,
		[
			join(root, 'node_modules/vite/bin/vite.js'),
			'build'
		],
		{
			cwd: root,
			stdio: 'inherit',
			env: {
				...process.env,
				APP_TARGET: 'capacitor',
				PUBLIC_APP_NATIVE: '1',
				NODE_ENV: 'production'
			}
		}
	);
	buildStatus = build.status ?? 1;
} finally {
	run(process.execPath, [join(root, 'scripts/native-route-mask.mjs'), 'show']);
}

if (buildStatus !== 0) process.exit(buildStatus);

	if (!skipSync) {
		run(process.execPath, [join(root, 'node_modules/@capacitor/cli/bin/capacitor'), 'sync']);
		run(process.execPath, [join(root, 'scripts/patch-native-deeplinks.mjs')]);
	}
