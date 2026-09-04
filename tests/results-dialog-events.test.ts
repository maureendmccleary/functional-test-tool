import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const evaluation = { tests: [], score: 0 };

vi.mock('../src/io/docx-report.js', () => ({
    renderEvalResultsDocx: vi.fn()
}));

vi.mock('../src/state/store.js', () => ({
    getEvaluation: vi.fn(() => evaluation),
    getCurrentRun: vi.fn(),
    getCurrentTest: vi.fn()
}));

const report = await import('../src/io/docx-report.js');
const { addEvalResultsDialogEvents } = await import('../src/ui/eval-results-view.js');
const { addViewResultsDialogEvents } = await import('../src/ui/results-view.js');

interface DialogTarget extends EventTarget {
    close: ReturnType<typeof vi.fn>;
}

function dialogTarget(): DialogTarget {
    const target = new EventTarget() as DialogTarget;
    target.close = vi.fn();
    return target;
}

let elements: Map<string, EventTarget | DialogTarget>;

beforeEach(() => {
    elements = new Map([
        ['eval-view-results-dialog', dialogTarget()],
        ['eval-view-results-dialog-close', new EventTarget()],
        ['generate-pdf', new EventTarget()],
        ['view-results-dialog', dialogTarget()],
        ['view-results-dialog-close', new EventTarget()]
    ]);
    (globalThis as unknown as { document: unknown }).document = {
        getElementById(id: string) {
            return elements.get(id) ?? null;
        }
    };
});

afterEach(() => {
    vi.clearAllMocks();
    delete (globalThis as unknown as { document?: unknown }).document;
});

describe('results dialog event wiring', () => {
    test('one report activation builds one report after repeated wiring attempts', () => {
        addEvalResultsDialogEvents();
        addEvalResultsDialogEvents();

        elements.get('generate-pdf')!.dispatchEvent(new Event('click'));

        expect(report.renderEvalResultsDocx).toHaveBeenCalledTimes(1);
        expect(report.renderEvalResultsDocx).toHaveBeenCalledWith(evaluation);
    });

    test('each close control closes its dialog once after repeated wiring attempts', () => {
        addEvalResultsDialogEvents();
        addEvalResultsDialogEvents();
        addViewResultsDialogEvents();
        addViewResultsDialogEvents();

        elements.get('eval-view-results-dialog-close')!.dispatchEvent(new Event('click'));
        elements.get('view-results-dialog-close')!.dispatchEvent(new Event('click'));

        expect((elements.get('eval-view-results-dialog') as DialogTarget).close)
            .toHaveBeenCalledTimes(1);
        expect((elements.get('view-results-dialog') as DialogTarget).close)
            .toHaveBeenCalledTimes(1);
    });
});
