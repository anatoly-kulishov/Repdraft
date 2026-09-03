import { DEMO_PLAN_ID } from './onboarding.ts';
import { isCloudPersistableId, newId } from './id.ts';

if (isCloudPersistableId(DEMO_PLAN_ID)) {
	throw new Error('demo plan id must stay local-only');
}
if (!isCloudPersistableId('550e8400-e29b-41d4-a716-446655440000')) {
	throw new Error('valid uuid should be cloud-persistable');
}
if (isCloudPersistableId('id-abc-def')) {
	throw new Error('fallback newId prefix must stay local-only');
}

const sample = newId();
if (typeof sample !== 'string' || sample.length < 8) {
	throw new Error('newId should return non-empty string');
}

console.log('id.selfcheck: ok');
