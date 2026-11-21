import { error } from '@sveltejs/kit';
import { PRERENDER_PUBLIC } from '$lib/seo/prerenderPublic';
import { PROGRAMS, findProgram } from '$lib/domain/programs';

export const prerender = PRERENDER_PUBLIC;

export function entries() {
	return PROGRAMS.map((program) => ({ slug: program.slug }));
}

/** Same 404 contract as the Russian page: no soft-404 mirrors. */
export function load({ params }: { params: { slug: string } }) {
	if (!findProgram(params.slug)) error(404, 'Program not found');
	return {};
}
