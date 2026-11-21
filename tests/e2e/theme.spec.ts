import { expect, test } from '@playwright/test';
import { gotoApp } from '../helpers/app';

test('theme toggle switches the document and survives a reload', async ({ page }) => {
	await gotoApp(page, '/tools/bmi');
	await page.getByRole('button', { name: 'Тёмная', exact: true }).first().click();
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

	const bodyColor = await page.evaluate(() => getComputedStyle(document.body).color);
	// Guard against the classic dark-mode regression: black text on a dark panel.
	expect(bodyColor).not.toBe('rgb(0, 0, 0)');

	await page.reload({ waitUntil: 'load' });
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});
