#!/usr/bin/env node
/**
 * Manual deploy to the RF VPS (same layout as GitHub Actions).
 * Requires: built `build/`, ssh access, and .env already on the server.
 *
 *   PUBLIC_SITE_URL=https://www.repdraft.ru npm run build
 *   node scripts/deploy-vps.mjs
 *
 * Env (optional):
 *   VPS_HOST (default 89.108.81.141)
 *   VPS_USER (default root)
 *   VPS_PATH (default /opt/repdraft)
 *   VPS_SSH_KEY (path to private key; else ssh default agent/keys)
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const host = (process.env.VPS_HOST || '89.108.81.141').trim();
const user = (process.env.VPS_USER || 'root').trim();
const remotePath = (process.env.VPS_PATH || '/opt/repdraft').trim();
const keyPath = (process.env.VPS_SSH_KEY || '').trim();
const remote = `${user}@${host}`;
const root = resolve(import.meta.dirname, '..');

function fail(msg) {
	console.error(msg);
	process.exit(1);
}

function run(cmd, args, opts = {}) {
	const res = spawnSync(cmd, args, { stdio: 'inherit', cwd: root, ...opts });
	if (res.status !== 0) fail(`${cmd} ${args.join(' ')} failed (${res.status})`);
}

if (!existsSync(resolve(root, 'build/index.js'))) {
	fail('Missing build/. Run: PUBLIC_SITE_URL=https://www.repdraft.ru npm run build');
}

const sshBase = ['-o', 'IdentitiesOnly=yes', '-o', 'BatchMode=yes'];
if (keyPath) sshBase.push('-i', keyPath, '-o', 'PreferredAuthentications=publickey');

const sshArgs = [...sshBase, remote];
const rsyncSsh = ['ssh', ...sshBase].join(' ');

run('ssh', [...sshArgs, `mkdir -p '${remotePath}/build' '${remotePath}/deploy'`]);
run('rsync', ['-az', '--delete', '-e', rsyncSsh, 'build/', `${remote}:${remotePath}/build/`]);
run('rsync', [
	'-az',
	'-e',
	rsyncSsh,
	'Dockerfile',
	'docker-compose.yml',
	'package.json',
	'package-lock.json',
	`${remote}:${remotePath}/`
]);
run('rsync', ['-az', '-e', rsyncSsh, 'deploy/Caddyfile', `${remote}:${remotePath}/deploy/Caddyfile`]);
run('ssh', [
	...sshArgs,
	`set -e; test -f '${remotePath}/.env'; cd '${remotePath}'; docker compose up -d --build; docker compose ps`
]);
console.log('Deployed. Smoke: curl -I https://www.repdraft.ru/');
