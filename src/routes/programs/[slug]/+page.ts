import { error } from '@sveltejs/kit';
import { PRERENDER_PUBLIC } from '$lib/seo/prerenderPublic';
import { PROGRAMS, findProgram } from '$lib/domain/programs';

export const prerender = PRERENDER_PUBLIC;

/** One static page per program; the block is content, not user data. */
export function entries() {
	return PROGRAMS.map((program) => ({ slug: program.slug }));
}

/**
 * `entries()` only covers prerender builds: in dev (and if prerender is ever
 * turned off) an unknown slug would render a 200 soft-404 with the hub
 * canonical. Reject it here so the status is right in every mode.
 */
export function load({ params }: { params: { slug: string } }) {
	if (!findProgram(params.slug)) error(404, 'Program not found');
	return {};
}
