import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

/** The opening tag for an element id in the static page. */
function tagWithId(id: string): string {
    const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = new RegExp(`<[^>]+\\bid="${escapedId}"[^>]*>`).exec(html);
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
        expect(tag).toContain('data-icon="back"');
    });

    test.each([
        ['Evaluation Editor Actions', 'evaluation-editor-back', 'eval-editor-save'],
        ['Functional Test Editor Actions', 'test-editor-back', 'test-save'],
        ['Perform Actions', 'perform-back', 'perform-save']
    ])('%s puts Back before its save action', (groupLabel, backId, saveId) => {
        const start = html.indexOf(`aria-label="${groupLabel}"`);
        const end = html.indexOf('</div>', start);
        const actions = html.slice(start, end);

        expect(actions.indexOf(`id="${backId}"`)).toBeLessThan(actions.indexOf(`id="${saveId}"`));
    });
});

describe('file download controls', () => {
    test('file-writing actions say Download while in-memory actions still say Save', () => {
        expect(html).toContain('id="eval-save-file" disabled>Download Evaluation File</button>');
        expect(html).toContain('id="perform-save">Download Functional Test Results</button>');
        expect(tagWithId('eval-editor-save')).toContain('aria-disabled="true"');
        expect(html).toContain('aria-disabled="true">Save changes</button>');
        expect(tagWithId('test-save')).toContain('aria-disabled="true"');
        expect(html).toContain('id="add-issue-dialog-save" type="button">Save Issue</button>');
    });
});

describe('page action placement', () => {
    test('puts evaluation actions inside Evaluation Details', () => {
        const detailsStart = html.indexOf('id="landing-details-heading"');
        const detailsEnd = html.indexOf('<label for="select-test">', detailsStart);
        const details = html.slice(detailsStart, detailsEnd);

        expect(details).toContain('id="eval-edit"');
        expect(details).toContain('id="eval-view-results"');
        expect(details).toContain('id="eval-save-file"');

        const fileActions = html.slice(
            html.indexOf('aria-label="Evaluation File Actions"'), detailsStart
        );
        expect(fileActions).not.toContain('id="eval-edit"');
        expect(fileActions).not.toContain('id="eval-view-results"');
        expect(fileActions).not.toContain('id="eval-save-file"');
    });

    test('puts Evaluation editor actions immediately after its heading', () => {
        const heading = html.indexOf('id="evaluation-editor-heading"');
        const actions = html.indexOf('aria-label="Evaluation Editor Actions"');
        const status = html.indexOf('id="evaluation-editor-msg"');
        expect(heading).toBeLessThan(actions);
        expect(actions).toBeLessThan(status);
    });

    test('puts each new control after the list it changes', () => {
        expect(html.indexOf('id="step-list"')).toBeLessThan(html.indexOf('id="new-step-btn"'));
        expect(html.indexOf('id="new-step-btn"')).toBeLessThan(html.indexOf('id="extensions-heading"'));
        expect(html.indexOf('id="extension-list"')).toBeLessThan(html.indexOf('id="new-extension-btn"'));
    });
});

describe('labelled action icons', () => {
    test.each([
        ['eval-edit', 'edit'],
        ['edit-test', 'edit'],
        ['eval-add-test', 'add'],
        ['eval-edit-test', 'edit'],
        ['eval-delete-test', 'trash'],
        ['add-step', 'add'],
        ['add-issue-btn[0]', 'add'],
        ['test-edit-at-btn', 'expand']
    ])('%s declares its corresponding icon', (id, icon) => {
        expect(tagWithId(id)).toContain(`data-icon="${icon}"`);
    });

    test('the disclosure puts its chevron after the label', () => {
        expect(tagWithId('test-edit-at-btn')).toContain('data-icon-position="after"');
    });
});

describe('dialog close controls', () => {
    test('dismissible content dialogs have a close control with the shared danger class', () => {
        const dialogCount = [...html.matchAll(/<dialog\b/g)].length;
        const topCloseIds = [
            'new-step-dialog-close',
            'view-summary-dialog-close',
            'view-overall-comments-dialog-close',
            'add-issue-dialog-close',
            'view-results-dialog-close',
            'eval-view-results-dialog-close'
        ];

        expect(dialogCount).toBe(7);
        for (const id of topCloseIds) {
            expect(tagWithId(id)).toContain('class="dialog-close"');
        }
    });

    test('the unsaved changes dialog has three explicit, accessible choices', () => {
        const dialog = html.slice(
            html.indexOf('<dialog id="unsaved-changes-dialog"'),
            html.indexOf('</dialog>', html.indexOf('<dialog id="unsaved-changes-dialog"'))
        );

        expect(tagWithId('unsaved-changes-dialog'))
            .toContain('aria-labelledby="unsaved-changes-heading"');
        expect(tagWithId('unsaved-changes-dialog'))
            .toContain('aria-describedby="unsaved-changes-description"');
        expect(dialog.indexOf('unsaved-changes-keep-editing'))
            .toBeLessThan(dialog.indexOf('unsaved-changes-discard'));
        expect(dialog.indexOf('unsaved-changes-discard'))
            .toBeLessThan(dialog.indexOf('unsaved-changes-save'));
        expect(tagWithId('unsaved-changes-discard')).toContain('class="danger-action"');
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
