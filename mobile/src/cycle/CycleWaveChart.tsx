import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import type { CycleWeekSummary } from '@repdraft/domain/cycle';
import { useAppColors } from '../state/theme';
import { space } from '../theme';

type Props = {
	weeks: readonly CycleWeekSummary[];
	label: string;
	compact?: boolean;
};

const W = 320;
const PAD_X = 10;
const PAD_TOP = 8;
const TICKS_H = 18;
const MIN_PCT = 72;
const MAX_PCT = 124;

type Pt = { x: number; y: number };

function smoothPath(points: Pt[]): string {
	if (points.length === 0) return '';
	const first = points[0]!;
	if (points.length === 1) return `M ${first.x} ${first.y}`;
	const parts = [`M ${first.x} ${first.y}`];
	for (let i = 0; i < points.length - 1; i += 1) {
		const p0 = points[i - 1] ?? points[i]!;
		const p1 = points[i]!;
		const p2 = points[i + 1]!;
		const p3 = points[i + 2] ?? p2;
		const c1x = p1.x + (p2.x - p0.x) / 6;
		const c1y = p1.y + (p2.y - p0.y) / 6;
		const c2x = p2.x - (p3.x - p1.x) / 6;
		const c2y = p2.y - (p3.y - p1.y) / 6;
		parts.push(
			`C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2.x} ${p2.y}`
		);
	}
	return parts.join(' ');
}

/** Volume vs intensity waves: the classic periodization chart, drawn from the cycle. */
export function CycleWaveChart({ weeks, label, compact = false }: Props) {
	const colors = useAppColors();
	const height = compact ? 64 : 140;
	const plotH = height - PAD_TOP - (compact ? 0 : TICKS_H);
	const step = weeks.length > 0 ? (W - PAD_X * 2) / weeks.length : W;

	const y = (pct: number) =>
		Math.round((PAD_TOP + (1 - (pct - MIN_PCT) / (MAX_PCT - MIN_PCT)) * plotH) * 100) / 100;
	const x = (index: number) => Math.round((PAD_X + (index + 0.5) * step) * 100) / 100;

	const { volumePath, intensityPath, volumePts, intensityPts, currentIndex, baselineY } =
		useMemo(() => {
			const vPts = weeks.map((week, index) => ({ x: x(index), y: y(week.volumePct) }));
			const iPts = weeks.map((week, index) => ({ x: x(index), y: y(week.intensityPct) }));
			return {
				volumePath: smoothPath(vPts),
				intensityPath: smoothPath(iPts),
				volumePts: vPts,
				intensityPts: iPts,
				currentIndex: weeks.findIndex((week) => week.isCurrent),
				baselineY: y(100)
			};
		}, [weeks, plotH, step]);

	return (
		<View
			style={styles.wrap}
			accessibilityRole="image"
			accessibilityLabel={label}
			importantForAccessibility="no-hide-descendants"
		>
			<Svg width="100%" height={height} viewBox={`0 0 ${W} ${height}`}>
				<Line
					x1={PAD_X}
					x2={W - PAD_X}
					y1={baselineY}
					y2={baselineY}
					stroke={colors.border}
					strokeWidth={1}
					strokeDasharray="3 4"
				/>
				{!compact && currentIndex >= 0 ? (
					<Rect
						x={PAD_X + currentIndex * step}
						y={PAD_TOP}
						width={step}
						height={plotH}
						rx={6}
						fill={colors.accent}
						fillOpacity={0.1}
					/>
				) : null}
				<Path
					d={volumePath}
					stroke={colors.chartVolume}
					strokeWidth={2}
					fill="none"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
				<Path
					d={intensityPath}
					stroke={colors.accent}
					strokeWidth={2}
					fill="none"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
				{!compact
					? volumePts.map((pt, index) => (
							<Circle
								key={`v-${weeks[index]?.week ?? index}`}
								cx={pt.x}
								cy={pt.y}
								r={2.2}
								fill={colors.chartVolume}
							/>
						))
					: null}
				{!compact
					? intensityPts.map((pt, index) => (
							<Circle
								key={`i-${weeks[index]?.week ?? index}`}
								cx={pt.x}
								cy={pt.y}
								r={2.2}
								fill={colors.accent}
							/>
						))
					: null}
				{!compact
					? weeks.map((week, index) => (
							<SvgText
								key={`t-${week.week}`}
								x={x(index)}
								y={height - 3}
								fontSize={9}
								fontWeight={week.isCurrent ? '700' : '500'}
								fill={week.isCurrent ? colors.text : colors.muted}
								textAnchor="middle"
							>
								{week.week}
							</SvgText>
						))
					: null}
			</Svg>
		</View>
	);
}

const styles = StyleSheet.create({
	wrap: { width: '100%', marginTop: space.xs }
});
