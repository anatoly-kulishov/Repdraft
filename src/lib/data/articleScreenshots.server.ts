import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const EN_DIR = join(process.cwd(), 'static/images/articles/en');
const IMAGE_FILE = /\.(jpe?g|png|webp)$/i;

/** Basenames present under `static/images/articles/en/` (build/runtime inventory). */
export function listEnArticleScreenshots(): string[] {
	try {
		return readdirSync(EN_DIR).filter((name) => IMAGE_FILE.test(name));
	} catch {
		return [];
	}
}
