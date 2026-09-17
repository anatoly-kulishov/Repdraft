import { renderDocMarkdown, renderDocMarkdownDocument } from './docMarkdown';

const sample = `## Title

| A | B |
|---|---|
| 1 | 2 |

### Sub

\`\`\`text
flow
\`\`\`
`;

const html = renderDocMarkdown(sample);
if (!html.includes('<table>') || !html.includes('<td>1</td>')) {
	throw new Error('renderDocMarkdown table failed');
}
if (!html.includes('<pre><code>flow</code></pre>')) {
	throw new Error('renderDocMarkdown code fence failed');
}

const doc = renderDocMarkdownDocument(sample);
if (doc.headings.length !== 2) {
	throw new Error('renderDocMarkdownDocument headings failed');
}
if (!doc.html.includes('id="title"') || !doc.html.includes('id="sub"')) {
	throw new Error('renderDocMarkdownDocument heading ids failed');
}

const jsHref = renderDocMarkdownDocument('[open](javascript:alert%281%29)').html;
if (/href="javascript:/i.test(jsHref)) {
	throw new Error(`javascript: href leaked: ${jsHref}`);
}
if (!jsHref.includes('open') || jsHref.includes('<a ')) {
	throw new Error(`unsafe link should degrade to plain text: ${jsHref}`);
}

const dataHref = renderDocMarkdownDocument(
	'[open](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)'
).html;
if (/href="data:/i.test(dataHref)) {
	throw new Error(`data: href leaked: ${dataHref}`);
}

const codeInHref = renderDocMarkdownDocument('[x](https://example.com/`q`)').html;
if (/href="[^"]*<code>/.test(codeInHref)) {
	throw new Error(`code tags injected into href: ${codeInHref}`);
}
if (!/href="https:\/\/example\.com\/`q`"/.test(codeInHref)) {
	throw new Error(`expected intact https href with backtick: ${codeInHref}`);
}

const safeHttp = renderDocMarkdownDocument('[ok](https://example.com/path)').html;
if (!safeHttp.includes('href="https://example.com/path"')) {
	throw new Error(`safe http link lost: ${safeHttp}`);
}

console.log('docMarkdown.selfcheck: ok');
