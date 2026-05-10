import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(
	readFileSync(new URL('../../package.json', import.meta.url), 'utf-8')
) as { version: string };

test('landing page loads with title', async ({ page }) => {
	await page.goto('/');
	await expect(page).toHaveTitle(/Miskatonic University Registrar/);
	await expect(page.locator('h1')).toContainText('Miskatonic University Registrar');
});

test('licensing page carries Chaosium disclaimer linked from every page', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('footer').getByRole('link', { name: /Licensing/ })).toBeVisible();

	await page.goto('/licensing');
	const main = page.locator('main');
	await expect(main).toContainText('unofficial Fan Content');
	await expect(main).toContainText('Chaosium');
});

test('landing page footer links to GitHub and shows app version', async ({ page }) => {
	await page.goto('/');
	const footer = page.locator('footer');

	await expect(footer).toContainText(`v${pkg.version}`);
	await expect(footer.getByRole('link', { name: 'GitHub' })).toHaveAttribute(
		'href',
		'https://github.com/arrowedisgaming/MiskatonicUniversityRegistrar'
	);
});

test('characteristics wizard page loads', async ({ page }) => {
	await page.goto('/create/coc7e/characteristics');
	await expect(page.locator('h1')).toContainText('Characteristics');
});

test('investigators dashboard redirects unauthenticated visitors to sign in', async ({ page }) => {
	await page.goto('/investigators');
	await expect(page).toHaveURL(/\/login\?callbackUrl=/);
	await expect(page.locator('h1')).toContainText('Sign In');
});

test('licensing page loads', async ({ page }) => {
	await page.goto('/licensing');
	await expect(page.locator('h1')).toContainText('Licensing');
});

test('dice settings popover saves texture choice', async ({ page, context }) => {
	await context.clearCookies();
	await page.goto('/');

	await page.getByTestId('dice-settings-trigger').click();
	await expect(page.getByRole('dialog', { name: /dice rolls/i })).toBeVisible();

	await page.getByRole('radio', { name: /Starfield/i }).click();
	await expect(page.getByRole('radio', { name: /Starfield/i })).toHaveAttribute('aria-checked', 'true');

	await page.getByRole('button', { name: 'Save' }).click();
	await expect(page.getByRole('dialog', { name: /dice rolls/i })).not.toBeVisible();

	const stored = await page.evaluate(() => localStorage.getItem('dice-appearance-v1'));
	expect(stored).toBeTruthy();
	const parsed = JSON.parse(stored!) as { texture?: string; color?: string };
	expect(parsed.texture).toBe('stars');

	await page.reload();
	await page.getByTestId('dice-settings-trigger').click();
	await expect(page.getByRole('radio', { name: /Starfield/i })).toHaveAttribute('aria-checked', 'true');
});

test('health endpoint returns ok', async ({ request }) => {
	const response = await request.get('/api/health');
	expect(response.ok()).toBeTruthy();
	const body = await response.json();
	expect(body.status).toBe('ok');
});
