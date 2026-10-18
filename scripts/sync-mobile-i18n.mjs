#!/usr/bin/env node
/**
 * Copy missing RU/EN keys from src/lib/i18n/messages.ts into mobile/src/i18n/messages.ts.
 * Run: node scripts/sync-mobile-i18n.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const webPath = path.join(root, 'src/lib/i18n/messages.ts');
const mobilePath = path.join(root, 'mobile/src/i18n/messages.ts');

function parseDict(source, lang) {
	const marker = `const ${lang}:`;
	const start = source.indexOf(marker);
	if (start < 0) throw new Error(`Missing ${marker} in ${source.slice(0, 80)}`);
	let i = source.indexOf('{', start);
	if (i < 0) throw new Error(`No brace for ${lang}`);
	let depth = 0;
	const begin = i;
	for (; i < source.length; i++) {
		const ch = source[i];
		if (ch === '{') depth++;
		else if (ch === '}') {
			depth--;
			if (depth === 0) {
				i++;
				break;
			}
		}
	}
	const block = source.slice(begin, i);
	const dict = {};
	const re = /^\t'([^']+)':\s*(['"`])([\s\S]*?)\2,?$/gm;
	let m;
	while ((m = re.exec(block)) !== null) {
		dict[m[1]] = m[3].replace(/\\'/g, "'");
	}
	return dict;
}

function mergeDict(mobileSource, lang, webDict) {
	const marker = `const ${lang}: Record<string, string> = {`;
	const start = mobileSource.indexOf(marker);
	if (start < 0) throw new Error(`Missing mobile ${lang}`);
	const closeIdx = mobileSource.indexOf('\n};', start);
	if (closeIdx < 0) throw new Error(`Missing mobile ${lang} close`);
	const head = mobileSource.slice(0, closeIdx);
	const tail = mobileSource.slice(closeIdx);
	const existing = parseDict(mobileSource, lang);
	const missing = Object.keys(webDict)
		.filter((k) => !(k in existing))
		.sort();
	if (missing.length === 0) {
		console.log(`${lang}: no missing keys`);
		return mobileSource;
	}
	const lines = missing.map((k) => {
		const v = webDict[k].replace(/'/g, "\\'");
		return `\t'${k}': '${v}',`;
	});
	console.log(`${lang}: added ${missing.length} keys`);
	const needsComma = !head.trimEnd().endsWith(',');
	const prefix = needsComma && !head.trimEnd().endsWith('{') ? ',' : '';
	return `${head}${prefix}\n${lines.join('\n')}${tail}`;
}

const web = readFileSync(webPath, 'utf8');
const webRu = parseDict(web, 'ru');
const webEn = parseDict(web, 'en');
let mobile = readFileSync(mobilePath, 'utf8');
mobile = mergeDict(mobile, 'ru', webRu);
mobile = mergeDict(mobile, 'en', webEn);
writeFileSync(mobilePath, mobile);
