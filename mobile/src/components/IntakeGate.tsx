import { useCallback, useEffect, useState } from 'react';
import { needsIntakeStepper } from '@repdraft/domain/athleteProfile';
import { getAthleteProfile } from '../state/prefs';
import { IntakeStepper } from './IntakeStepper';

/** Shows first-run intake once after boot when profile is incomplete. */
export function IntakeGate() {
	const [open, setOpen] = useState(false);

	const refresh = useCallback(async () => {
		const profile = await getAthleteProfile();
		setOpen(needsIntakeStepper(profile));
	}, []);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	if (!open) return null;

	return (
		<IntakeStepper
			open={open}
			onFinished={() => {
				setOpen(false);
			}}
		/>
	);
}
