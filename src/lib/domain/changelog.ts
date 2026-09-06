/**
 * In-app “What’s new” for Profile version tap.
 * Update on each release: newest first. Keep 4–6 entries; short athlete-facing bullets.
 */
import type { AppLocale } from '$lib/i18n/locale';

export type ChangelogRelease = {
	/** Semver without `v`, must match package.json / GitHub tag. */
	version: string;
	highlights: Record<AppLocale, string[]>;
};

/** Newest first. */
export const CHANGELOG: readonly ChangelogRelease[] = [
	{
		version: '0.16.4',
		highlights: {
			ru: [
				'Тестовый бэкап крупнее: больше планов, истории и рекордов для проверки списков',
				'В профиле тап по версии открывает список последних изменений',
				'Live: «На все» для повторов работает как для веса',
				'Список тренировок: подгрузка при скролле',
				'В конструкторе у полей подходы / повторы / отдых снова видны подписи',
				'Общий блок поиска и фильтров в истории, планах и каталоге'
			],
			en: [
				'Larger test backup: more plans, history, and records for list stress checks',
				'Tap the version in Profile to see recent changes',
				'Live: Apply-to-all for reps mirrors weight',
				'Workouts list: infinite scroll',
				'Builder: sets / reps / rest chips show labels again',
				'Shared search and filter bar on history, plans, and catalog'
			]
		}
	},
	{
		version: '0.16.3',
		highlights: {
			ru: [
				'Фильтры истории и счётчик совпадений; кнопка Истории у заголовка',
				'Свайп удаления и подсказок стабильнее',
				'Свайп вкладок на карточке упражнения работает с полей Рекорда'
			],
			en: [
				'History filters and match count; History button aligned to the title',
				'Swipe-to-delete and coachmark dismiss feel more reliable',
				'Exercise tab swipe works when starting on Record inputs'
			]
		}
	},
	{
		version: '0.16.2',
		highlights: {
			ru: [
				'Лесенки повторов в конструкторе и на live',
				'Тип подхода «до отказа»',
				'Правки оболочки на пустых экранах и мелкая полировка UI'
			],
			en: [
				'Rep ladders in the builder and live session',
				'Failure set kind',
				'Empty-state shell fixes and UI polish'
			]
		}
	},
	{
		version: '0.16.1',
		highlights: {
			ru: [
				'Live: быстрый Last, карто заметки, меню действий',
				'Каталог: сетка снарядов',
				'Тестовый бэкап для QA на стенде'
			],
			en: [
				'Live: Last chip, cardio notes, action menus',
				'Catalog equipment browse grid',
				'Test backup fixture for staging QA'
			]
		}
	},
	{
		version: '0.16.0',
		highlights: {
			ru: [
				'История упражнения на live в sheet',
				'Фильтры истории: поиск, сегодня, период',
				'Жёстче auth и локальный demo-план'
			],
			en: [
				'Exercise history sheet on live',
				'History filters: search, today, date range',
				'Harder auth and local-only demo plan'
			]
		}
	}
] as const;

export type LocalizedChangelogRelease = {
	version: string;
	label: string;
	highlights: string[];
};

export function localizedChangelog(
	locale: AppLocale,
	limit = 5
): LocalizedChangelogRelease[] {
	return CHANGELOG.slice(0, limit).map((entry) => ({
		version: entry.version,
		label: `v${entry.version}`,
		highlights: entry.highlights[locale] ?? entry.highlights.en
	}));
}
