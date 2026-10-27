import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
	Keyboard,
	KeyboardAvoidingView,
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	View
} from 'react-native';
import { AI_BRIEF_MAX, sanitizeAiBrief } from '@repdraft/domain/inputLimits';
import { labelTarget } from '@repdraft/domain/labels.ru';
import { addExercise, createEmptyDraft, updateExercise } from '@repdraft/domain/workout';
import { loadExerciseIndex } from '../src/catalog/loadIndex';
import { aiPlanEndpoint } from '../src/catalog/mediaUrl';
import { Panel } from '../src/components/Panel';
import { PrimaryButton } from '../src/components/PrimaryButton';
import { useBottomChromePad, useStackHeaderOffset } from '../src/layout/safe';
import { useLocale } from '../src/state/locale';
import { plansRepo } from '../src/storage/plansRepo';
import { pushPlan } from '../src/sync/cloudSync';
import { useAppColors } from '../src/state/theme';
import { fontFamily, radius, space, touchMin, type, type ColorPalette } from '../src/theme';

type AiExercise = {
	exerciseId: string;
	sets: number;
	reps: number;
	restSec: number;
};

type AiPlanPayload = {
	name: string;
	exercises: AiExercise[];
};

type AiOk = {
	ok: true;
	provider: string;
	model: string;
	plan: AiPlanPayload;
	droppedUnknownIds: number;
};

type AiErr = {
	ok: false;
	code: 'unavailable' | 'invalid_brief' | 'invalid_plan' | 'upstream';
	error?: string;
};

type Example = {
	key: string;
	labelRu: string;
	labelEn: string;
	briefRu: string;
	briefEn: string;
};

const EXAMPLES: Example[] = [
	{ key: 'fullbody', labelRu: 'Всё тело', labelEn: 'Full body', briefRu: 'всё тело, 60 минут, смешанное оборудование', briefEn: 'full body, 60 minutes, mixed equipment' },
	{ key: 'upper', labelRu: 'Верх', labelEn: 'Upper body', briefRu: 'верх тела, 55 минут, штанга и гантели', briefEn: 'upper body, 55 minutes, barbell and dumbbells' },
	{ key: 'lower', labelRu: 'Низ', labelEn: 'Lower body', briefRu: 'низ тела, 55 минут, штанга и тренажёры', briefEn: 'lower body, 55 minutes, barbell and machines' },
	{ key: 'chestTri', labelRu: 'Грудь + трицепс', labelEn: 'Chest + triceps', briefRu: 'грудь и трицепс, 45 минут, штанга и гантели', briefEn: 'chest and triceps, 45 minutes, barbell and dumbbells' },
	{ key: 'backBi', labelRu: 'Спина + бицепс', labelEn: 'Back + biceps', briefRu: 'спина и бицепс, 50 минут, штанга и тяга', briefEn: 'back and biceps, 50 minutes, barbell and rows' },
	{ key: 'legs', labelRu: 'Ноги', labelEn: 'Legs', briefRu: 'ноги, 60 минут, штанга и тренажёры', briefEn: 'legs, 60 minutes, barbell and machines' },
	{ key: 'shoulders', labelRu: 'Плечи', labelEn: 'Shoulders', briefRu: 'плечи, 40 минут, гантели и кабель', briefEn: 'shoulders, 40 minutes, dumbbells and cable' }
];

function exampleLabel(ex: Example, locale: string): string {
	return locale === 'en' ? ex.labelEn : ex.labelRu;
}

function exampleBrief(ex: Example, locale: string): string {
	return locale === 'en' ? ex.briefEn : ex.briefRu;
}

