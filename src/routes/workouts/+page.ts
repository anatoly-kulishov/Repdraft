import type { PageLoad } from './$types';

const emptyBootPeek = { planRows: -1, historyRows: -1, hasHistory: false };

/** Native SPA: -1 means «unknown» so client peeks / store drive skeleton choice. */
export const load: PageLoad = ({ data }) => ({
	...data,
	bootPeek: data.bootPeek ?? emptyBootPeek
});
