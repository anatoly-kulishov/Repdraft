import { renderDocMarkdown } from './docMarkdown';

const sample = `## Title

| A | B |
|---|---|
| 1 | 2 |

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

console.log('docMarkdown.selfcheck: ok');
