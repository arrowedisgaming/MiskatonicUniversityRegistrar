<script lang="ts">
	import { generatePDF } from '$lib/export/pdf-export';
	import type { CoCCharacterData } from '$lib/types/character';
	import type { CoCContentPack, CoCSkillDefinition, CoCOccupationDefinition } from '$lib/types/content-pack';

	type Props = {
		character: CoCCharacterData;
		occupationName: string;
		skills: CoCSkillDefinition[];
		occupations: CoCOccupationDefinition[];
		contentPack: CoCContentPack;
	};

	let { character, occupationName, skills, occupations, contentPack }: Props = $props();

	let pdfError = $state<string | null>(null);
	let pdfExporting = $state(false);

	async function exportPDF() {
		pdfError = null;
		pdfExporting = true;
		try {
			const pdfBytes = await generatePDF(character, occupationName, skills, occupations, contentPack);
			const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `${(character.name || 'investigator').replace(/\s+/g, '-')}.pdf`;
			a.click();
			URL.revokeObjectURL(url);
			// Best-effort analytics ping. Never block the export on this.
			fetch('/api/events/pdf', { method: 'POST' }).catch(() => {});
		} catch (e) {
			pdfError = e instanceof Error ? e.message : 'PDF generation failed';
			console.error('PDF export error:', e);
		} finally {
			pdfExporting = false;
		}
	}
</script>

<button
	type="button"
	onclick={exportPDF}
	disabled={pdfExporting}
	class="cursor-pointer rounded-md border border-[var(--color-border)] px-2 py-1.5 text-xs hover:bg-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50"
>
	{pdfExporting ? 'Exporting...' : 'PDF'}
</button>

{#if pdfError}
	<div
		class="mt-2 w-full rounded-md border border-[var(--color-destructive)] bg-[var(--color-destructive)]/10 p-3 text-sm text-[var(--color-destructive)]"
		role="alert"
	>
		PDF export failed: {pdfError}
	</div>
{/if}
