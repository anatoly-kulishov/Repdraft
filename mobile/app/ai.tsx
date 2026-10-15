import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
	Alert,
	KeyboardAvoidingView,
	Platform,
	StyleSheet,
	Text,
	TextInput,
	View
} from 'react-native';
import { sanitizeAiBrief } from '@repdraft/domain/inputLimits';
import { addExercise, createEmptyDraft, updateExercise } from '@repdraft/domain/workout';
import { aiPlanEndpoint } from '../src/catalog/mediaUrl';
import { PrimaryButton } from '../src/components/PrimaryButton';
import { useBottomChromePad } from '../src/layout/safe';
import { useLocale } from '../src/state/locale';
import { plansRepo } from '../src/storage/plansRepo';
import { pushPlan } from '../src/sync/cloudSync';
import { colors, space, type } from '../src/theme';

type AiExercise = {
	exerciseId: string;
	sets: number;
	reps: number;
	restSec: number;
};

type AiOk = {
	ok: true;
	plan: { name: string; exercises: AiExercise[] };
};

export default function AiDraftScreen() {
	const { tt } = useLocale();
	const router = useRouter();
	const bottomPad = useBottomChromePad(space.md);
	const [brief, setBrief] = useState('');
	const [busy, setBusy] = useState(false);

	async function generate() {
		const cleaned = sanitizeAiBrief(brief);
		if (!cleaned) {
			Alert.alert(tt('common.error'), tt('ai.fail'));
			return;
		}
		setBusy(true);
		try {
			const res = await fetch(aiPlanEndpoint(), {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ brief: cleaned })
			});
			const data = (await res.json()) as AiOk | { ok: false; error?: string };
			if (!res.ok || !data || !('ok' in data) || !data.ok) {
				Alert.alert(tt('common.error'), tt(res.status === 503 ? 'ai.unavailable' : 'ai.fail'));
				return;
			}
			let plan = createEmptyDraft(data.plan.name || tt('ai.title'));
			for (const ex of data.plan.exercises) {
				const added = addExercise(plan, ex.exerciseId);
				plan = updateExercise(added.plan, ex.exerciseId, {
					sets: ex.sets,
					reps: ex.reps,
					restSec: ex.restSec
				});
			}
			plan = { ...plan, updatedAt: new Date().toISOString() };
			await plansRepo.save(plan);
			try {
				await pushPlan(plan);
			} catch {
				/* offline */
			}
			router.replace(`/builder/${plan.id}`);
		} catch {
			Alert.alert(tt('common.error'), tt('ai.fail'));
		} finally {
			setBusy(false);
		}
	}

	return (
		<KeyboardAvoidingView
			style={styles.root}
			behavior={Platform.OS === 'ios' ? 'padding' : undefined}
		>
			<Text style={styles.title}>{tt('ai.title')}</Text>
			<TextInput
				style={styles.input}
				multiline
				value={brief}
				onChangeText={setBrief}
				placeholder={tt('ai.brief')}
				placeholderTextColor={colors.muted}
			/>
			<PrimaryButton
				label={busy ? '…' : tt('ai.generate')}
				onPress={() => void generate()}
				disabled={busy}
			/>
			<View style={{ height: bottomPad }} />
		</KeyboardAvoidingView>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, padding: space.lg, gap: space.md, backgroundColor: colors.bg },
	title: { ...type.title, color: colors.text },
	input: {
		flex: 1,
		minHeight: 160,
		borderRadius: 14,
		borderWidth: 1,
		borderColor: colors.border,
		backgroundColor: colors.panel,
		color: colors.text,
		padding: space.md,
		fontSize: 16,
		textAlignVertical: 'top'
	}
});