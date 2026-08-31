function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
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

/** Docs / QA markdown: headings, lists, tables, fenced code, hr. */
export function renderDocMarkdown(markdown: string): string {
	const lines = markdown.replace(/\r\n/g, '\n').split('\n');
	const out: string[] = [];
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
			closeList();
			out.push(`<h3>${inlineMarkdown(line.slice(4))}</h3>`);
			continue;
		}
		if (line.startsWith('## ')) {
			closeList();
			out.push(`<h2>${inlineMarkdown(line.slice(3))}</h2>`);
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
	return out.join('');
}
