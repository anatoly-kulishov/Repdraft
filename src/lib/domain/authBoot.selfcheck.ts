import { resolveAuthBootSession } from './authBoot.ts';

if (resolveAuthBootSession({ hasSession: true, likelyUserId: 'u1' }).kind !== 'session') {
	throw new Error('session wins over peek');
}
if (resolveAuthBootSession({ hasSession: false, likelyUserId: 'u1' }).kind !== 'local-account') {
	throw new Error('null session + peek should keep local account');
}
{
	const r = resolveAuthBootSession({ hasSession: false, likelyUserId: '  ' });
	if (r.kind !== 'guest') throw new Error('blank peek should be guest');
}
if (resolveAuthBootSession({ hasSession: false, likelyUserId: null }).kind !== 'guest') {
	throw new Error('no peek should be guest');
}

console.log('authBoot.selfcheck: ok');
