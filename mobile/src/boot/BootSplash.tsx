import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import {
	AccessibilityInfo,
	Animated,
	Easing,
	Image,
	StyleSheet,
	View
} from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

const SIZE = 120;
const RADIUS = 28;
const HOLD_MS = 720;
const FADE_MS = 440;
const BEAM_MS = 1700;

const mark = require('../../assets/brand-mark-pulse.png');

type Props = {
	onDone: () => void;
};

/** Same hold, fade, and pulse beam as the web `#pwa-boot` splash. */
export function BootSplash({ onDone }: Props) {
	const bg = '#8b5cf6';
	const enter = useRef(new Animated.Value(0)).current;
	const leave = useRef(new Animated.Value(1)).current;
	const beamX = useRef(new Animated.Value(0)).current;
	const beamOpacity = useRef(new Animated.Value(0)).current;
	const finished = useRef(false);
	const reduceMotion = useRef(false);

	useEffect(() => {
		let cancelled = false;
		let beam: Animated.CompositeAnimation | null = null;
		const finish = () => {
			if (finished.current || cancelled) return;
			finished.current = true;
			onDone();
		};

		void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
			if (cancelled) return;
			reduceMotion.current = enabled;
			if (!enabled) {
				beam = Animated.loop(
					Animated.parallel([
						Animated.sequence([
							Animated.timing(beamX, {
								toValue: 1,
								duration: BEAM_MS * 0.5,
								easing: Easing.bezier(0.4, 0, 0.2, 1),
								useNativeDriver: true
							}),
							Animated.timing(beamX, {
								toValue: 1.12,
								duration: BEAM_MS * 0.5,
								easing: Easing.bezier(0.4, 0, 1, 1),
								useNativeDriver: true
							}),
							Animated.timing(beamX, { toValue: 0, duration: 0, useNativeDriver: true })
						]),
						Animated.sequence([
							Animated.timing(beamOpacity, {
								toValue: 0.55,
								duration: BEAM_MS * 0.1,
								useNativeDriver: true
							}),
							Animated.timing(beamOpacity, {
								toValue: 0.4,
								duration: BEAM_MS * 0.38,
								useNativeDriver: true
							}),
							Animated.timing(beamOpacity, {
								toValue: 0,
								duration: BEAM_MS * 0.1,
								useNativeDriver: true
							}),
							Animated.delay(BEAM_MS * 0.42)
						])
					])
				);
				beam.start();
			}
		});

		Animated.timing(enter, {
			toValue: 1,
			duration: 440,
			easing: Easing.bezier(0.22, 1, 0.36, 1),
			useNativeDriver: true
		}).start();

		const hold = setTimeout(() => {
			Animated.timing(leave, {
				toValue: 0,
				duration: reduceMotion.current ? 120 : FADE_MS,
				easing: Easing.bezier(0.22, 1, 0.36, 1),
				useNativeDriver: true
			}).start(({ finished: ok }) => {
				if (ok) finish();
			});
		}, HOLD_MS);

		return () => {
			cancelled = true;
			clearTimeout(hold);
			beam?.stop();
		};
	}, [beamOpacity, beamX, enter, leave, onDone]);

	return (
		<Animated.View
			pointerEvents="auto"
			onLayout={() => {
				void SplashScreen.hideAsync();
			}}
			style={[styles.screen, { backgroundColor: bg, opacity: leave }]}
		>
			<StatusBar style="light" />
			<Animated.View
				style={{
					opacity: enter,
					transform: [
						{
							scale: leave.interpolate({
								inputRange: [0, 1],
								outputRange: [0.94, 1]
							})
						},
						{
							scale: enter.interpolate({
								inputRange: [0, 1],
								outputRange: [0.92, 1]
							})
						}
					]
				}}
			>
				<View style={styles.icon}>
					<Svg width={SIZE} height={SIZE}>
						<Defs>
							<LinearGradient id="boot" x1="0" y1="0" x2={SIZE} y2={SIZE}>
								<Stop offset="0" stopColor="#8b5cf6" />
								<Stop offset="0.62" stopColor="#a78bfa" />
								<Stop offset="1" stopColor="#c4b5fd" />
							</LinearGradient>
						</Defs>
						<Rect width={SIZE} height={SIZE} rx={RADIUS} fill="url(#boot)" />
					</Svg>
					<Animated.View
						pointerEvents="none"
						style={[
							styles.beam,
							{
								opacity: beamOpacity,
								transform: [
									{
										translateX: beamX.interpolate({
											inputRange: [0, 1, 1.12],
											outputRange: [-8, 78, 92]
										})
									}
								]
							}
						]}
					/>
					<Image source={mark} style={styles.mark} resizeMode="contain" />
				</View>
			</Animated.View>
		</Animated.View>
	);
}

const styles = StyleSheet.create({
	screen: {
		position: 'absolute',
		top: 0,
		right: 0,
		bottom: 0,
		left: 0,
		alignItems: 'center',
		justifyContent: 'center',
		zIndex: 50
	},
	icon: {
		width: SIZE,
		height: SIZE,
		borderRadius: RADIUS,
		overflow: 'hidden'
	},
	beam: {
		position: 'absolute',
		top: (SIZE - 36) / 2,
		left: 0,
		width: 48,
		height: 36,
		borderRadius: 24,
		backgroundColor: '#ffffff'
	},
	mark: {
		position: 'absolute',
		top: 0,
		right: 0,
		bottom: 0,
		left: 0,
		width: SIZE,
		height: SIZE
	}
});
