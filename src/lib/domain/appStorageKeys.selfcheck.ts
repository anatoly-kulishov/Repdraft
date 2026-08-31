import { isRepdraftOwnedCookieName, isRepdraftOwnedStorageKey } from './appStorageKeys.ts';

if (!isRepdraftOwnedStorageKey('repdraft:plans')) {
	throw new Error('repdraft:plans should match');
}
if (!isRepdraftOwnedStorageKey('repdraft.theme')) {
	throw new Error('repdraft.theme should match');
}
if (!isRepdraftOwnedStorageKey('sb-abc-auth-token')) {
	throw new Error('sb auth token should match');
}
if (isRepdraftOwnedStorageKey('other-app')) {
	throw new Error('foreign key should not match');
}
if (!isRepdraftOwnedCookieName('repdraft_auth_boot')) {
	throw new Error('repdraft cookie should match');
}

console.log('appStorageKeys.selfcheck: ok');
