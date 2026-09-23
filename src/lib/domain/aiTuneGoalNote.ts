/**
 * Pure note swap for Builder AI tune goal chips.
 * Prefill / replace when the note is empty or still a goal template; keep custom edits.
 */
export function nextGoalNote(
	currentNote: string,
	nextTemplate: string,
	allTemplates: readonly string[]
): string {
	const t = currentNote.trim();
	if (!t) return nextTemplate;
	const isTemplate = allTemplates.some((x) => x.trim() === t);
	return isTemplate ? nextTemplate : currentNote;
}
