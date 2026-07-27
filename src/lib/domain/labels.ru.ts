export const BODY_PART_LABELS: Record<string, string> = {
	back: 'Спина',
	cardio: 'Кардио',
	chest: 'Грудь',
	'lower arms': 'Предплечья',
	'lower legs': 'Голени',
	neck: 'Шея',
	shoulders: 'Плечи',
	'upper arms': 'Руки (верх)',
	'upper legs': 'Ноги (верх)',
	waist: 'Кор'
};

export const TARGET_LABELS: Record<string, string> = {
	abductors: 'Абдукторы',
	abs: 'Пресс',
	adductors: 'Аддукторы',
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
	'upper back': 'Верх спины'
};

export const EQUIPMENT_LABELS: Record<string, string> = {
	assisted: 'С поддержкой',
	band: 'Резинка',
	barbell: 'Штанга',
	'body weight': 'Свой вес',
	'bosu ball': 'BOSU',
	cable: 'Блок',
	dumbbell: 'Гантели',
	'elliptical machine': 'Эллипс',
	'ez barbell': 'EZ-гриф',
	hammer: 'Hammer',
	kettlebell: 'Гиря',
	'leverage machine': 'Рычажный тренажёр',
	'medicine ball': 'Медбол',
	'olympic barbell': 'Олимпийская штанга',
	'resistance band': 'Эспандер',
	roller: 'Роллер',
	rope: 'Канат',
	'skierg machine': 'SkiErg',
	'sled machine': 'Сани',
	'smith machine': 'Машина Смита',
	'stability ball': 'Фитбол',
	'stationary bike': 'Велотренажёр',
	'stepmill machine': 'Степмилл',
	tire: 'Покрышка',
	'trap bar': 'Трэп-гриф',
	'upper body ergometer': 'Арм-эргометр',
	weighted: 'С отягощением',
	'wheel roller': 'Колесо'
};

export function labelBodyPart(value: string): string {
	return BODY_PART_LABELS[value] ?? value;
}

export function labelTarget(value: string): string {
	return TARGET_LABELS[value] ?? value;
}

export function labelEquipment(value: string): string {
	return EQUIPMENT_LABELS[value] ?? value;
}
