/**
 * Hero render overlay geometry, shared by web and RN.
 * Coordinates are pixels of the source render; the exported PNG is the `HERO_VIEWBOX` crop.
 */
import type { QuestHeroSex } from '../domain/questHeroProfile';
import type { FigureZone } from '../domain/sessionPayoff';

export const HERO_VIEWBOX = { x: 117, y: 20, width: 630, height: 1080 } as const;

export type HeroZoneShape = { cx: number; cy: number; rx: number; ry: number; rotate: number };

type ZoneMap = Record<FigureZone, readonly HeroZoneShape[]>;

const shape = (cx: number, cy: number, rx: number, ry: number, rotate = 0): HeroZoneShape => ({
	cx,
	cy,
	rx,
	ry,
	rotate
});

const MALE: ZoneMap = {
	shoulders: [shape(312, 276, 36, 42), shape(554, 276, 36, 42)],
	chest: [shape(432, 298, 100, 45)],
	core: [shape(432, 394, 62, 75)],
	back: [shape(346, 371, 16, 50), shape(519, 371, 16, 50)],
	arms: [
		shape(276, 360, 30, 65, 25),
		shape(588, 360, 30, 65, -25),
		shape(208, 472, 24, 60, 25),
		shape(658, 472, 24, 60, -25)
	],
	legs: [shape(360, 715, 44, 70), shape(506, 715, 44, 70), shape(343, 900, 28, 65), shape(523, 900, 28, 65)]
};

const FEMALE: ZoneMap = {
	shoulders: [shape(342, 270, 32, 38), shape(525, 270, 32, 38)],
	chest: [shape(432, 310, 80, 40)],
	core: [shape(432, 425, 58, 52)],
	back: [shape(356, 360, 14, 45), shape(510, 360, 14, 45)],
	arms: [
		shape(304, 360, 26, 62, 22),
		shape(563, 360, 26, 62, -22),
		shape(242, 472, 22, 58, 22),
		shape(625, 472, 22, 58, -22)
	],
	legs: [shape(366, 700, 44, 80), shape(500, 700, 44, 80), shape(343, 900, 28, 65), shape(529, 900, 28, 65)]
};

export function heroZoneShapes(sex: QuestHeroSex | null, zones: readonly FigureZone[]): HeroZoneShape[] {
	const map = sex === 'f' ? FEMALE : MALE;
	return zones.flatMap((zone) => map[zone]);
}
