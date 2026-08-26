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
    'select-test', 'eval-select-test', 'eval-edit', 'eval-view-results', 'eval-save-file',
    'edit-test', 'perform-test', 'eval-edit-test', 'eval-delete-test', 'evaluation-msg',
    'test-editor-msg',
    'perform-msg', 'eval-workspace', 'eval-asset', 'eval-name',
    'landing-workspace', 'landing-asset', 'landing-name', 'app-status', 'landing-heading', 'eval-save-file', 'perform-save'
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
            .toBe('Evaluation loaded successfully. 2 functional tests.');
    });

    test('the count is singular for one test', async () => {
        vi.mocked(picker.loadFile).mockResolvedValue({ evalUCs: [{ name: 'Only', steps: [] }] });

        await loadEvalButtonClicked(clickEvent());
        vi.runAllTimers();

        expect(documentStub.getElementById('evaluation-msg')!.textContent)
            .toBe('Evaluation loaded successfully. 1 functional test.');
    });

    test('focus lands on the list of functional tests', async () => {
        // A file dialog hands focus back without leaving it anywhere, so the
        // reader re-orients and the message arrives behind the noise.
        vi.mocked(picker.loadFile).mockResolvedValue({
            evalUCs: [{ name: 'One', steps: [] }]
        });

        await loadEvalButtonClicked(clickEvent());
        vi.runAllTimers();

        expect(documentStub.getElementById('select-test')!.focused).toBe(true);
    });

    test('an evaluation with no tests puts focus on the heading instead', async () => {
        vi.mocked(picker.loadFile).mockResolvedValue({ evalUCs: [] });

        await loadEvalButtonClicked(clickEvent());
        vi.runAllTimers();

        expect(documentStub.getElementById('landing-heading')!.focused).toBe(true);
    });

    test('the announcement reaches the live region, not just the paragraph', async () => {
        // The paragraph lives inside a screen that gets hidden, so it cannot be
        // what announces. app-status is never hidden.
        vi.mocked(picker.loadFile).mockResolvedValue({
            name: 'Q3 2026 Accessibility Evaluation',
            evalUCs: [{ name: 'One', steps: [] }]
        });

        await loadEvalButtonClicked(clickEvent());
        vi.runAllTimers();

        expect(documentStub.getElementById('app-status')!.textContent)
            .toBe('Q3 2026 Accessibility Evaluation loaded successfully. 1 functional test.');
    });

    test('fills in the workspace, asset and evaluation name', async () => {
        vi.mocked(picker.loadFile).mockResolvedValue({
            workspace: 'Riverbend Public Library',
            asset: 'Library Catalogue',
            name: 'Q3 2026 Accessibility Evaluation',
            evalUCs: [{ name: 'One', steps: [] }]
        });

        await loadEvalButtonClicked(clickEvent());

        expect(documentStub.getElementById('eval-workspace')!.value)
            .toBe('Riverbend Public Library');
        expect(documentStub.getElementById('eval-asset')!.value).toBe('Library Catalogue');
        expect(documentStub.getElementById('eval-name')!.value)
            .toBe('Q3 2026 Accessibility Evaluation');
    });

    test('names the evaluation in the announcement', async () => {
        vi.mocked(picker.loadFile).mockResolvedValue({
            name: 'Q3 2026 Accessibility Evaluation',
            evalUCs: [{ name: 'One', steps: [] }, { name: 'Two', steps: [] }]
        });

        await loadEvalButtonClicked(clickEvent());
        vi.runAllTimers();

        expect(documentStub.getElementById('evaluation-msg')!.textContent)
            .toBe('Q3 2026 Accessibility Evaluation loaded successfully. 2 functional tests.');
    });

    test('shows the details on the landing screen as text', async () => {
        vi.mocked(picker.loadFile).mockResolvedValue({
            workspace: 'Riverbend Public Library',
            asset: 'Library Catalogue',
            name: 'Q3 2026 Accessibility Evaluation',
            evalUCs: [{ name: 'One', steps: [] }]
        });

        await loadEvalButtonClicked(clickEvent());

        expect(documentStub.getElementById('landing-workspace')!.textContent)
            .toBe('Riverbend Public Library');
        expect(documentStub.getElementById('landing-asset')!.textContent)
            .toBe('Library Catalogue');
        expect(documentStub.getElementById('landing-name')!.textContent)
            .toBe('Q3 2026 Accessibility Evaluation');
    });

    test('reads "Not set" for a detail the file does not carry', async () => {
        vi.mocked(picker.loadFile).mockResolvedValue({ evalUCs: [{ name: 'One', steps: [] }] });

        await loadEvalButtonClicked(clickEvent());

        expect(documentStub.getElementById('landing-workspace')!.textContent).toBe('Not set');
    });

    test('clears the details left by a previous evaluation', async () => {
        // A file with no cover identity must not inherit the last one's.
        documentStub.getElementById('eval-workspace')!.value = 'Stale Workspace';
        vi.mocked(picker.loadFile).mockResolvedValue({ evalUCs: [{ name: 'One', steps: [] }] });

        await loadEvalButtonClicked(clickEvent());

        expect(documentStub.getElementById('eval-workspace')!.value).toBe('');
    });
});

describe('saving', () => {
    test('a cancelled dialog reports nothing', async () => {
        vi.mocked(picker.saveEvaluation).mockRejectedValue(cancellation());

        await expect(saveFileButtonClick(clickEvent('perform-save'))).resolves.toBeUndefined();

        vi.advanceTimersByTime(SAVE_ANNOUNCE_DELAY_MS);
        expect(documentStub.getElementById('perform-msg')!.textContent).toBe('');
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

        await saveFileButtonClick(clickEvent('perform-save'));
        vi.advanceTimersByTime(SAVE_ANNOUNCE_DELAY_MS);

        // Read before the first await: once the picker opens, dispatch is over
        // and event.currentTarget is null.
        expect(documentStub.getElementById('perform-msg')!.textContent)
            .toBe('Functional Test data saved!');
        expect(documentStub.getElementById('evaluation-msg')!.textContent).toBe('');
    });

    test('focus goes back to the control that opened the picker', async () => {
        vi.mocked(picker.saveEvaluation).mockResolvedValue(undefined);

        await saveFileButtonClick(clickEvent('perform-save'));
        vi.advanceTimersByTime(SAVE_ANNOUNCE_DELAY_MS);

        expect(documentStub.getElementById('perform-save')!.focused).toBe(true);
    });

    test('cancelling also puts focus back rather than stranding it', async () => {
        vi.mocked(picker.saveEvaluation).mockRejectedValue(cancellation());

        await saveFileButtonClick(clickEvent('eval-save-file'));

        expect(documentStub.getElementById('eval-save-file')!.focused).toBe(true);
    });

    test('an unrecognised control falls back to the evaluation status region', async () => {
        vi.mocked(picker.saveEvaluation).mockResolvedValue(undefined);

        await saveFileButtonClick(clickEvent('eval-save-file'));
        vi.advanceTimersByTime(SAVE_ANNOUNCE_DELAY_MS);

        expect(documentStub.getElementById('evaluation-msg')!.textContent)
            .toBe('Evaluation data saved.');
    });
});
