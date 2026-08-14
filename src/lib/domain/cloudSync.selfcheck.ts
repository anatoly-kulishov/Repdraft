import assert from 'node:assert/strict';
import { isCloudListUncertain } from './cloudSync.ts';

assert.equal(isCloudListUncertain('idle'), false);
assert.equal(isCloudListUncertain('loading'), false);
assert.equal(isCloudListUncertain('synced'), false);
assert.equal(isCloudListUncertain('stale'), true);
assert.equal(isCloudListUncertain('error'), true);

console.log('cloudSync self-check ok');
