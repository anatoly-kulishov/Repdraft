import type { AppLocale } from '$lib/i18n/locale';
import { titleCaseEn } from '$lib/i18n/messages';

export const BODY_PART_LABELS: Record<string, string> = {
	back: 'Спина',
	cardio: 'Кардио',
	chest: 'Грудь',
	'lower arms': 'Предплечья',
	'lower legs': 'Голени',
	neck: 'Шея',
	shoulders: 'Плечи',
	'upper arms': 'Руки',
	'upper legs': 'Ноги',
	waist: 'Кор'
};

/**
 * Muscle / secondary-muscle catalog keys → RU gym copy.
 * Covers both `target` and free-form `secondary_muscles` from the dataset.
 */
export const TARGET_LABELS: Record<string, string> = {
	// target (canonical)
	abductors: 'Отводящие',
	abs: 'Пресс',
	adductors: 'Приводящие',
	biceps: 'Бицепс',
	calves: 'Икры',
	'cardiovascular system': 'Сердечно-сосудистая система',
	delts: 'Дельты',
	forearms: 'Предплечья',
	glutes: 'Ягодицы',
	hamstrings: 'Бицепс бедра',
	lats: 'Широчайшие',
	'levator scapulae': 'Леватор лопатки',
	pectorals: 'Грудные',
	quads: 'Квадрицепс',
	'serratus anterior': 'Передняя зубчатая',
	spine: 'Позвоночник',
	traps: 'Трапеции',
	triceps: 'Трицепс',
	'upper back': 'Верх спины',

	// secondary_muscles aliases / extras
	abdominals: 'Пресс',
	'ankle stabilizers': 'Стабилизаторы голеностопа',
	ankles: 'Голеностоп',
	back: 'Спина',
	brachialis: 'Брахиалис',
	chest: 'Грудь',
	core: 'Кор',
	deltoids: 'Дельты',
	feet: 'Стопы',
	'grip muscles': 'Мышцы хвата',
	groin: 'Пах',
	hands: 'Кисти',
	'hip flexors': 'Сгибатели бедра',
	'inner thighs': 'Внутренняя поверхность бедра',
	'latissimus dorsi': 'Широчайшие',
	'lower abs': 'Нижний пресс',
	'lower back': 'Поясница',
	obliques: 'Косые мышцы живота',
	quadriceps: 'Квадрицепс',
	'rear deltoids': 'Задние дельты',
	rhomboids: 'Ромбовидные',
	'rotator cuff': 'Вращательная манжета',
	shins: 'Голени',
	shoulders: 'Плечи',
	soleus: 'Камбаловидная',
	sternocleidomastoid: 'Грудино-ключично-сосцевидная',
	trapezius: 'Трапеции',
	'upper chest': 'Верх груди',
	'wrist extensors': 'Разгибатели запястья',
	'wrist flexors': 'Сгибатели запястья',
	wrists: 'Запястья'
};

export const EQUIPMENT_LABELS: Record<string, string> = {
	assisted: 'С поддержкой',
	band: 'Резинка',
	barbell: 'Штанга',
	'body weight': 'Свой вес',
	'bosu ball': 'Босу',
	cable: 'Блок',
	dumbbell: 'Гантели',
	'elliptical machine': 'Эллипсоид',
	'ez barbell': 'EZ-гриф',
	hammer: 'Молот',
	kettlebell: 'Гиря',
	'leverage machine': 'Рычажный тренажёр',
	'medicine ball': 'Медбол',
	'olympic barbell': 'Олимпийская штанга',
	'resistance band': 'Эспандер',
	roller: 'Роллер',
	rope: 'Канат',
	'skierg machine': 'Лыжный эргометр',
	'sled machine': 'Сани',
	'smith machine': 'Машина Смита',
	'stability ball': 'Фитбол',
	'stationary bike': 'Велотренажёр',
	'stepmill machine': 'Степпер',
	tire: 'Покрышка',
	'trap bar': 'Трэп-гриф',
	'upper body ergometer': 'Арм-эргометр',
	weighted: 'С отягощением',
	'wheel roller': 'Гимнастическое колесо'
};

function normalizeKey(value: string): string {
	return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function labelBodyPart(value: string, locale: AppLocale = 'ru'): string {
	const key = normalizeKey(value);
	if (locale === 'en') return titleCaseEn(key);
	return BODY_PART_LABELS[key] ?? value;
}

export function labelTarget(value: string, locale: AppLocale = 'ru'): string {
	const key = normalizeKey(value);
	if (locale === 'en') return titleCaseEn(key);
	return TARGET_LABELS[key] ?? value;
}

export function labelEquipment(value: string, locale: AppLocale = 'ru'): string {
	const key = normalizeKey(value);
	if (locale === 'en') return titleCaseEn(key);
	return EQUIPMENT_LABELS[key] ?? value;
}
