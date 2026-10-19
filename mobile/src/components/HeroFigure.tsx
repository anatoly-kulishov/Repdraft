import { useId } from 'react';
import Svg, { Defs, Ellipse, G, Image, Mask, RadialGradient, Stop } from 'react-native-svg';
import { HERO_VIEWBOX, heroZoneShapes } from '@repdraft/design/heroFigure';
import type { QuestHeroSex } from '@repdraft/domain/questHeroProfile';
import type { FigureZone } from '@repdraft/domain/sessionPayoff';
import { useAppColors } from '../state/theme';

const HERO_M = require('../../assets/hero-m.png') as number;
const HERO_F = require('../../assets/hero-f.png') as number;

type Props = {
	sex?: QuestHeroSex | null;
	zones?: readonly FigureZone[];
	width?: number;
};

/** Twin of web `HeroFigure.svelte`. */
export function HeroFigure({ sex = null, zones = [], width = 88 }: Props) {
	const colors = useAppColors();
	const uid = useId().replace(/:/g, '');
	const box = HERO_VIEWBOX;
	const src = sex === 'f' ? HERO_F : HERO_M;
	const shapes = heroZoneShapes(sex, zones);
	const height = Math.round((width * box.height) / box.width);
	const image = <Image href={src} x={box.x} y={box.y} width={box.width} height={box.height} />;

	return (
		<Svg width={width} height={height} viewBox={`${box.x} ${box.y} ${box.width} ${box.height}`}>
			<Defs>
				<RadialGradient id={`${uid}glow`}>
					<Stop offset="0" stopColor={colors.muscle} stopOpacity={0.95} />
					<Stop offset="1" stopColor={colors.muscle} stopOpacity={0.35} />
				</RadialGradient>
				<Mask id={`${uid}body`} maskUnits="userSpaceOnUse">
					{image}
				</Mask>
			</Defs>
			{image}
			{shapes.length > 0 ? (
				<G mask={`url(#${uid}body)`}>
					{shapes.map((s, i) => (
						<Ellipse
							key={i}
							cx={s.cx}
							cy={s.cy}
							rx={s.rx}
							ry={s.ry}
							rotation={s.rotate}
							originX={s.cx}
							originY={s.cy}
							fill={`url(#${uid}glow)`}
						/>
					))}
				</G>
			) : null}
		</Svg>
	);
}
