import { testDisplayName } from '../domain/functional-test.js';
import { normalizeEvaluation } from '../domain/migration.js';
import { isFilePickerSupported, loadFile, saveEvaluation } from '../io/file-picker.js';
import { getEvaluation, setEvaluation } from '../state/store.js';
import { fillListbox } from './controls.js';
import { requireEl } from './dom.js';
import { showStatusMessage } from './status.js';

/**
 * The native file dialogs steal focus while open. When one closes, focus
 * returns to the page but screen readers need a moment to settle before they
 * will announce an aria-live update; announcing immediately gets missed.
 */
const LOAD_ANNOUNCE_DELAY_MS = 100;
const SAVE_ANNOUNCE_DELAY_MS = 500;

/**
 * Status region for each control that can trigger a file save.
 *
 * The functional test editor's Save is not one of them: it completes the script
 * and its copies in memory, and the file is written from the evaluation screen.
 */
const SAVE_STATUS_TARGETS: Record<string, { elementId: string; message: string }> = {
    'perform-save': { elementId: 'perform-msg', message: 'Functional Test data saved!' }
};
const DEFAULT_SAVE_STATUS = { elementId: 'evaluation-msg', message: 'Evaluation data saved.' };

const UNSUPPORTED_BROWSER_MESSAGE =
    'This browser cannot open or save files. Use Chrome or Edge.';

/**
 * True when the user dismissed a file dialog rather than something failing.
 *
 * Both pickers reject with an AbortError on cancel, which is a normal outcome
 * and must not be reported as an error.
 */
function isCancellation(error: unknown): boolean {
    return error instanceof DOMException && error.name === 'AbortError';
}

/** Announces a message after the file dialog has released focus. */
function announce(elementId: string, message: string, delayMs: number): void {
    setTimeout(() => showStatusMessage(elementId, message), delayMs);
}

/**
 * The evaluation fields shown on the main screen, by element id.
 *
 * The name matches the property on `Evaluation`, so one handler serves all
 * three, the way the test editor's blur handler serves its form.
 */
const EVALUATION_DETAIL_FIELDS = {
    'eval-workspace': 'workspace',
    'eval-asset': 'asset',
    'eval-name': 'name'
} as const;

/** Writes an edited evaluation detail back to the loaded evaluation. */
function evaluationDetailChanged(e: Event): void {
    const field = e.target as HTMLInputElement;
    const property = EVALUATION_DETAIL_FIELDS[field.id as keyof typeof EVALUATION_DETAIL_FIELDS];
    getEvaluation()[property] = field.value;
}

/** Wires the evaluation detail inputs. Called once at startup. */
export function addEvaluationDetailEvents(): void {
    for (const elementId of Object.keys(EVALUATION_DETAIL_FIELDS)) {
        requireEl(elementId).addEventListener('blur', evaluationDetailChanged);
    }
}

/** Shows the loaded evaluation's workspace, asset and name. */
function populateEvaluationDetails(): void {
    for (const [elementId, property] of Object.entries(EVALUATION_DETAIL_FIELDS)) {
        requireEl<HTMLInputElement>(elementId).value = getEvaluation()[property] || '';
    }
}

/**
 * Refills the list of functional tests from the loaded evaluation.
 *
 * Called wherever the list can change -- loading, saving a script, deleting one
 * -- because nothing redraws on its own. Option values stay the index into
 * `evaluation.tests`, which is what the Edit and Perform buttons read back.
 */
export function refreshTestList(): void {
    fillListbox(getEvaluation().tests.map(testDisplayName), 'select-test');
}

/**
 * Prompts for an evaluation file, loads it, and enables the controls it
 * unlocks. Cancelling the dialog leaves the loaded evaluation untouched.
 */
export async function loadEvalButtonClicked(e: Event): Promise<void> {
    e.preventDefault();
    if (!isFilePickerSupported()) {
        showStatusMessage('evaluation-msg', UNSUPPORTED_BROWSER_MESSAGE, 0);
        return;
    }

    let evaluation;
    try {
        evaluation = normalizeEvaluation(await loadFile());
    } catch (error) {
        if (isCancellation(error)) {
            return;
        }
        const detail = error instanceof SyntaxError
            ? 'That file is not valid JSON.'
            : 'That file could not be read.';
        showStatusMessage('evaluation-msg', `${detail} No evaluation was loaded.`, 0);
        return;
    }

    setEvaluation(evaluation);
    refreshTestList();
    populateEvaluationDetails();

    requireEl('eval-view-results').removeAttribute('disabled');
    requireEl('eval-save-file').removeAttribute('disabled');
    requireEl('edit-test').removeAttribute('disabled');
    requireEl('perform-test').removeAttribute('disabled');

    const evalMsg = requireEl('evaluation-msg');
    evalMsg.textContent = '';
    const summary = evaluation.tests.length === 1
        ? 'Evaluation data loaded! 1 functional test.'
        : `Evaluation data loaded! ${evaluation.tests.length} functional tests.`;
    setTimeout(() => { evalMsg.textContent = summary; }, LOAD_ANNOUNCE_DELAY_MS);
}

/**
 * Writes the evaluation to a file, then announces success in the region
 * belonging to whichever control was used.
 *
 * The control is read before the first `await`: once the picker opens, dispatch
 * has finished and `event.currentTarget` is null.
 */
export async function saveFileButtonClick(e: Event): Promise<void> {
    e.preventDefault();
    const sourceId = (e.currentTarget as HTMLElement | null)?.id;
    const status = (sourceId && SAVE_STATUS_TARGETS[sourceId]) || DEFAULT_SAVE_STATUS;

    if (!isFilePickerSupported()) {
        showStatusMessage(status.elementId, UNSUPPORTED_BROWSER_MESSAGE, 0);
        return;
    }

    try {
        await saveEvaluation(getEvaluation());
    } catch (error) {
        if (isCancellation(error)) {
            return;
        }
        announce(status.elementId, 'The file could not be saved.', SAVE_ANNOUNCE_DELAY_MS);
        return;
    }

    announce(status.elementId, status.message, SAVE_ANNOUNCE_DELAY_MS);
}
