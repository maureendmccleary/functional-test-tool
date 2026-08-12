import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { clearDocumentStub, installDocumentStub, type DocumentStub } from './helpers/dom-stub.js';

/**
 * Covers the failure paths around the file pickers: an unhandled rejection
 * here means cancelling a dialog logs an error and tells the user nothing.
 */

vi.mock('../src/io/file-picker.js', () => ({
    isFilePickerSupported: vi.fn(() => true),
    loadFile: vi.fn(),
    saveEvaluation: vi.fn(),
    fileopts: {}
}));

const picker = await import('../src/io/file-picker.js');
const { loadEvalButtonClicked, saveFileButtonClick } = await import('../src/ui/evaluation-view.js');

const ELEMENT_IDS = [
    'select-test', 'eval-view-results', 'eval-save-file', 'edit-test',
    'perform-test', 'evaluation-msg', 'test-editor-msg', 'perform-msg'
];

/** An AbortError, exactly as the pickers reject on cancel. */
function cancellation(): DOMException {
    return new DOMException('The user aborted a request.', 'AbortError');
}

/** How long the save path waits before announcing. */
const SAVE_ANNOUNCE_DELAY_MS = 500;

function clickEvent(sourceId?: string): Event {
    return {
        preventDefault() { /* no-op */ },
        currentTarget: sourceId ? { id: sourceId } : null
    } as unknown as Event;
}

let documentStub: DocumentStub;

beforeEach(() => {
    documentStub = installDocumentStub(ELEMENT_IDS);
    vi.mocked(picker.isFilePickerSupported).mockReturnValue(true);
    vi.useFakeTimers();
});

afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.resetAllMocks();
    clearDocumentStub();
});

describe('loading', () => {
    test('a cancelled dialog reports nothing and leaves the buttons alone', async () => {
        vi.mocked(picker.loadFile).mockRejectedValue(cancellation());

        await expect(loadEvalButtonClicked(clickEvent())).resolves.toBeUndefined();

        vi.runAllTimers();
        expect(documentStub.getElementById('evaluation-msg')!.textContent).toBe('');
    });

    test('a file that is not JSON is reported, and nothing is loaded', async () => {
        vi.mocked(picker.loadFile).mockRejectedValue(new SyntaxError('Unexpected token'));

        await loadEvalButtonClicked(clickEvent());

        expect(documentStub.getElementById('evaluation-msg')!.textContent)
            .toBe('That file is not valid JSON. No evaluation was loaded.');
    });

    test('an unsupported browser is told so before any dialog opens', async () => {
        vi.mocked(picker.isFilePickerSupported).mockReturnValue(false);

        await loadEvalButtonClicked(clickEvent());

        expect(picker.loadFile).not.toHaveBeenCalled();
        expect(documentStub.getElementById('evaluation-msg')!.textContent)
            .toContain('Use Chrome or Edge');
    });

    test('a successful load announces how many tests arrived', async () => {
        vi.mocked(picker.loadFile).mockResolvedValue({
            evalUCs: [{ name: 'One', steps: [] }, { name: 'Two', steps: [] }]
        });

        await loadEvalButtonClicked(clickEvent());
        vi.runAllTimers();

        expect(documentStub.getElementById('evaluation-msg')!.textContent)
            .toBe('Evaluation data loaded! 2 functional tests.');
    });

    test('the count is singular for one test', async () => {
        vi.mocked(picker.loadFile).mockResolvedValue({ evalUCs: [{ name: 'Only', steps: [] }] });

        await loadEvalButtonClicked(clickEvent());
        vi.runAllTimers();

        expect(documentStub.getElementById('evaluation-msg')!.textContent)
            .toBe('Evaluation data loaded! 1 functional test.');
    });
});

describe('saving', () => {
    test('a cancelled dialog reports nothing', async () => {
        vi.mocked(picker.saveEvaluation).mockRejectedValue(cancellation());

        await expect(saveFileButtonClick(clickEvent('test-save'))).resolves.toBeUndefined();

        vi.advanceTimersByTime(SAVE_ANNOUNCE_DELAY_MS);
        expect(documentStub.getElementById('test-editor-msg')!.textContent).toBe('');
    });

    test('a write failure is reported in the right region', async () => {
        vi.mocked(picker.saveEvaluation).mockRejectedValue(new Error('disk full'));

        await saveFileButtonClick(clickEvent('perform-save'));
        vi.advanceTimersByTime(SAVE_ANNOUNCE_DELAY_MS);

        expect(documentStub.getElementById('perform-msg')!.textContent)
            .toBe('The file could not be saved.');
    });

    test('the status goes to the region belonging to the control that was used', async () => {
        vi.mocked(picker.saveEvaluation).mockResolvedValue(undefined);

        await saveFileButtonClick(clickEvent('test-save'));
        vi.advanceTimersByTime(SAVE_ANNOUNCE_DELAY_MS);

        // Read before the first await: once the picker opens, dispatch is over
        // and event.currentTarget is null.
        expect(documentStub.getElementById('test-editor-msg')!.textContent)
            .toBe('Functional Test saved successfully.');
        expect(documentStub.getElementById('evaluation-msg')!.textContent).toBe('');
    });

    test('an unrecognised control falls back to the evaluation status region', async () => {
        vi.mocked(picker.saveEvaluation).mockResolvedValue(undefined);

        await saveFileButtonClick(clickEvent('eval-save-file'));
        vi.advanceTimersByTime(SAVE_ANNOUNCE_DELAY_MS);

        expect(documentStub.getElementById('evaluation-msg')!.textContent)
            .toBe('Evaluation data saved.');
    });
});
