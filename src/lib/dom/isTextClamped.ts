/** True when CSS clamp/ellipsis is hiding overflow. */
export function isTextClamped(el: HTMLElement): boolean {
	return el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1;
}
