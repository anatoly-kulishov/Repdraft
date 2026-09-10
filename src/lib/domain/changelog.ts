/**
 * In-app “What’s new” for Profile version tap.
 * Update on each release: newest first. Keep 4–6 entries; short athlete-facing bullets.
 * Plain language only: no sticky / toast / PWA / lightbox jargon.
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
		version: '0.17.3',
		highlights: {
			ru: [
				'Офлайн: Home не зависает на скелете и не стирает локальные данные',
				'Галочка согласия снова обычного размера',
				'В Рекордах: свайп вправо в сохранённые, влево удалить',
				'Сброс и сценарии только в режиме тестирования'
			],
			en: [
				'Offline: Home leaves the skeleton and keeps local plans instead of wiping them',
				'Terms checkbox is back to a normal size',
				'Records: swipe right to save, swipe left to delete',
				'Wipe and scenarios stay behind tester mode'
			]
		}
	},
	{
		version: '0.17.2',
		highlights: {
			ru: [
				'Тренировка «Следующая» всегда сверху списка',
				'После финиша следующая = карточка под ней; пройденная уходит в конец очереди',
				'При перестановке список сам крутится у края экрана',
				'Шапка каталога без жёсткой линии: поиск и заголовок читаются одним блоком',
				'Фокус полей: сплошная accent-рамка, без рваных углов на iOS'
			],
			en: [
				'The Next workout stays at the top of the list',
				'After finish, Next is the card under it; the finished plan moves to the end of the queue',
				'While reordering, the list auto-scrolls near the screen edge',
				'Catalog header loses the hard rule: title and search read as one chrome block',
				'Field focus: solid accent border, no broken iOS corner outlines'
			]
		}
	},
	{
		version: '0.17.1',
		highlights: {
			ru: [
				'В технике упражнения сначала кадр, потом GIF. Офлайн без пустого квадрата',
				'Если превью нет, понятная заглушка вместо белой дыры',
				'Тип подхода в истории: компактный бейдж под весом×повторами'
			],
			en: [
				'Technique sheet shows a still first, then the GIF. No blank square offline',
				'Clear placeholder when preview media is missing',
				'Set kind in history: small badge under weight×reps'
			]
		}
	},
	{
		version: '0.17.0',
		highlights: {
			ru: [
				'Каркас нативного приложения (iOS / Android) поверх того же интерфейса',
				'Вход по ссылке из письма открывает приложение',
				'Условия использования, согласие при регистрации и опт-ин веб-аналитики'
			],
			en: [
				'Native app shell (iOS / Android) on the same workout UI',
				'Email sign-in links can open the app',
				'Terms of use, signup consent, and opt-in web analytics'
			]
		}
	},
	{
		version: '0.16.9',
		highlights: {
			ru: [
				'Заголовок экрана и шапка конструктора ближе к верхнему краю',
				'Конструктор: «Добавить» и «Сохранить» у нижнего края экрана',
				'Форма «Новый клип»: заголовок ближе к верху карточки'
			],
			en: [
				'Screen and builder headers sit closer to the top edge',
				'Builder: Add and Save stay pinned to the bottom of the screen',
				'New clip form: title sits closer to the top of the card'
			]
		}
	},
	{
		version: '0.16.8',
		highlights: {
			ru: [
				'Live: «Сбросить» и «Далее» у нижнего края; при клавиатуре кнопки скрываются',
				'На iPhone заставка при запуске тёмная, без белого кадра',
				'Тост не залезает на нижнее окно',
				'Фильтры и списки в окнах: галочка, длиннее список, без полосы прокрутки'
			],
			en: [
				'Live: Discard/Next stay at the bottom; hide while typing',
				'iPhone launch splash is dark, no blank white frame',
				'Toasts stay under bottom sheets',
				'Filters and sheet lists: checkmark, taller list, no scrollbar'
			]
		}
	},
	{
		version: '0.16.7',
		highlights: {
			ru: [
				'Тёмная тема по умолчанию',
				'Чётче шрифт и фокус с клавиатуры',
				'Спокойнее блик в логотипе',
				'В конструкторе поле под клавиатурой уезжает в центр экрана'
			],
			en: [
				'Dark theme by default',
				'Clearer type and keyboard focus',
				'Calmer logo highlight',
				'Builder: focused field scrolls to the middle of the screen'
			]
		}
	},
	{
		version: '0.16.6',
		highlights: {
			ru: [
				'Новый значок приложения: RP с пульсом',
				'В логотипе мягкий блик по линии пульса',
				'Обновлены иконки на экране телефона и при запуске'
			],
			en: [
				'New app icon: RP with a pulse',
				'A soft highlight moves along the pulse in the logo',
				'Updated icons for your phone home screen and app launch'
			]
		}
	},
	{
		version: '0.16.5',
		highlights: {
			ru: [
				'Нижние окна больше не двигают страницу за собой',
				'На тренировке тип подхода удобнее выбрать, удаление отдельно',
				'В каталоге фильтр снаряда справа, поиск всегда под шапкой',
				'Кнопка «Отменить» внизу, плюс и черновик поднимаются выше'
			],
			en: [
				'Bottom panels no longer scroll the page behind them',
				'In a workout, set type is easier to pick, delete is separate',
				'Catalog: equipment filter on the right, search stays under the header',
				'Undo sits at the bottom, + and draft buttons move up'
			]
		}
	},
	{
		version: '0.16.4',
		highlights: {
			ru: [
				'В профиле тап по версии открывает список изменений',
				'На тренировке «На все» для повторов работает как для веса',
				'Список тренировок подгружается при прокрутке',
				'В конструкторе снова видны подписи у подходов, повторов и отдыха',
				'Одинаковый поиск и фильтры в истории, планах и каталоге'
			],
			en: [
				'Tap the version in Profile to see recent changes',
				'In a workout, Apply to all for reps works like weight',
				'Workout list loads more as you scroll',
				'Builder: labels for sets, reps, and rest are visible again',
				'Same search and filters on history, plans, and catalog'
			]
		}
	},
	{
		version: '0.16.3',
		highlights: {
			ru: [
				'В истории фильтры и сколько найдено совпадений',
				'Свайп удаления стал стабильнее',
				'На карточке упражнения свайп вкладок удобнее с полей рекорда'
			],
			en: [
				'History: filters and how many matches you found',
				'Swipe to delete feels more reliable',
				'On an exercise card, swiping tabs works better from Record fields'
			]
		}
	},
	{
		version: '0.16.2',
		highlights: {
			ru: [
				'Лесенки повторов в конструкторе и на тренировке',
				'Тип подхода «до отказа»',
				'Мелкие правки пустых экранов'
			],
			en: [
				'Rep ladders in the builder and during a workout',
				'Failure set type',
				'Small fixes on empty screens'
			]
		}
	},
	{
		version: '0.16.1',
		highlights: {
			ru: [
				'На тренировке быстрый Last, заметки для кардио, меню действий',
				'В каталоге удобная сетка снарядов'
			],
			en: [
				'In a workout: quick Last, cardio notes, action menus',
				'Catalog: clearer equipment grid'
			]
		}
	},
	{
		version: '0.16.0',
		highlights: {
			ru: [
				'История упражнения во время тренировки в отдельном окне',
				'Фильтры истории: поиск, сегодня, период'
			],
			en: [
				'Exercise history during a workout in a side panel',
				'History filters: search, today, date range'
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
