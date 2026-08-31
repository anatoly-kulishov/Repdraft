export type DocHeading = {
	level: 2 | 3;
	id: string;
	title: string;
};

export type DocMarkdownDocument = {
	html: string;
	headings: DocHeading[];
};

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

function stripInlineMarkdown(text: string): string {
	return text
		.replace(/\*\*([^*]+)\*\*/g, '$1')
		.replace(/`([^`]+)`/g, '$1')
		.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
		.trim();
}

function slugifyHeading(text: string, used: Set<string>): string {
	const base =
		stripInlineMarkdown(text)
			.toLowerCase()
			.replace(/[^\p{L}\p{N}\s-]/gu, '')
			.trim()
			.replace(/\s+/g, '-')
			.replace(/-+/g, '-') || 'section';
	let id = base;
	let suffix = 2;
	while (used.has(id)) {
		id = `${base}-${suffix++}`;
	}
	used.add(id);
	return id;
}

function inlineMarkdown(text: string): string {
	let out = escapeHtml(text);
	out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label, href) => {
		const safeHref = String(href).replace(/"/g, '&quot;');
		return `<a href="${safeHref}">${label}</a>`;
	});
	out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
	out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
	return out;
}

const ORDERED_ITEM = /^(\d+)\.\s+(.*)$/;
const TABLE_ROW = /^\|(.+)\|$/;
const TABLE_SEP = /^\|[\s\-:|]+\|$/;

function parseTableRow(line: string): string[] {
	return line
		.slice(1, -1)
		.split('|')
		.map((cell) => cell.trim());
}

function renderTable(rows: string[][]): string {
	if (rows.length === 0) return '';
	const [head, ...body] = rows;
	const headHtml = head.map((c) => `<th>${inlineMarkdown(c)}</th>`).join('');
	const bodyHtml = body
		.map((row) => `<tr>${row.map((c) => `<td>${inlineMarkdown(c)}</td>`).join('')}</tr>`)
		.join('');
	return `<table><thead><tr>${headHtml}</tr></thead><tbody>${bodyHtml}</tbody></table>`;
}

/** Docs / QA markdown: headings with ids, lists, tables, fenced code, hr. */
export function renderDocMarkdownDocument(markdown: string): DocMarkdownDocument {
	const lines = markdown.replace(/\r\n/g, '\n').split('\n');
	const out: string[] = [];
	const headings: DocHeading[] = [];
	const usedIds = new Set<string>();
	let listTag: 'ul' | 'ol' | null = null;
	let tableRows: string[][] = [];
	let codeLines: string[] = [];
	let inCode = false;

	const closeList = () => {
		if (listTag) {
			out.push(`</${listTag}>`);
			listTag = null;
		}
	};

	const openList = (tag: 'ul' | 'ol') => {
		if (listTag !== tag) {
			closeList();
			out.push(`<${tag}>`);
			listTag = tag;
		}
	};

	const flushTable = () => {
		if (tableRows.length === 0) return;
		out.push(renderTable(tableRows));
		tableRows = [];
	};

	const flushCode = () => {
		if (codeLines.length === 0) return;
		out.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
		codeLines = [];
	};

	const pushHeading = (level: 2 | 3, raw: string) => {
		closeList();
		const title = stripInlineMarkdown(raw);
		const id = slugifyHeading(title, usedIds);
		headings.push({ level, id, title });
		out.push(`<h${level} id="${id}">${inlineMarkdown(raw)}</h${level}>`);
	};

	for (const raw of lines) {
		const line = raw.trimEnd();

		if (inCode) {
			if (line.trim() === '```') {
				inCode = false;
				flushCode();
			} else {
				codeLines.push(line);
			}
			continue;
		}

		if (line.trim() === '```' || line.trim().startsWith('```')) {
			closeList();
			flushTable();
			inCode = true;
			codeLines = [];
			continue;
		}

		if (TABLE_ROW.test(line.trim())) {
			closeList();
			if (TABLE_SEP.test(line.trim())) continue;
			tableRows.push(parseTableRow(line.trim()));
			continue;
		}
		flushTable();

		if (!line.trim()) {
			closeList();
			continue;
		}
		if (line.trim() === '---') {
			closeList();
			out.push('<hr />');
			continue;
		}
		if (line.startsWith('### ')) {
			pushHeading(3, line.slice(4));
			continue;
		}
		if (line.startsWith('## ')) {
			pushHeading(2, line.slice(3));
			continue;
		}
		if (line.startsWith('# ')) {
			closeList();
			out.push(`<h1>${inlineMarkdown(line.slice(2))}</h1>`);
			continue;
		}
		if (line.startsWith('- ')) {
			openList('ul');
			out.push(`<li>${inlineMarkdown(line.slice(2))}</li>`);
			continue;
		}
		const ordered = ORDERED_ITEM.exec(line);
		if (ordered) {
			openList('ol');
			out.push(`<li>${inlineMarkdown(ordered[2] ?? '')}</li>`);
			continue;
		}
		closeList();
		out.push(`<p>${inlineMarkdown(line)}</p>`);
	}

	closeList();
	flushTable();
	if (inCode) flushCode();
	return { html: out.join(''), headings };
}

/** Docs / QA markdown HTML only. */
export function renderDocMarkdown(markdown: string): string {
	return renderDocMarkdownDocument(markdown).html;
}
