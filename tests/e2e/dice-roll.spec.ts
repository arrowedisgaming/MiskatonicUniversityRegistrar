import { expect, test } from '@playwright/test';

test('characteristic dice results reveal after the roll animation completes', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('/create/coc7e/characteristics');

	// Roll is the leftmost / default tab; "Roll All" is the panel's roll-all
	// button. `exact: true` keeps it from also matching "Reroll All" once the
	// roll completes.
	await page.getByRole('button', { name: 'Roll All', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Rolling…' })).toBeVisible();

	await expect(page.getByRole('button', { name: 'Reroll All' })).toBeVisible();
	// Luck auto-rolls after characteristics complete (reconcileAutomaticRolls
	// runs once luck.max === 0 transitions through hasValues), so the button
	// surfaces as "Reroll Luck" rather than "Roll Luck" by the time the roll
	// completes.
	await expect(page.getByRole('button', { name: 'Reroll Luck' })).toBeVisible();
});

test('dice animation toggle skips the roll delay', async ({ page }) => {
	await page.goto('/create/coc7e/characteristics');

	// Open the dice settings popover, switch to "No dice", and save.
	await page.getByTestId('dice-settings-trigger').click();
	await page.getByRole('radio', { name: 'No dice' }).click();
	await page.getByRole('button', { name: 'Save' }).click();
	await expect(page.getByRole('dialog', { name: /dice rolls/i })).not.toBeVisible();

	await page.getByRole('button', { name: 'Roll All', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Reroll All' })).toBeVisible();
});
