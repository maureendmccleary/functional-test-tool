import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

/** The opening tag for an element id in the static page. */
function tagWithId(id: string): string {
    const match = new RegExp(`<[^>]+\\bid="${id}"[^>]*>`).exec(html);
    return match ? match[0] : '';
}

describe('Back controls', () => {
    test.each([
        ['evaluation-editor-back', '#landing-heading', 'Back to Evaluation Home'],
        ['test-editor-back', '#landing-heading', 'Back to Evaluation Home'],
        ['perform-back', '#landing-heading', 'Back to Evaluation Home']
    ])('%s is a destination-aware link', (id, href, label) => {
        const tag = tagWithId(id);
        expect(tag).toMatch(/^<a\b/);
        expect(tag).toContain(`href="${href}"`);
        expect(tag).toContain(`aria-label="${label}"`);
    });
});

describe('file download controls', () => {
    test('file-writing actions say Download while in-memory actions still say Save', () => {
        expect(html).toContain('id="eval-save-file" disabled>Download Evaluation File</button>');
        expect(html).toContain('id="perform-save">Download Functional Test Results</button>');
        expect(html).toContain('id="eval-editor-save" type="button">Save</button>');
        expect(html).toContain('id="add-issue-dialog-save" type="button">Save Issue</button>');
    });
});

describe('dialog close controls', () => {
    test('every dialog has a close control with the shared danger class', () => {
        const dialogCount = [...html.matchAll(/<dialog\b/g)].length;
        const topCloseIds = [
            'new-step-dialog-close',
            'view-summary-dialog-close',
            'view-overall-comments-dialog-close',
            'add-issue-dialog-close',
            'view-results-dialog-close',
            'eval-view-results-dialog-close'
        ];

        expect(dialogCount).toBe(6);
        for (const id of topCloseIds) {
            expect(tagWithId(id)).toContain('class="dialog-close"');
        }
    });

    test('Add Issue has a bottom Close beside its changing primary action', () => {
        const issueDialog = html.slice(
            html.indexOf('<dialog id="add-issue-dialog"'),
            html.indexOf('</dialog>', html.indexOf('<dialog id="add-issue-dialog"'))
        );
        const actions = issueDialog.slice(issueDialog.indexOf('aria-label="Issue Actions"'));

        expect(actions).toContain('id="add-issue-dialog-new-issue"');
        expect(actions).toContain('id="add-issue-dialog-save"');
        expect(actions).toContain('id="add-issue-dialog-close-bottom"');
        expect(tagWithId('add-issue-dialog-close-bottom')).toContain('class="dialog-close"');
    });
});
