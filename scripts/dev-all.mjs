#!/usr/bin/env node
/**
 * Run web (Vite) + Expo mobile together. Ctrl+C stops both.
 * Usage: npm run dev:all
 */
import { spawn } from 'node:child_process';

console.log(
	'[repdraft] Mobile needs Expo Go for SDK 57 from https://expo.dev/go or a development build (Health, native modules).'
);

const children = [
	spawn('npm', ['run', 'dev'], { stdio: 'inherit', shell: true }),
	spawn('npm', ['run', 'mobile'], { stdio: 'inherit', shell: true })
];

let shuttingDown = false;

function killAll() {
	if (shuttingDown) return;
	shuttingDown = true;
	for (const child of children) {
		try {
			child.kill('SIGTERM');
		} catch {
			/* already gone */
		}
	}
}

process.on('SIGINT', () => {
	killAll();
	process.exit(0);
});
process.on('SIGTERM', () => {
	killAll();
	process.exit(0);
});

for (const child of children) {
	child.on('exit', (code, signal) => {
		if (shuttingDown) return;
		killAll();
		if (signal) process.exit(0);
		process.exit(code ?? 0);
	});
}
