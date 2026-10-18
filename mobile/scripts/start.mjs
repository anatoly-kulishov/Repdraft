#!/usr/bin/env node
import { spawn } from 'node:child_process';

console.log(
	'[repdraft] Expo Go must match SDK 57: https://expo.dev/go — or use a dev build for HealthKit.'
);

const child = spawn('npx', ['expo', 'start', ...process.argv.slice(2)], {
	stdio: 'inherit',
	shell: true
});

child.on('exit', (code) => process.exit(code ?? 0));
