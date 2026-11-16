import { useCallback, useEffect, useState } from 'react';
import { needsIntakeStepper } from '@repdraft/domain/athleteProfile';
import { getSupabase } from '../auth/supabase';
import { getAthleteProfile } from '../state/prefs';
import { IntakeStepper } from './IntakeStepper';

/** Shows first-run intake once after boot when signed in and profile is incomplete. */
export function IntakeGate() {
	const [open, setOpen] = useState(false);

	const refresh = useCallback(async () => {
		const sb = getSupabase();
		const [profile, { data }] = await Promise.all([
			getAthleteProfile(),
			sb ? sb.auth.getSession() : Promise.resolve({ data: { session: null } })
		]);
		setOpen(Boolean(data.session?.user) && needsIntakeStepper(profile));
	}, []);

	useEffect(() => {
		void refresh();
		const sb = getSupabase();
		if (!sb) return;
		const { data: sub } = sb.auth.onAuthStateChange(() => {
			void refresh();
		});
		return () => sub.subscription.unsubscribe();
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
