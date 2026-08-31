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

console.log('docMarkdown.selfcheck: ok');
