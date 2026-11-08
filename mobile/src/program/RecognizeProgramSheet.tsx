import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
	ActivityIndicator,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View
} from 'react-native';
import {
	matchRecognizedProgram,
	type RecognizedProgram
} from '@repdraft/domain/recognizeProgram';
import { addExercise, createEmptyDraft, updateExercise } from '@repdraft/domain/workout';
import { billingSubscribeUrl } from '../auth/accountApi';
import { getSupabase } from '../auth/supabase';
import { loadExerciseIndex } from '../catalog/loadIndex';
import { recognizePlanEndpoint } from '../catalog/mediaUrl';
import { BottomSheet } from '../components/BottomSheet';
import { PrimaryButton } from '../components/PrimaryButton';
import { useLocale } from '../state/locale';
import { useAppColors } from '../state/theme';
import { plansRepo } from '../storage/plansRepo';
import { pushPlan } from '../sync/cloudSync';
import { fontFamily, radius, space, touchMin, type ColorPalette } from '../theme';

type Phase = 'pick' | 'paywall' | 'review';

type Props = {
	open: boolean;
	onDismiss: () => void;
};

async function bearerToken(): Promise<string | null> {
	const sb = getSupabase();
	if (!sb) return null;
	const {
		data: { session }
	} = await sb.auth.getSession();
	return session?.access_token ?? null;
}

