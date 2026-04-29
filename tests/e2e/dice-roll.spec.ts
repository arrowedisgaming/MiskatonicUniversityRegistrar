import { expect, test } from '@playwright/test';

test('characteristic dice results reveal after the roll animation completes', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('/create/coc7e/characteristics');

	await page.getByRole('button', { name: 'Roll Dice' }).click();
	await expect(page.getByRole('button', { name: 'Rolling...' })).toBeVisible();
	await expect(page.locator('table')).toHaveCount(0);

	await expect(page.getByRole('button', { name: 'Reroll Standard Dice' })).toBeVisible();
	await expect(page.locator('table')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Roll Luck' })).toBeVisible();
});
