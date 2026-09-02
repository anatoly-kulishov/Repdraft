import type { PageServerLoad } from './$types';

function capRowCount(raw: string | undefined): number {
	const parsed = raw ? Number.parseInt(raw, 10) : 0;
	return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), 99) : 0;
}

/** Cookie peek set in app.html / writeDraft before Svelte mounts. */
export const load: PageServerLoad = ({ cookies }) => {
	const draftRows = capRowCount(cookies.get('repdraft_builder_draft_rows'));
	return {
		bootPeek: { draftRows }
	};
};
