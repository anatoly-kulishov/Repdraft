import bodyMd from '$lib/content/user-scenarios.md?raw';
import type { PageLoad } from './$types';

export const load: PageLoad = () => {
	return { bodyMd };
};