export default function AiDraftScreen() {
	const { locale, tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);
	const router = useRouter();
	const bottomPad = useBottomChromePad(space.md);
	const headerOffset = useStackHeaderOffset();
	const [brief, setBrief] = useState('');
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [plan, setPlan] = useState<AiPlanPayload | null>(null);
	const [planMeta, setPlanMeta] = useState<{ provider: string; model: string; dropped: number } | null>(null);
	const [index, setIndex] = useState<Map<string, { name: string; name_ru?: string; target: string }>>(new Map());

	useEffect(() => {
		const list = loadExerciseIndex();
		const map = new Map(list.map((item) => [item.id, item] as const));
		setIndex(map);
	}, []);

	function localizeError(err: AiErr): string {
		switch (err.code) {
			case 'unavailable':
				return tt('aiDraft.unavailable');
			case 'invalid_brief':
				return tt('aiDraft.emptyBrief');
			case 'invalid_plan':
				return err.error || tt('aiDraft.generateFailed');
			case 'upstream':
			default:
				return tt('aiDraft.upstreamError');
		}
	}

	async function generate() {
		Keyboard.dismiss();
		setError(null);
		const cleaned = sanitizeAiBrief(brief);
		if (!cleaned) {
			setError(tt('aiDraft.emptyBrief'));
			return;
		}
		setBusy(true);
		try {
			const res = await fetch(aiPlanEndpoint(), {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
				body: JSON.stringify({ brief: cleaned })
			});
			const data = (await res.json()) as AiOk | AiErr;
			if (!res.ok || !data || !('ok' in data) || !data.ok) {
				const err = data as AiErr;
				setError(localizeError(err));
				return;
			}
			const ok = data as AiOk;
			setPlan(ok.plan);
			setPlanMeta({ provider: ok.provider, model: ok.model, dropped: ok.droppedUnknownIds });
		} catch {
			setError(tt('aiDraft.unavailable'));
		} finally {
			setBusy(false);
		}
	}

	async function applyPlan() {
		if (!plan) return;
		let draft = createEmptyDraft(plan.name);
		for (const ex of plan.exercises) {
			const added = addExercise(draft, ex.exerciseId);
			draft = updateExercise(added.plan, ex.exerciseId, {
				sets: ex.sets,
				reps: ex.reps,
				restSec: ex.restSec
			});
		}
		draft = { ...draft, updatedAt: new Date().toISOString() };
		await plansRepo.save(draft);
		try {
			await pushPlan(draft);
		} catch {
			/* offline */
		}
		router.replace(`/builder/${draft.id}`);
	}

	function exerciseMeta(id: string): { title: string; targetLabel: string } | null {
		const ex = index.get(id);
		if (!ex) return null;
		const title = locale === 'en' ? ex.name || ex.name_ru || id : ex.name_ru || ex.name;
		return { title: title || id, targetLabel: labelTarget(ex.target, locale) };
	}

	function estimatePlanMinutes(exercises: AiExercise[]): number {
		let sec = 0;
		for (const e of exercises) {
			const workPerSet = Math.min(60, Math.max(20, e.reps * 3));
			sec += e.sets * workPerSet + Math.max(0, e.sets - 1) * e.restSec;
		}
		return Math.max(1, Math.round(sec / 60));
	}

	return (
		<KeyboardAvoidingView
			style={styles.root}
			behavior={Platform.OS === 'ios' ? 'padding' : undefined}
			keyboardVerticalOffset={Platform.OS === 'ios' ? headerOffset : 0}
		>
			<ScrollView
				style={styles.flex}
				contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}
				keyboardShouldPersistTaps="handled"
				keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
			>
				<Text style={styles.title}>{tt('ai.title')}</Text>

				<View style={styles.chips}>
					{EXAMPLES.map((ex) => (
						<Pressable
							key={ex.key}
							style={({ pressed }) => [
								styles.chip,
								brief.trim() === exampleBrief(ex, locale) && styles.chipActive,
								pressed && styles.pressed
							]}
							onPress={() => setBrief(exampleBrief(ex, locale))}
						>
							<Text
								style={[
									styles.chipText,
									brief.trim() === exampleBrief(ex, locale) && styles.chipTextActive
								]}
							>
								{exampleLabel(ex, locale)}
							</Text>
						</Pressable>
					))}
				</View>

				<View style={styles.field}>
					<View style={styles.labelRow}>
						<Text style={styles.label}>{tt('aiDraft.briefLabel')}</Text>
						<Text style={styles.counter}>{tt('aiDraft.chars', { n: String(brief.length) })}</Text>
					</View>
					<TextInput
						style={styles.input}
						multiline
						value={brief}
						onChangeText={(v) => setBrief(v.slice(0, AI_BRIEF_MAX))}
						placeholder={tt('aiDraft.briefPlaceholder')}
						placeholderTextColor={colors.muted}
						textAlignVertical="top"
						maxLength={AI_BRIEF_MAX}
						editable={!busy}
					/>
					{error ? <Text style={styles.error}>{error}</Text> : null}
				</View>

				{busy ? (
					<View style={styles.skeleton}>
						<View style={[styles.bone, styles.boneTitle]} />
						<View style={[styles.bone, styles.boneMeta]} />
						<View style={[styles.bone, styles.boneRow]} />
						<View style={[styles.bone, styles.boneRow]} />
						<View style={[styles.bone, styles.boneRow]} />
					</View>
				) : null}

				{plan && !busy ? (
					<Panel style={styles.planPanel}>
						<Text style={styles.planTitle}>{plan.name}</Text>
						<Text style={styles.planMeta}>
							{tt('aiDraft.planSummary', {
								min: String(estimatePlanMinutes(plan.exercises)),
								n: String(plan.exercises.length)
							})}
						</Text>
						{planMeta && planMeta.dropped > 0 ? (
							<Text style={styles.planMetaSub}>
								{tt('aiDraft.dropped', { n: String(planMeta.dropped) })}
							</Text>
						) : null}
						{plan.exercises.map((ex, i) => {
							const meta = exerciseMeta(ex.exerciseId);
							return (
								<View key={`${ex.exerciseId}-${i}`} style={styles.exerciseRow}>
									<Text style={styles.exerciseNum}>{i + 1}</Text>
									<View style={styles.exerciseBody}>
										<Text style={styles.exerciseTitle} numberOfLines={2}>
											{meta?.title ?? ex.exerciseId}
										</Text>
										<View style={styles.exerciseMeta}>
											{meta?.targetLabel ? (
												<Text style={styles.badge}>{meta.targetLabel}</Text>
											) : null}
											<Text style={styles.spec}>
												{tt('aiDraft.exerciseSpec', {
													sets: String(ex.sets),
													reps: String(ex.reps),
													rest: String(ex.restSec)
												})}
											</Text>
										</View>
									</View>
								</View>
							);
						})}
						<View style={styles.planAction}>
							<PrimaryButton
								label={tt('aiDraft.addToBuilder')}
								onPress={() => void applyPlan()}
							/>
						</View>
					</Panel>
				) : null}

				{plan ? (
					<PrimaryButton
						label={tt('aiDraft.regenerate')}
						variant="ghost"
						onPress={() => void generate()}
						disabled={busy || !brief.trim()}
					/>
				) : (
					<PrimaryButton
						label={busy ? tt('aiDraft.generating') : tt('aiDraft.generate')}
						onPress={() => void generate()}
						disabled={busy || !brief.trim()}
					/>
				)}
			</ScrollView>
		</KeyboardAvoidingView>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		root: { flex: 1, backgroundColor: colors.bg },
		flex: { flex: 1 },
		scroll: { padding: space.lg, gap: space.md, flexGrow: 1 },
		title: { ...type.title, color: colors.text },
		chips: {
			flexDirection: 'row',
			flexWrap: 'wrap',
			gap: space.sm
		},
		chip: {
			minHeight: touchMin - 8,
			paddingHorizontal: space.md,
			paddingVertical: space.xs,
			borderRadius: radius.pill,
			borderWidth: 1,
			borderColor: colors.border,
			backgroundColor: colors.panel,
			justifyContent: 'center'
		},
		chipActive: {
			borderColor: colors.accent,
			backgroundColor: colors.accentDim
		},
		chipText: { color: colors.text, fontWeight: '600', fontFamily: fontFamily.semibold },
		chipTextActive: { color: colors.accentText, fontFamily: fontFamily.semibold },
		pressed: { opacity: 0.85 },
		field: { gap: space.xs },
		labelRow: {
			flexDirection: 'row',
			alignItems: 'center',
			justifyContent: 'space-between'
		},
		label: { ...type.meta, color: colors.muted },
		counter: { ...type.meta, color: colors.muted },
		input: {
			minHeight: 160,
			borderRadius: radius.xl,
			borderWidth: 1.5,
			borderColor: colors.accent,
			backgroundColor: colors.panel,
			color: colors.text,
			padding: space.lg,
			fontSize: 16,
			textAlignVertical: 'top',
			fontFamily: fontFamily.regular
		},
		error: { color: colors.danger, fontSize: 14, marginTop: space.xs, fontFamily: fontFamily.regular },
		skeleton: { gap: space.sm, marginVertical: space.sm },
		bone: {
			backgroundColor: colors.panel,
			borderRadius: radius.sm
		},
		boneTitle: { height: 22, width: '80%' },
		boneMeta: { height: 14, width: '50%', backgroundColor: colors.panelRaised },
		boneRow: { height: 56, borderRadius: radius.md },
		planPanel: { gap: space.sm },
		planTitle: { ...type.title, color: colors.text, fontSize: 20, fontFamily: fontFamily.extrabold },
		planMeta: { ...type.meta, color: colors.muted },
		planMetaSub: { color: colors.accentLink, fontSize: 13, fontWeight: '600', fontFamily: fontFamily.semibold },
		exerciseRow: {
			flexDirection: 'row',
			alignItems: 'flex-start',
			gap: space.sm,
			paddingVertical: space.sm
		},
		exerciseNum: {
			width: 24,
			color: colors.muted,
			fontWeight: '800',
			fontSize: 14,
			textAlign: 'center',
			fontFamily: fontFamily.extrabold
		},
		exerciseBody: { flex: 1, gap: 2 },
		exerciseTitle: { color: colors.text, fontWeight: '700', fontSize: 15, fontFamily: fontFamily.bold },
		exerciseMeta: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
		badge: {
			color: colors.accentText,
			backgroundColor: colors.accent,
			paddingHorizontal: space.sm,
			paddingVertical: 2,
			borderRadius: radius.pill,
			fontSize: 11,
			fontWeight: '700',
			fontFamily: fontFamily.bold
		},
		spec: { color: colors.muted, fontSize: 13, fontFamily: fontFamily.regular },
		planAction: { marginTop: space.sm }
	});
}
