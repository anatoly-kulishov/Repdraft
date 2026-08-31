import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	const path = join(process.cwd(), 'static/content/user-scenarios.md');
	const bodyMd = await readFile(path, 'utf-8');
	return { bodyMd };
};
