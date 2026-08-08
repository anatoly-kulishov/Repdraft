import { CLIP_MODERATION, type TechniqueClip } from '$lib/domain/clips';
import { newId } from '$lib/domain/id';
import { getSupabase } from '$lib/supabase/client';

const BUCKET = 'technique-gifs';

type ClipRow = {
	id: string;
	exercise_id: string;
	user_id: string;
	title: string;
	author_label: string;
	gif_path: string;
	created_at: string;
	hidden?: boolean | null;
	report_count?: number | null;
};

function publicGifUrl(path: string): string {
	const supabase = getSupabase();
	if (!supabase) return '';
	const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
	return data.publicUrl;
}

function rowToClip(row: ClipRow): TechniqueClip {
	return {
		id: row.id,
		exerciseId: row.exercise_id,
		userId: row.user_id,
		title: row.title,
		authorLabel: row.author_label,
		gifPath: row.gif_path,
		gifUrl: publicGifUrl(row.gif_path),
		createdAt: row.created_at,
		hidden: Boolean(row.hidden),
		reportCount: row.report_count ?? 0
	};
}

const CLIP_SELECT =
	'id,exercise_id,user_id,title,author_label,gif_path,created_at,hidden,report_count';

function isMissingModerationColumn(error: { message?: string; code?: string } | null): boolean {
	if (!error?.message) return false;
	return /hidden|report_count|technique_clip_reports/i.test(error.message);
}

export async function listClipsForExercise(exerciseId: string): Promise<TechniqueClip[]> {
	const supabase = getSupabase();
	if (!supabase) return [];

	const withModeration = await supabase
		.from('technique_clips')
		.select(CLIP_SELECT)
		.eq('exercise_id', exerciseId)
		.eq('hidden', false)
		.order('created_at', { ascending: false })
		.limit(40);

	if (!withModeration.error) {
		return (withModeration.data as ClipRow[] | null)?.map(rowToClip) ?? [];
	}

	// Fallback before moderation SQL is applied.
	if (!isMissingModerationColumn(withModeration.error)) throw withModeration.error;

	const legacy = await supabase
		.from('technique_clips')
		.select('id,exercise_id,user_id,title,author_label,gif_path,created_at')
		.eq('exercise_id', exerciseId)
		.order('created_at', { ascending: false })
		.limit(40);
	if (legacy.error) throw legacy.error;
	return (legacy.data as ClipRow[] | null)?.map(rowToClip) ?? [];
}

export async function listRecentClips(limit = 16): Promise<TechniqueClip[]> {
	const supabase = getSupabase();
	if (!supabase) return [];

	const withModeration = await supabase
		.from('technique_clips')
		.select(CLIP_SELECT)
		.eq('hidden', false)
		.order('created_at', { ascending: false })
		.limit(limit);

	if (!withModeration.error) {
		return (withModeration.data as ClipRow[] | null)?.map(rowToClip) ?? [];
	}

	if (!isMissingModerationColumn(withModeration.error)) throw withModeration.error;

	const legacy = await supabase
		.from('technique_clips')
		.select('id,exercise_id,user_id,title,author_label,gif_path,created_at')
		.order('created_at', { ascending: false })
		.limit(limit);
	if (legacy.error) throw legacy.error;
	return (legacy.data as ClipRow[] | null)?.map(rowToClip) ?? [];
}

export async function countUserClipsLastDay(userId: string): Promise<number> {
	const supabase = getSupabase();
	if (!supabase) return 0;
	const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
	const { count, error } = await supabase
		.from('technique_clips')
		.select('id', { count: 'exact', head: true })
		.eq('user_id', userId)
		.gt('created_at', since);
	if (error) throw error;
	return count ?? 0;
}

export async function publishTechniqueClip(input: {
	exerciseId: string;
	title: string;
	gifBlob: Blob;
}): Promise<TechniqueClip> {
	const supabase = getSupabase();
	if (!supabase) throw new Error('Облако не подключено');

	const { data: userData, error: userError } = await supabase.auth.getUser();
	if (userError || !userData.user) throw new Error('Нужно войти в аккаунт');

	const userId = userData.user.id;
	const recent = await countUserClipsLastDay(userId);
	if (recent >= CLIP_MODERATION.maxPerDay) {
		throw new Error('RATE_LIMIT');
	}

	const email = userData.user.email ?? '';
	const authorLabel = email.includes('@') ? email.split('@')[0]! : 'атлет';
	const clipId = newId();
	const path = `${userId}/${clipId}.gif`;

	const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, input.gifBlob, {
		contentType: 'image/gif',
		upsert: false
	});
	if (uploadError) throw uploadError;

	const { data, error } = await supabase
		.from('technique_clips')
		.insert({
			id: clipId,
			exercise_id: input.exerciseId,
			user_id: userId,
			title: input.title.trim() || 'Техника',
			author_label: authorLabel,
			gif_path: path
		})
		.select('id,exercise_id,user_id,title,author_label,gif_path,created_at')
		.single();

	if (error) {
		await supabase.storage.from(BUCKET).remove([path]);
		if (/RATE_LIMIT/i.test(error.message)) throw new Error('RATE_LIMIT');
		throw error;
	}

	return rowToClip(data as ClipRow);
}

export async function deleteTechniqueClip(clip: TechniqueClip): Promise<void> {
	const supabase = getSupabase();
	if (!supabase) throw new Error('Облако не подключено');

	const { error } = await supabase.from('technique_clips').delete().eq('id', clip.id);
	if (error) throw error;

	await supabase.storage.from(BUCKET).remove([clip.gifPath]);
}

export async function reportTechniqueClip(clipId: string, reason = ''): Promise<{ hidden: boolean }> {
	const supabase = getSupabase();
	if (!supabase) throw new Error('Облако не подключено');

	const { data: userData, error: userError } = await supabase.auth.getUser();
	if (userError || !userData.user) throw new Error('NEED_AUTH');

	const { error } = await supabase.from('technique_clip_reports').insert({
		clip_id: clipId,
		reporter_id: userData.user.id,
		reason: reason.trim().slice(0, 200)
	});

	if (error) {
		if (/duplicate|unique/i.test(error.message)) throw new Error('ALREADY_REPORTED');
		if (/technique_clip_reports/i.test(error.message)) throw new Error('NEED_SQL');
		throw error;
	}

	const { data } = await supabase
		.from('technique_clips')
		.select('hidden')
		.eq('id', clipId)
		.maybeSingle();

	return { hidden: Boolean(data?.hidden) };
}
