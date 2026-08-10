export type DayGreetingPeriod = 'morning' | 'afternoon' | 'evening' | 'night';

/** Local wall-clock greeting bucket (5–12 morning, 12–18 afternoon, 18–23 evening, else night). */
export function dayGreetingPeriod(at: Date = new Date()): DayGreetingPeriod {
	const hour = at.getHours();
	if (hour >= 5 && hour < 12) return 'morning';
	if (hour >= 12 && hour < 18) return 'afternoon';
	if (hour >= 18 && hour < 23) return 'evening';
	return 'night';
}

export function homeGreetingMessageKey(
	period: DayGreetingPeriod,
	withName: boolean
): string {
	switch (period) {
		case 'morning':
			return withName ? 'home.greetingMorning' : 'home.greetingMorningGeneric';
		case 'afternoon':
			return withName ? 'home.greetingAfternoon' : 'home.greetingAfternoonGeneric';
		case 'evening':
			return withName ? 'home.greetingEvening' : 'home.greetingEveningGeneric';
		default:
			return withName ? 'home.greetingNight' : 'home.greetingNightGeneric';
	}
}
