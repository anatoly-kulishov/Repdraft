/**
 * Mirror project docs into docs/project-rag/corpus for local RAG / agent context.
 * Source of truth stays at the original paths; re-run after editing docs.
 *
 *   npm run docs:rag
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outRoot = join(root, 'docs', 'project-rag');
const corpusRoot = join(outRoot, 'corpus');

/** Roots to walk (relative to repo). */
const WALK = [
	'.cursor/rules',
	'.cursor/product',
	'.cursor/skills',
	'.cursor/agents',
	'.agents/skills',
	'docs'
];

/** Exact files at repo root / elsewhere. */
const FILES = [
	'AGENTS.md',
	'GOAL.md',
	'TASK_SPEC.md',
	'README.md',
	'NOTICE.md',
	'.cursorrules',
	'src/lib/content/user-scenarios.md',
	'src/lib/assets/brand/BRAND-SHEET.md'
];

const EXT = new Set(['.md', '.mdc', '.txt']);

function shouldSkipDir(name) {
	return name === 'node_modules' || name === '.git' || name === 'corpus';
}

/** @param {string} relDir @param {Set<string>} acc */
function collectFromWalk(relDir, acc) {
	const abs = join(root, relDir);
	if (!existsSync(abs)) return;
	for (const name of readdirSync(abs)) {
		const rel = join(relDir, name).split(sep).join('/');
		const full = join(root, rel);
		const st = statSync(full);
		if (st.isDirectory()) {
			if (shouldSkipDir(name)) continue;
			if (rel === 'docs/project-rag' || rel.startsWith('docs/project-rag/')) continue;
			collectFromWalk(rel, acc);
			continue;
		}
		const lower = name.toLowerCase();
		const dot = lower.lastIndexOf('.');
		const ext = dot >= 0 ? lower.slice(dot) : '';
		if (!EXT.has(ext) && name !== '.cursorrules') continue;
		acc.add(rel);
	}
}

function mirrorPath(rel) {
	if (rel === '.cursorrules') return 'cursorrules.txt';
	return rel.replace(/^\./, '').replace(/\.mdc$/i, '.md');
}

function titleFromContent(text, fallback) {
	const m = text.match(/^#\s+(.+)$/m);
	return (m?.[1] ?? fallback).trim().slice(0, 120);
}

function main() {
	const sources = new Set(FILES.filter((f) => existsSync(join(root, f))));
	for (const dir of WALK) collectFromWalk(dir, sources);

	rmSync(corpusRoot, { recursive: true, force: true });
	mkdirSync(corpusRoot, { recursive: true });

	const entries = [];
	for (const rel of [...sources].sort()) {
		const abs = join(root, rel);
		if (!existsSync(abs) || !statSync(abs).isFile()) continue;
		const raw = readFileSync(abs);
		const text = raw.toString('utf8');
		const destRel = mirrorPath(rel);
		const destAbs = join(corpusRoot, destRel);
		mkdirSync(dirname(destAbs), { recursive: true });
		const header =
			`<!-- source: ${rel} -->\n` +
			`<!-- synced: ${new Date().toISOString().slice(0, 10)} -->\n\n`;
		writeFileSync(destAbs, header + text, 'utf8');
		const hash = createHash('sha256').update(raw).digest('hex').slice(0, 12);
		entries.push({
			source: rel,
			corpus: `corpus/${destRel}`,
			title: titleFromContent(text, rel),
			bytes: raw.length,
			sha256_12: hash
		});
	}

	const manifest = {
		generatedAt: new Date().toISOString(),
		count: entries.length,
		note: 'Copies for RAG. Edit originals, then npm run docs:rag.',
		entries
	};
	writeFileSync(join(outRoot, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

	const byArea = new Map();
	for (const e of entries) {
		const area = e.source.split('/')[0] || 'root';
		const list = byArea.get(area) ?? [];
		list.push(e);
		byArea.set(area, list);
	}

	const indexLines = [
		'# Project RAG corpus',
		'',
		'Снимок документации Repdraft для поиска / RAG. **Источник правды** - исходные пути в репо.',
		'',
		'Пересобрать:',
		'',
		'```bash',
		'npm run docs:rag',
		'```',
		'',
		`Файлов: **${entries.length}** · ${manifest.generatedAt}`,
		'',
		'## Как пользоваться',
		'',
		'- Корпус: [`corpus/`](./corpus/)',
		'- Машиночитаемый индекс: [`manifest.json`](./manifest.json)',
		'- В чате: «смотри `docs/project-rag`» или конкретный файл из списка ниже',
		'',
		'## Каталог',
		''
	];

	for (const area of [...byArea.keys()].sort()) {
		indexLines.push(`### ${area}`, '');
		for (const e of byArea.get(area) ?? []) {
			indexLines.push(`- [${e.title}](./${e.corpus}) ← \`${e.source}\``);
		}
		indexLines.push('');
	}

	writeFileSync(join(outRoot, 'INDEX.md'), indexLines.join('\n'), 'utf8');
	console.log(`docs/project-rag: ${entries.length} files → ${relative(root, corpusRoot)}`);
}

main();
