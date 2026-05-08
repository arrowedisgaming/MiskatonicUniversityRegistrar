/**
 * Markdown export — Obsidian-optimized with YAML frontmatter and Dataview fields.
 */

import type { CoCCharacterData } from '$lib/types/character';
import type { CoCContentPack } from '$lib/types/content-pack';
import { ALL_CHARACTERISTICS, CHARACTERISTIC_LABELS } from '$lib/types/common';
import { halfValue, fifthValue } from '$lib/engine/characteristics';

function getEraLabel(era: string, contentPack: CoCContentPack): string {
	return contentPack.eras.find((e) => e.id === era)?.name ?? era;
}

function getEraCurrencySymbol(era: string, contentPack: CoCContentPack): string {
	return contentPack.eras.find((e) => e.id === era)?.currencySymbol ?? '$';
}

export function exportToMarkdown(character: CoCCharacterData, occupationName: string, contentPack: CoCContentPack): string {
	const c = character;
	const lines: string[] = [];

	// YAML frontmatter (Dataview-compatible)
	lines.push('---');
	lines.push(`name: "${esc(c.name)}"`);
	lines.push(`system: Call of Cthulhu 7th Edition`);
	lines.push(`era: ${c.era}`);
	lines.push(`occupation: "${esc(occupationName)}"`);
	lines.push(`age: ${c.age}`);
	if (c.gender) lines.push(`gender: "${esc(c.gender)}"`);
	if (c.pronouns) lines.push(`pronouns: "${esc(c.pronouns)}"`);
	if (c.residence) lines.push(`residence: "${esc(c.residence)}"`);
	if (c.birthplace) lines.push(`birthplace: "${esc(c.birthplace)}"`);
	lines.push(`hp: ${c.derivedStats.hp.current}/${c.derivedStats.hp.max}`);
	lines.push(`mp: ${c.derivedStats.mp.current}/${c.derivedStats.mp.max}`);
	lines.push(`sanity: ${c.derivedStats.sanity.current}/${c.derivedStats.sanity.max}`);
	lines.push(`luck: ${c.derivedStats.luck.current}`);
	lines.push(`damage_bonus: "${c.derivedStats.damageBonus}"`);
	lines.push(`build: ${c.derivedStats.build}`);
	lines.push(`move_rate: ${c.derivedStats.moveRate}`);
	lines.push(`type: investigator`);
	lines.push(`tags: [coc7e, investigator, ${c.era}]`);
	lines.push('---');
	lines.push('');

	// Title
	lines.push(`# ${c.name || 'Unnamed Investigator'}`);
	lines.push('');
	lines.push(`**${occupationName}** · Age ${c.age} · ${getEraLabel(c.era, contentPack)} Era`);
	lines.push('');

	// Characteristics
	lines.push('## Characteristics');
	lines.push('');
	lines.push('| Characteristic | Value | Half | Fifth |');
	lines.push('|---|---|---|---|');
	for (const charId of ALL_CHARACTERISTICS) {
		const v = c.characteristics.values[charId];
		lines.push(`| **${CHARACTERISTIC_LABELS[charId]}** (${charId.toUpperCase()}) | ${v} | ${halfValue(v)} | ${fifthValue(v)} |`);
	}
	lines.push('');

	// Derived Stats
	lines.push('## Derived Attributes');
	lines.push('');
	lines.push(`- **Hit Points:** ${c.derivedStats.hp.current}/${c.derivedStats.hp.max}`);
	lines.push(`- **Magic Points:** ${c.derivedStats.mp.current}/${c.derivedStats.mp.max}`);
	lines.push(`- **Sanity:** ${c.derivedStats.sanity.current}/${c.derivedStats.sanity.max}`);
	lines.push(`- **Luck:** ${c.derivedStats.luck.current}`);
	lines.push(`- **Damage Bonus:** ${c.derivedStats.damageBonus}`);
	lines.push(`- **Build:** ${c.derivedStats.build}`);
	lines.push(`- **Move Rate:** ${c.derivedStats.moveRate}`);
	lines.push('');

	// Skills
	if (c.skills.length > 0) {
		const occSkills = c.skills.filter((s) => s.isOccupation).sort((a, b) => b.total - a.total);
		const otherSkills = c.skills.filter((s) => !s.isOccupation && s.allocations.length > 0).sort((a, b) => b.total - a.total);

		lines.push('## Skills');
		lines.push('');

		if (occSkills.length > 0) {
			lines.push('### Occupation Skills');
			lines.push('');
			lines.push('| Skill | Total | Half | Fifth |');
			lines.push('|---|---|---|---|');
			for (const s of occSkills) {
				const name = formatSkillName(s.skillId, s.customName);
				lines.push(`| ${name} | ${s.total}% | ${s.half} | ${s.fifth} |`);
			}
			lines.push('');
		}

		if (otherSkills.length > 0) {
			lines.push('### Personal Interest Skills');
			lines.push('');
			lines.push('| Skill | Total | Half | Fifth |');
			lines.push('|---|---|---|---|');
			for (const s of otherSkills) {
				const name = formatSkillName(s.skillId, s.customName);
				lines.push(`| ${name} | ${s.total}% | ${s.half} | ${s.fifth} |`);
			}
			lines.push('');
		}
	}

	// Backstory
	const backstoryEntries = Object.entries(c.backstory).filter(([, v]) => v.trim());
	if (backstoryEntries.length > 0) {
		lines.push('## Backstory');
		lines.push('');
		for (const [key, value] of backstoryEntries) {
			const label = key.replace(/([A-Z])/g, ' $1').trim();
			lines.push(`### ${label}`);
			lines.push('');
			lines.push(value);
			lines.push('');
		}
	}

	// Equipment
	if (c.equipment.items.length > 0 || c.equipment.weapons.length > 0 || (c.equipment.assetsList ?? []).length > 0) {
		const currencySymbol = getEraCurrencySymbol(c.era, contentPack);
		lines.push('## Equipment');
		lines.push('');
		lines.push(`**Living Standard:** ${c.equipment.livingStandard} · **Spending Level:** ${currencySymbol}${c.equipment.spendingLevel.toLocaleString()} · **Cash:** ${currencySymbol}${c.equipment.cash.toLocaleString()} · **Assets:** ${c.equipment.assetsLabel}`);
		lines.push('');

		if (c.equipment.weapons.length > 0) {
			lines.push('### Weapons');
			lines.push('');
			lines.push('| Weapon | Damage | Range | Attacks |');
			lines.push('|---|---|---|---|');
			for (const w of c.equipment.weapons) {
				lines.push(`| ${w.name} | ${w.damage} | ${w.range} | ${w.attacksPerRound} |`);
			}
			lines.push('');
		}

		if (c.equipment.items.length > 0) {
			lines.push('### Items');
			lines.push('');
			for (const item of c.equipment.items) {
				lines.push(`- ${item.name}${item.quantity > 1 ? ` (×${item.quantity})` : ''}`);
			}
			lines.push('');
		}

		if ((c.equipment.assetsList ?? []).length > 0) {
			lines.push('### Assets');
			lines.push('');
			lines.push('| Asset | Value | Type | Notes |');
			lines.push('|---|---:|---|---|');
			for (const asset of c.equipment.assetsList ?? []) {
				lines.push(`| ${asset.name} | ${currencySymbol}${asset.value.toLocaleString()} | ${asset.type} | ${asset.description ?? ''} |`);
			}
			lines.push('');
		}
	}

	// Disclaimer
	lines.push('---');
	lines.push('');
	lines.push('*Generated by Miskatonic University Registrar. This is unofficial Fan Content, not approved/endorsed by Chaosium. Call of Cthulhu is a registered trademark of Chaosium Inc.*');
	lines.push('');

	return lines.join('\n');
}

function formatSkillName(skillId: string, customName: string | null): string {
	if (customName) return customName;
	return skillId
		.replace(/-/g, ' ')
		.replace(/\b\w/g, (l) => l.toUpperCase());
}

function esc(s: string): string {
	return s.replace(/"/g, '\\"');
}
