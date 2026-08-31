/** Drop focus after coachmark dismiss so the page does not jump. */
export function blurActiveElement(): void {
	if (typeof document === 'undefined') return;
	const el = document.activeElement;
	if (el instanceof HTMLElement) el.blur();
}
