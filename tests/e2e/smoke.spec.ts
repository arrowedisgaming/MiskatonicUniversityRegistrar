import { test, expect } from '@playwright/test';

test('landing page loads with title', async ({ page }) => {
	await page.goto('/');
	await expect(page).toHaveTitle(/Miskatonic University Registrar/);
	await expect(page.locator('h1')).toContainText('Miskatonic University Registrar');
});

test('landing page has Chaosium disclaimer', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('footer')).toContainText('unofficial Fan Content');
	await expect(page.locator('footer')).toContainText('Chaosium');
});

test('characteristics wizard page loads', async ({ page }) => {
	await page.goto('/create/coc7e/characteristics');
	await expect(page.locator('h2')).toContainText('Characteristics');
});

test('investigators dashboard loads', async ({ page }) => {
	await page.goto('/investigators');
	await expect(page.locator('h1')).toContainText('Your Investigators');
});

test('licensing page loads', async ({ page }) => {
	await page.goto('/licensing');
	await expect(page.locator('h1')).toContainText('Licensing');
});

test('health endpoint returns ok', async ({ request }) => {
	const response = await request.get('/api/health');
	expect(response.ok()).toBeTruthy();
	const body = await response.json();
	expect(body.status).toBe('ok');
});
