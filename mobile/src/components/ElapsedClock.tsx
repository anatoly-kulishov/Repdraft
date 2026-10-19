import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { formatElapsedClock } from '../live/sessionUi';

type Props = {
	startedAt: string;
};

/** 1s clock isolated from the live screen so the set list does not re-render with it. */
export function ElapsedClock({ startedAt }: Props) {
	const [now, setNow] = useState(() => Date.now());

	useEffect(() => {
		const t = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(t);
	}, []);

	const started = Date.parse(startedAt);
	const elapsed = formatElapsedClock((Number.isFinite(started) ? now - started : 0));
	return <Text>{elapsed}</Text>;
}
