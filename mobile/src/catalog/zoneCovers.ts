import { pickZoneCoverImage } from '@repdraft/domain/catalogCover';
import type { ExerciseIndexItem } from '@repdraft/domain/types';

/** Cover image path per body_part (same scoring as web hub). */
export function zoneCoverMap(catalog: ExerciseIndexItem[]): Record<string, string> {
	const byPart = new Map<string, ExerciseIndexItem[]>();
	for (const ex of catalog) {
		const list = byPart.get(ex.body_part) ?? [];
		list.push(ex);
		byPart.set(ex.body_part, list);
	}
	const covers: Record<string, string> = {};
	const used = new Set<string>();
	for (const [zone, list] of byPart) {
		const image = pickZoneCoverImage(list, zone, used);
		if (image) {
			covers[zone] = image;
			used.add(image);
		}
	}
	return covers;
}
