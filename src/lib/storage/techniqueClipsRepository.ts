import type { TechniqueClip } from '$lib/domain/clips';
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
		createdAt: row.created_at
	};
}

export async function listClipsForExercise(exerciseId: string): Promise<TechniqueClip[]> {
	const supabase = getSupabase();
	if (!supabase) return [];
	const { data, error } = await supabase
		.from('technique_clips')
		.select('id,exercise_id,user_id,title,author_label,gif_path,created_at')
		.eq('exercise_id', exerciseId)
		.order('created_at', { ascending: false })
		.limit(40);
	if (error) throw error;
	return (data as ClipRow[] | null)?.map(rowToClip) ?? [];
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
	const email = userData.user.email ?? '';
	const authorLabel = email.includes('@') ? email.split('@')[0]! : 'атлет';
	const clipId = crypto.randomUUID();
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