export function RecognizeProgramSheet({ open, onDismiss }: Props) {
	const { locale, tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);
	const router = useRouter();

	const [busy, setBusy] = useState(false);
	const [phase, setPhase] = useState<Phase>('pick');
	const [errorKey, setErrorKey] = useState<string | null>(null);
	const [program, setProgram] = useState<RecognizedProgram | null>(null);
	const [overrides, setOverrides] = useState<Record<string, string>>({});
	const [proKnown, setProKnown] = useState<boolean | null>(null);

	const catalog = useMemo(() => loadExerciseIndex(), []);
	const matched = useMemo(
		() => (program ? matchRecognizedProgram(program, catalog, overrides) : null),
		[program, catalog, overrides]
	);

	function reset() {
		setBusy(false);
		setPhase('pick');
		setErrorKey(null);
		setProgram(null);
		setOverrides({});
	}

	function dismiss() {
		reset();
		onDismiss();
	}

	async function probePro(token: string): Promise<boolean> {
		try {
			const res = await fetch(recognizePlanEndpoint(), {
				headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
			});
			if (!res.ok) return false;
			const body = (await res.json()) as { pro?: boolean };
			return Boolean(body.pro);
		} catch {
			return false;
		}
	}

	async function uploadFile(uri: string, name: string, mime: string, token: string) {
		const form = new FormData();
		form.append('file', {
			uri,
			name,
			type: mime
		} as unknown as Blob);

		const res = await fetch(recognizePlanEndpoint(), {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${token}`,
				Accept: 'application/json'
			},
			body: form
		});
		const body = (await res.json().catch(() => null)) as
			| { ok?: boolean; code?: string; program?: RecognizedProgram }
			| null;

		if (res.status === 403 || body?.code === 'needPro') {
			setProKnown(false);
			setPhase('paywall');
			return;
		}
		if (!res.ok || !body?.ok || !body.program) {
			const code = body?.code;
			setErrorKey(
				code === 'too_large'
					? 'recognize.tooLarge'
					: code === 'no_program'
						? 'recognize.noProgram'
						: code === 'needAuth'
							? 'recognize.needAuth'
							: code === 'unavailable'
								? 'recognize.unavailable'
								: code === 'invalid_file'
									? 'recognize.invalidFile'
									: 'recognize.fail'
			);
			return;
		}
		setProgram(body.program);
		setOverrides({});
		setPhase('review');
	}

	async function ensureProGate(): Promise<string | null> {
		const token = await bearerToken();
		if (!token) {
			setErrorKey('recognize.needAuth');
			return null;
		}
		const isPro = proKnown ?? (await probePro(token));
		setProKnown(isPro);
		if (!isPro) {
			setPhase('paywall');
			return null;
		}
		return token;
	}

	async function pickPhoto() {
		setErrorKey(null);
		const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
		if (!perm.granted) {
			setErrorKey('recognize.needPhotoPermission');
			return;
		}
		const picked = await ImagePicker.launchImageLibraryAsync({
			mediaTypes: ['images'],
			quality: 0.85,
			allowsEditing: false
		});
		if (picked.canceled || !picked.assets?.[0]?.uri) return;

		setBusy(true);
		try {
			const token = await ensureProGate();
			if (!token) return;
			const asset = picked.assets[0];
			const mime = asset.mimeType || 'image/jpeg';
			const name = asset.fileName || 'program.jpg';
			await uploadFile(asset.uri, name, mime, token);
		} catch {
			setErrorKey('recognize.fail');
		} finally {
			setBusy(false);
		}
	}

	async function pickDocument() {
		setErrorKey(null);
		const picked = await DocumentPicker.getDocumentAsync({
			type: [
				'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
				'application/vnd.ms-excel',
				'text/csv',
				'text/comma-separated-values',
				'text/plain'
			],
			copyToCacheDirectory: true
		});
		if (picked.canceled || !picked.assets?.[0]?.uri) return;

		setBusy(true);
		try {
			const token = await ensureProGate();
			if (!token) return;
			const asset = picked.assets[0];
			const mime = asset.mimeType || 'application/octet-stream';
			const name = asset.name || 'program.xlsx';
			await uploadFile(asset.uri, name, mime, token);
		} catch {
			setErrorKey('recognize.fail');
		} finally {
			setBusy(false);
		}
	}

	async function openSubscribe() {
		await WebBrowser.openBrowserAsync(billingSubscribeUrl());
	}

	async function applyToBuilder() {
		if (!matched || matched.exercises.length === 0) {
			setErrorKey('recognize.noMatched');
			return;
		}
		setBusy(true);
		try {
			let draft = createEmptyDraft(matched.name);
			for (const ex of matched.exercises) {
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
			dismiss();
			router.replace(`/builder/${draft.id}`);
		} catch {
			setErrorKey('recognize.fail');
		} finally {
			setBusy(false);
		}
	}

	function exerciseTitle(id: string): string {
		const ex = catalog.find((x) => x.id === id);
		if (!ex) return id;
		return locale === 'en' ? ex.name || ex.name_ru || id : ex.name_ru || ex.name;
	}

	const title =
		phase === 'paywall'
			? tt('billing.paywallTitle')
			: phase === 'review'
				? tt('recognize.reviewTitle')
				: tt('recognize.title');

	return (
		<BottomSheet
			open={open}
			onDismiss={busy ? undefined : dismiss}
			dismissible={!busy}
			label={title}
			actions={
				phase === 'paywall' ? (
					<>
						<PrimaryButton
							label={tt('common.cancel')}
							variant="ghost"
							onPress={dismiss}
							disabled={busy}
						/>
						<PrimaryButton
							label={tt('billing.openOnWeb')}
							onPress={() => void openSubscribe()}
							disabled={busy}
						/>
					</>
				) : phase === 'review' ? (
					<>
						<PrimaryButton
							label={tt('common.cancel')}
							variant="ghost"
							onPress={dismiss}
							disabled={busy}
						/>
						<PrimaryButton
							label={tt('recognize.openBuilder')}
							onPress={() => void applyToBuilder()}
							disabled={busy || !matched || matched.exercises.length === 0}
						/>
					</>
				) : (
					<>
						<PrimaryButton
							label={tt('common.cancel')}
							variant="ghost"
							onPress={dismiss}
							disabled={busy}
						/>
						<PrimaryButton
							label={tt('recognize.pickPhoto')}
							onPress={() => void pickPhoto()}
							disabled={busy}
						/>
						<PrimaryButton
							label={tt('recognize.pickFile')}
							variant="secondary"
							onPress={() => void pickDocument()}
							disabled={busy}
						/>
					</>
				)
			}
		>
			<Text style={styles.title}>{title}</Text>

			{phase === 'paywall' ? (
				<Text style={styles.hint}>{tt('billing.paywallLead')}</Text>
			) : phase === 'review' && matched && program ? (
				<ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
					<Text style={styles.hint}>
						{tt('recognize.preview', {
							n: program.rows.length,
							matched: matched.exercises.length,
							unmatched: matched.unmatched.length
						})}
					</Text>
					{matched.exercises.map((ex) => (
						<Text key={ex.exerciseId} style={styles.row}>
							<Text style={styles.rowStrong}>{exerciseTitle(ex.exerciseId)}</Text>
							{` ${ex.sets}×${ex.reps}${ex.restSec > 0 ? ` · ${ex.restSec}s` : ''}`}
						</Text>
					))}
					{matched.unmatched.length > 0 ? (
						<>
							<Text style={[styles.hint, styles.hintSpaced]}>
								{tt('recognize.reviewUnmatched', { n: matched.unmatched.length })}
							</Text>
							{matched.unmatched.map((row) => (
								<View key={row.key} style={styles.unmatchedBlock}>
									<Text style={styles.rowStrong}>{row.name}</Text>
									<Pressable
										accessibilityRole="button"
										style={styles.skipChip}
										onPress={() =>
											setOverrides((prev) => ({ ...prev, [row.key]: '' }))
										}
									>
										<Text style={styles.skipChipText}>{tt('recognize.skipRow')}</Text>
									</Pressable>
									{row.candidates.map((c) => (
										<Pressable
											key={c.id}
											accessibilityRole="button"
											style={[
												styles.candidateChip,
												overrides[row.key] === c.id && styles.candidateChipActive
											]}
											onPress={() =>
												setOverrides((prev) => ({ ...prev, [row.key]: c.id }))
											}
										>
											<Text
												style={[
													styles.candidateText,
													overrides[row.key] === c.id && styles.candidateTextActive
												]}
												numberOfLines={2}
											>
												{locale === 'en' ? c.name : c.name_ru || c.name}
											</Text>
										</Pressable>
									))}
								</View>
							))}
						</>
					) : null}
				</ScrollView>
			) : (
				<>
					<Text style={styles.hint}>{tt('recognize.lead')}</Text>
					{busy ? (
						<View style={styles.busyRow}>
							<ActivityIndicator color={colors.accent} />
							<Text style={styles.hint}>{tt('recognize.working')}</Text>
						</View>
					) : null}
				</>
			)}

			{errorKey ? <Text style={styles.error}>{tt(errorKey)}</Text> : null}
		</BottomSheet>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		title: {
			color: colors.text,
			fontSize: 18,
			fontWeight: '700',
			fontFamily: fontFamily.bold,
			marginBottom: space.sm
		},
		hint: {
			color: colors.muted,
			fontSize: 14,
			lineHeight: 20,
			fontFamily: fontFamily.regular
		},
		hintSpaced: {
			marginTop: space.md
		},
		scroll: {
			maxHeight: 320
		},
		row: {
			color: colors.text,
			fontSize: 14,
			lineHeight: 20,
			marginTop: space.xs,
			fontFamily: fontFamily.regular
		},
		rowStrong: {
			fontWeight: '600',
			fontFamily: fontFamily.semibold,
			color: colors.text
		},
		unmatchedBlock: {
			marginTop: space.sm,
			gap: space.xs
		},
		skipChip: {
			minHeight: touchMin,
			justifyContent: 'center',
			paddingHorizontal: space.sm,
			borderRadius: radius.sm,
			borderWidth: 1,
			borderColor: colors.border
		},
		skipChipText: {
			color: colors.muted,
			fontSize: 14,
			fontFamily: fontFamily.regular
		},
		candidateChip: {
			minHeight: touchMin,
			justifyContent: 'center',
			paddingHorizontal: space.sm,
			borderRadius: radius.sm,
			borderWidth: 1,
			borderColor: colors.border,
			backgroundColor: colors.panel
		},
		candidateChipActive: {
			borderColor: colors.accent,
			backgroundColor: colors.accentDim
		},
		candidateText: {
			color: colors.text,
			fontSize: 14,
			fontFamily: fontFamily.regular
		},
		candidateTextActive: {
			fontWeight: '600',
			fontFamily: fontFamily.semibold
		},
		busyRow: {
			flexDirection: 'row',
			alignItems: 'center',
			gap: space.sm,
			marginTop: space.md
		},
		error: {
			color: colors.danger,
			fontSize: 14,
			marginTop: space.sm,
			fontFamily: fontFamily.regular
		}
	});
}
