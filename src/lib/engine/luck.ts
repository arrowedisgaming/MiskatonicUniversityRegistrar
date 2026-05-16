export function clampLuckCurrent(value: number): number {
	if (!Number.isFinite(value)) return 0;
	return Math.max(0, Math.min(99, Math.trunc(value)));
}
