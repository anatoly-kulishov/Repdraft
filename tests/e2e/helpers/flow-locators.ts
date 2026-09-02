import type { Page } from '@playwright/test';

/** Builder name field — chrome input on all viewports (desktop hides .builder-name-desktop). */
export function builderNameInput(page: Page) {
	return page.locator('.builder-chrome__name');
}

export function builderSaveButton(page: Page, isMobile: boolean) {
	return isMobile
		? page.locator('.sticky-actions button.btn-primary').filter({ hasText: /Сохранить|Save/ })
		: page.locator('.builder-chrome__save, .builder-toolbar-save').first();
}

export function workoutPreviewStartButton(page: Page, isMobile: boolean) {
	return isMobile
		? page.locator('.workout-preview .sticky-actions button.btn-primary')
		: page.locator('.workout-preview-start button.btn-primary');
}

/** Unified sub-route back control after ScreenHeader rollout. */
export const screenHeaderBack = '.screen-header-crumb';
