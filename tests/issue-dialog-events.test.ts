import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { addIssueDialogEvents } from '../src/ui/issue-dialog.js';

interface DialogTarget extends EventTarget {
    close: ReturnType<typeof vi.fn>;
}

function dialogTarget(): DialogTarget {
    const target = new EventTarget() as DialogTarget;
    target.close = vi.fn();
    return target;
}

let elements: Map<string, unknown>;
let dialog: DialogTarget;

beforeEach(() => {
    dialog = dialogTarget();
    elements = new Map([
        ['add-issue-dialog', dialog],
        ['add-issue-dialog-close', new EventTarget()],
        ['add-issue-dialog-close-bottom', new EventTarget()],
        ['add-issue-dialog-new-issue', new EventTarget()]
    ]);
    (globalThis as unknown as { document: unknown }).document = {
        getElementById(id: string) {
            return elements.get(id) ?? null;
        }
    };
    (globalThis as unknown as { window: unknown }).window = { confirm: vi.fn() };
});

afterEach(() => {
    delete (globalThis as unknown as { document?: unknown }).document;
    delete (globalThis as unknown as { window?: unknown }).window;
});

describe('Add Issue close controls', () => {
    test('the top and bottom controls both close the dialog', () => {
        addIssueDialogEvents();

        (elements.get('add-issue-dialog-close') as EventTarget)
            .dispatchEvent(new Event('click'));
        (elements.get('add-issue-dialog-close-bottom') as EventTarget)
            .dispatchEvent(new Event('click'));

        expect(dialog.close).toHaveBeenCalledTimes(2);
    });

    test('both controls use the same unsaved-entry confirmation', () => {
        elements.set('add-issue-controls', {
            classList: { contains: vi.fn(() => false) }
        });
        elements.set('add-issue-description', { value: 'Part-entered issue' });
        elements.set('add-issue-findingURL', { value: '' });
        elements.set('add-issue-score', { value: '-1' });
        const confirm = vi.fn(() => false);
        (globalThis as unknown as { window: { confirm: typeof confirm } }).window.confirm = confirm;
        addIssueDialogEvents();

        (elements.get('add-issue-dialog-close') as EventTarget)
            .dispatchEvent(new Event('click'));
        (elements.get('add-issue-dialog-close-bottom') as EventTarget)
            .dispatchEvent(new Event('click'));

        expect(confirm).toHaveBeenCalledTimes(2);
        expect(dialog.close).not.toHaveBeenCalled();
    });
});
