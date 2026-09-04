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
    forgetSavedFile: vi.fn(),
    hasSavedFile: vi.fn(() => false),
    fileopts: {}
}));

const picker = await import('../src/io/file-picker.js');
const {
    confirmDiscardingEvaluation, loadEvalButtonClicked, saveFileButtonClick
} = await import('../src/ui/evaluation-view.js');
const { getEvaluation, markEvaluationChanged, markEvaluationSaved, setEvaluation }
    = await import('../src/state/store.js');

const ELEMENT_IDS = [
    'select-test', 'eval-select-test', 'eval-edit', 'eval-view-results', 'eval-save-file',
    'edit-test', 'perform-test', 'eval-edit-test', 'eval-delete-test', 'evaluation-msg',
    'test-editor-msg', 'perform-msg', 'perform-save', 'perform-back',
    'eval-workspace', 'eval-asset', 'eval-name',
    'landing-workspace', 'landing-asset', 'landing-name', 'app-status', 'landing-heading', 'eval-save-file'
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

/** Answers window.confirm with `accepted` and counts the asking. */
function stubConfirm(accepted: boolean): { calls: string[] } {
    const calls: string[] = [];
    (globalThis as unknown as { window: unknown }).window = {
        confirm(message: string) {
            calls.push(message);
            return accepted;
        }
    };
    return { calls };
}

describe('confirmDiscardingEvaluation', () => {
    test('does not ask when there is nothing unsaved', () => {
        markEvaluationSaved();
        const confirmed = stubConfirm(false);

        expect(confirmDiscardingEvaluation('Start a new one anyway?')).toBe(true);
        expect(confirmed.calls).toEqual([]);
    });

    test('asks in the same words whatever the action, and reports the answer', () => {
        markEvaluationChanged();
        const declined = stubConfirm(false);
        expect(confirmDiscardingEvaluation('Load another one anyway?')).toBe(false);
        expect(declined.calls).toEqual([
            'The evaluation has changes that have not been saved to a file. '
            + 'Load another one anyway?'
        ]);

        const accepted = stubConfirm(true);
        expect(confirmDiscardingEvaluation('Start a new one anyway?')).toBe(true);
        expect(accepted.calls[0]).toContain('have not been saved to a file.');
    });
});

describe('loading over unsaved work', () => {
    test('asks first, and loads nothing when the tester declines', async () => {
        setEvaluation({ tests: [], score: 0, name: 'in progress' });
        markEvaluationChanged();
        stubConfirm(false);

        await loadEvalButtonClicked(clickEvent());

        // The picker never opens: the answer decides whether it should.
        expect(picker.loadFile).not.toHaveBeenCalled();
        expect(getEvaluation().name).toBe('in progress');
    });

    test('goes ahead once the tester accepts', async () => {
        setEvaluation({ tests: [], score: 0, name: 'in progress' });
        markEvaluationChanged();
        stubConfirm(true);
        vi.mocked(picker.loadFile).mockResolvedValue({ name: 'loaded', evalUCs: [] });

        await loadEvalButtonClicked(clickEvent());
        vi.runAllTimers();

        expect(getEvaluation().name).toBe('loaded');
    });

    test('does not ask at all when nothing is unsaved', async () => {
        setEvaluation({ tests: [], score: 0, name: 'saved already' });
        const confirmed = stubConfirm(false);
        vi.mocked(picker.loadFile).mockResolvedValue({ name: 'loaded', evalUCs: [] });

        await loadEvalButtonClicked(clickEvent());
        vi.runAllTimers();

        expect(confirmed.calls).toEqual([]);
        expect(getEvaluation().name).toBe('loaded');
    });
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

    test('an unsupported JSON shape is reported without replacing the current evaluation', async () => {
        setEvaluation({ tests: [], score: 0, name: 'still loaded' });
        vi.mocked(picker.loadFile).mockResolvedValue([]);

        await loadEvalButtonClicked(clickEvent());

        expect(documentStub.getElementById('evaluation-msg')!.textContent)
            .toBe('That file is not a supported evaluation: The top level must be an object. '
                + 'No evaluation was loaded.');
        expect(getEvaluation().name).toBe('still loaded');
    });

    test('a malformed issue is reported before results can crash', async () => {
        setEvaluation({ tests: [], score: 0, name: 'still loaded' });
        vi.mocked(picker.loadFile).mockResolvedValue({
            tests: [{
                name: 'bad issue', ats: ['NVDA'], steps: [],
                runs: [{
                    assistiveTechnology: 'NVDA', score: 2,
                    steps: [{ issues: [null] }], extensions: []
                }]
            }]
        });

        await loadEvalButtonClicked(clickEvent());

        expect(documentStub.getElementById('evaluation-msg')!.textContent)
            .toContain('issues[0] must be an object');
        expect(documentStub.getElementById('evaluation-msg')!.textContent)
            .toContain('No evaluation was loaded.');
        expect(getEvaluation().name).toBe('still loaded');
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
        vi.advanceTimersByTime(500);

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

        await expect(saveFileButtonClick(clickEvent('eval-save-file'))).resolves.toBeUndefined();

        vi.advanceTimersByTime(SAVE_ANNOUNCE_DELAY_MS);
        expect(documentStub.getElementById('evaluation-msg')!.textContent).toBe('');
    });

    test('a write failure is reported on the landing screen', async () => {
        vi.mocked(picker.saveEvaluation).mockRejectedValue(new Error('disk full'));

        await saveFileButtonClick(clickEvent('eval-save-file'));
        vi.advanceTimersByTime(SAVE_ANNOUNCE_DELAY_MS);

        expect(documentStub.getElementById('evaluation-msg')!.textContent)
            .toBe('The file could not be saved.');
    });

    test('the durable file action reports success on the landing screen', async () => {
        vi.mocked(picker.saveEvaluation).mockResolvedValue(undefined);

        await saveFileButtonClick(clickEvent('eval-save-file'));
        vi.advanceTimersByTime(SAVE_ANNOUNCE_DELAY_MS);

        // Read before the first await: once the picker opens, dispatch is over
        // and event.currentTarget is null.
        expect(documentStub.getElementById('evaluation-msg')!.textContent)
            .toBe('Evaluation data saved.');
    });

    test('saving returns focus to the Download Evaluation File button', async () => {
        vi.mocked(picker.saveEvaluation).mockResolvedValue(undefined);

        await saveFileButtonClick(clickEvent('eval-save-file'));
        vi.advanceTimersByTime(SAVE_ANNOUNCE_DELAY_MS);

        expect(documentStub.getElementById('eval-save-file')!.focused).toBe(true);
    });

    test('cancelling also puts focus back rather than stranding it', async () => {
        vi.mocked(picker.saveEvaluation).mockRejectedValue(cancellation());

        await saveFileButtonClick(clickEvent('eval-save-file'));

        expect(documentStub.getElementById('eval-save-file')!.focused).toBe(true);
    });

    test('a save with a file already chosen announces at once, with no delay', async () => {
        // Nothing opened, so nothing stole focus and there is nothing to wait for.
        vi.mocked(picker.hasSavedFile).mockReturnValue(true);
        vi.mocked(picker.saveEvaluation).mockResolvedValue(undefined);

        await saveFileButtonClick(clickEvent('eval-save-file'));

        expect(documentStub.getElementById('evaluation-msg')!.textContent)
            .toBe('Evaluation data saved.');
    });

    test('loading forgets where the last evaluation was saved', async () => {
        // Otherwise saving the newly loaded one would write it over the file
        // the previous evaluation came from, without asking.
        vi.mocked(picker.loadFile).mockResolvedValue({ evalUCs: [] });

        await loadEvalButtonClicked(clickEvent());

        expect(picker.forgetSavedFile).toHaveBeenCalled();
    });

    test('the evaluation control uses the evaluation status region', async () => {
        vi.mocked(picker.saveEvaluation).mockResolvedValue(undefined);

        await saveFileButtonClick(clickEvent('eval-save-file'));
        vi.advanceTimersByTime(SAVE_ANNOUNCE_DELAY_MS);

        expect(documentStub.getElementById('evaluation-msg')!.textContent)
            .toBe('Evaluation data saved.');
    });

    test('the Perform download reports success in the Perform status region', async () => {
        vi.mocked(picker.saveEvaluation).mockResolvedValue(undefined);

        await saveFileButtonClick(clickEvent('perform-save'));
        vi.advanceTimersByTime(SAVE_ANNOUNCE_DELAY_MS);

        expect(documentStub.getElementById('perform-msg')!.textContent)
            .toBe('Functional Test data saved!');
        expect(documentStub.getElementById('evaluation-msg')!.textContent).toBe('');
    });

    test('the Perform download returns focus to Back', async () => {
        vi.mocked(picker.saveEvaluation).mockResolvedValue(undefined);

        await saveFileButtonClick(clickEvent('perform-save'));
        vi.advanceTimersByTime(SAVE_ANNOUNCE_DELAY_MS);

        expect(documentStub.getElementById('perform-back')!.focused).toBe(true);
        expect(documentStub.getElementById('perform-save')!.focused).toBe(false);
    });
});
