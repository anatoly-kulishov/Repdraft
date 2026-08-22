/** Mount overlay nodes on document.body so z-index beats sidebar / list rows. */
export function overlayPortal(node: HTMLElement): { destroy: () => void } {
	document.body.appendChild(node);
	return {
		destroy() {
			node.remove();
		}
	};
}
