/** Canonical text shape for exercise embeddings (build script + runtime). */
export function exerciseEmbedText(ex: {
	name: string;
	name_ru?: string;
	body_part: string;
	target: string;
	muscle_group: string;
	equipment: string;
}): string {
	const title = ex.name_ru || ex.name;
	return `${title} | ${ex.body_part} | ${ex.target} | ${ex.muscle_group} | ${ex.equipment}`;
}
