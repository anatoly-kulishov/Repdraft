import type { PageLoad } from './$types';

export const load: PageLoad = ({ data }) => ({
	...data,
	bootPeek: data.bootPeek ?? { accountBoot: false }
});
