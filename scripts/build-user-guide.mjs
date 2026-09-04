import { readFileSync, writeFileSync } from 'node:fs';
import { marked } from 'marked';

/**
 * Renders USER-GUIDE.md into the built site as user-guide.html.
 *
 * The guide is written and reviewed as Markdown, because it is prose and it
 * describes a UI that changes; keeping the published copy as hand written HTML
 * would mean editing markup to fix a sentence, and the two would drift. So the
 * Markdown is the source of truth and this is the only place it becomes a page.
 *
 * Pages here deploys the Vite build with Jekyll turned off, so nothing else
 * would render the Markdown. It runs after `vite build` and writes into `dist`.
 */

const SOURCE = new URL('../USER-GUIDE.md', import.meta.url);
const OUTPUT = new URL('../dist/user-guide.html', import.meta.url);

/** Text that is about to sit inside markup, with the five characters escaped. */
function escapeHtml(value) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * The page's own styling.
 *
 * Sampled from styles.css so the guide reads as part of the tool rather than a
 * document that happens to sit beside it, and stated in one place here because
 * the app's stylesheet is built and hashed by Vite and this page is not part of
 * that graph.
 *
 * Both colour schemes are defined. A guide to an accessibility tool that only
 * worked in one of them would be an odd thing to publish.
 */
const STYLES = `
:root {
    color-scheme: light dark;
    --brand: #1F2DF5;
    --surface: #ffffff;
    --surface-muted: #F7F7FB;
    --border: #C9CBDE;
    --text: #111215;
    --text-muted: #4A4D66;
    --focus-ring: #111215;
}

@media (prefers-color-scheme: dark) {
    :root {
        --brand: #9FA8FF;
        --surface: #16171C;
        --surface-muted: #0E0F13;
        --border: #3A3D52;
        --text: #F2F3F7;
        --text-muted: #B9BCD0;
        --focus-ring: #F2F3F7;
    }
}

* { box-sizing: border-box; }

body {
    margin: 0 auto;
    /* A measure, not the window: long lines are hard to track back from. */
    max-width: 42rem;
    padding: 2rem 1.5rem 6rem;
    background-color: var(--surface);
    color: var(--text);
    font-family: system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    font-size: 1rem;
    line-height: 1.6;
}

/* Visible only once focused, which is the whole point of a skip link. */
.skip-link {
    position: absolute;
    left: -9999px;
    top: 0;
}

.skip-link:focus {
    left: 0;
    padding: 0.5rem 1rem;
    background-color: var(--surface);
    border: 2px solid var(--focus-ring);
}

:focus-visible {
    outline: 3px solid var(--focus-ring);
    outline-offset: 2px;
}

h1, h2, h3 { line-height: 1.25; }
h1 { font-size: 1.875rem; margin: 0 0 0.5rem; }
h2 { font-size: 1.375rem; margin: 2.5rem 0 0.75rem; padding-top: 1.5rem; border-top: 1px solid var(--border); }
h3 { font-size: 1.125rem; margin: 2rem 0 0.5rem; }

a { color: var(--brand); }

code {
    padding: 0.1em 0.35em;
    background-color: var(--surface-muted);
    border: 1px solid var(--border);
    border-radius: 4px;
    font-size: 0.9em;
}

pre {
    padding: 1rem;
    overflow-x: auto;
    background-color: var(--surface-muted);
    border: 1px solid var(--border);
    border-radius: 6px;
}

pre code { padding: 0; background: none; border: none; }

table {
    width: 100%;
    margin: 1rem 0;
    border-collapse: collapse;
}

th, td {
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid var(--border);
    text-align: left;
    vertical-align: top;
}

th { background-color: var(--surface-muted); }

blockquote {
    margin: 1.5rem 0;
    padding: 0.5rem 1rem;
    border-left: 4px solid var(--brand);
    color: var(--text-muted);
}

hr { margin: 2.5rem 0; border: 0; border-top: 1px solid var(--border); }

.back-to-app { margin-bottom: 2rem; }
`;

const markdown = readFileSync(SOURCE, 'utf8');

// The first heading names the document, and is used for the title so the tab
// says what the page is rather than repeating the site's name.
const firstHeading = /^#\s+(.+)$/m.exec(markdown);
const title = firstHeading ? firstHeading[1].trim() : 'User guide';

/**
 * A heading's anchor, by the rule the guide's own contents list assumes.
 *
 * Lower cased, punctuation dropped, spaces hyphenated: the same shape GitHub
 * gives a heading, so the links written in the Markdown resolve both there and
 * here. Written out rather than taken from marked, which stopped generating
 * heading ids and silently ignores the option asking it to.
 */
function slug(text) {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9 -]/g, '')
        .trim()
        .replace(/\s+/g, '-');
}

/**
 * Gives every heading the anchor its contents entry points at.
 *
 * Duplicated headings would collide, so a repeat gets a numbered suffix rather
 * than two elements answering to one anchor.
 */
function withHeadingIds(html) {
    const used = new Map();
    return html.replace(/<(h[1-6])>(.*?)<\/\1>/gs, (whole, tag, inner) => {
        const base = slug(inner.replace(/<[^>]+>/g, ''));
        if (base === '') {
            return whole;
        }
        const seen = used.get(base) ?? 0;
        used.set(base, seen + 1);
        const id = seen === 0 ? base : `${base}-${seen}`;
        return `<${tag} id="${id}">${inner}</${tag}>`;
    });
}

const body = withHeadingIds(marked.parse(markdown));

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>${STYLES}</style>
</head>
<body>
<a class="skip-link" href="#guide">Skip to the guide</a>
<p class="back-to-app"><a href="./">Back to the Functional Accessibility Testing Tool</a></p>
<main id="guide">
${body}
</main>
</body>
</html>
`;

writeFileSync(OUTPUT, page);
process.stdout.write(`user-guide.html written from USER-GUIDE.md (${markdown.length} bytes in)\n`);
