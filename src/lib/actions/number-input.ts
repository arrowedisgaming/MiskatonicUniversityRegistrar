export function preventNumberWheel(node: HTMLInputElement) {
	function handleWheel(event: WheelEvent) {
		if (document.activeElement !== node) return;
		event.preventDefault();
	}

	node.addEventListener('wheel', handleWheel, { passive: false });

	return {
		destroy() {
			node.removeEventListener('wheel', handleWheel);
		}
	};
}
