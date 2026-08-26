import { testDisplayName } from '../domain/functional-test.js';
import type { Evaluation } from '../types.js';
import { normalizeEvaluation } from '../domain/migration.js';
import { isFilePickerSupported, loadFile, saveEvaluation } from '../io/file-picker.js';
import {
    getEvaluation, markEvaluationChanged, markEvaluationSaved, setEvaluation
} from '../state/store.js';
import { fillListbox } from './controls.js';
import { findEl, requireEl } from './dom.js';
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

/**
 * Puts focus back on the control that opened the file dialog.
 *
 * A native picker hands focus back to the page without leaving it anywhere, so
 * the reader re-orients itself and reads the document title and whatever else
 * it finds. Unlike a load, a save has no next thing to move on to, so the
 * control that was pressed is where focus belongs. Done on cancellation too:
 * changing your mind about saving should not strand focus either.
 */
function restoreFocusAfterDialog(sourceId: string | undefined): void {
    const control = sourceId ? findEl(sourceId) : null;
    if (control) {
        control.focus();
    }
}

/**
 * Reports a message once the file dialog has released focus, with focus put
 * back first so the message is not read out behind the reader re-orienting.
 *
 * @param clearAfterMs 0 leaves it on screen, which is what a load wants: it
 *                     says which evaluation is open, and that stays true
 */
function reportAfterDialog(
    elementId: string, message: string, delayMs: number,
    options: { focusId?: string; clearAfterMs?: number } = {}
): void {
    setTimeout(() => {
        restoreFocusAfterDialog(options.focusId);
        showStatusMessage(elementId, message, options.clearAfterMs);
    }, delayMs);
}

/**
 * The evaluation fields edited on the evaluation screen, by element id.
 *
 * The name matches the property on `Evaluation`, so one handler serves all
 * three, the way the test editor's blur handler serves its form.
 */
const EVALUATION_DETAIL_FIELDS = {
    'eval-workspace': 'workspace',
    'eval-asset': 'asset',
    'eval-name': 'name'
} as const;

/**
 * The same three, shown as text on the landing screen.
 *
 * The tester needs to see which evaluation is open without going to the screen
 * where it is edited, so they are read-only there.
 */
const LANDING_DETAIL_FIELDS = {
    'landing-workspace': 'workspace',
    'landing-asset': 'asset',
    'landing-name': 'name'
} as const;

/** Shown in place of a detail the evaluation has not been given. */
const DETAIL_UNSET = 'Not set';

/** Writes an edited evaluation detail back to the loaded evaluation. */
function evaluationDetailChanged(e: Event): void {
    const field = e.target as HTMLInputElement;
    const property = EVALUATION_DETAIL_FIELDS[field.id as keyof typeof EVALUATION_DETAIL_FIELDS];
    getEvaluation()[property] = field.value;
    markEvaluationChanged();
}

/** Wires the evaluation detail inputs. Called once at startup. */
export function addEvaluationDetailEvents(): void {
    for (const elementId of Object.keys(EVALUATION_DETAIL_FIELDS)) {
        requireEl(elementId).addEventListener('blur', evaluationDetailChanged);
    }
}

/**
 * Shows the loaded evaluation's workspace, asset and name wherever they appear:
 * the fields that edit them, and the landing screen's read-only copy.
 *
 * Called on every route that changes them or arrives at a screen showing them,
 * because nothing redraws on its own.
 */
export function populateEvaluationDetails(): void {
    const evaluation = getEvaluation();
    for (const [elementId, property] of Object.entries(EVALUATION_DETAIL_FIELDS)) {
        requireEl<HTMLInputElement>(elementId).value = evaluation[property] || '';
    }
    for (const [elementId, property] of Object.entries(LANDING_DETAIL_FIELDS)) {
        const value = (evaluation[property] || '').trim();
        requireEl(elementId).textContent = value === '' ? DETAIL_UNSET : value;
    }
}

/**
 * How a load is announced: the evaluation by name, and how much of it arrived.
 *
 * Naming it is the confirmation that the right file opened, which a count on
 * its own does not give.
 */
export function loadedMessage(evaluation: Evaluation): string {
    const count = evaluation.tests.length;
    const tests = count === 1 ? '1 functional test' : `${count} functional tests`;
    const name = (evaluation.name || '').trim();
    const subject = name === '' ? 'Evaluation' : name;
    return `${subject} loaded successfully. ${tests}.`;
}

/** Every list of functional tests. Both are refilled together so they agree. */
const TEST_LIST_IDS = ['select-test', 'eval-select-test'];

/** Controls that need a functional test to act on. */
const TEST_CONTROL_IDS = ['edit-test', 'perform-test', 'eval-edit-test', 'eval-delete-test'];

/** Controls that need an evaluation, whether loaded from a file or newly started. */
const EVALUATION_CONTROL_IDS = ['eval-edit', 'eval-view-results', 'eval-save-file'];

/**
 * Refills every list of functional tests from the loaded evaluation.
 *
 * Called wherever the list can change -- loading, saving a script, deleting one
 * -- because nothing redraws on its own. Option values stay the index into
 * `evaluation.tests`, which is what the Edit, Perform and Delete buttons read
 * back.
 */
export function refreshTestList(): void {
    const names = getEvaluation().tests.map(testDisplayName);
    TEST_LIST_IDS.forEach((elementId) => fillListbox(names, elementId));
    TEST_CONTROL_IDS.forEach((elementId) => {
        requireEl<HTMLButtonElement>(elementId).disabled = names.length === 0;
    });
}

/** Unlocks the controls that need an evaluation to work on. */
export function enableEvaluationControls(): void {
    EVALUATION_CONTROL_IDS.forEach((elementId) => requireEl(elementId).removeAttribute('disabled'));
}

/**
 * Puts focus on the list of functional tests once a file has loaded.
 *
 * A native file dialog hands focus back to the page without leaving it
 * anywhere, so a screen reader re-orients itself: it reads the document title
 * and then walks whatever it finds, and the load message arrives behind all of
 * that. Landing on the list says the evaluation is open and what is in it,
 * which is the useful thing, and it is where the tester goes next. An
 * evaluation with no tests has nothing to list, so the heading takes it.
 */
function focusAfterLoad(hasTests: boolean): void {
    requireEl(hasTests ? 'select-test' : 'landing-heading').focus();
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
    enableEvaluationControls();

    requireEl('evaluation-msg').textContent = '';
    const summary = loadedMessage(evaluation);
    setTimeout(() => {
        focusAfterLoad(evaluation.tests.length > 0);
        showStatusMessage('evaluation-msg', summary, 0);
    }, LOAD_ANNOUNCE_DELAY_MS);
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
            restoreFocusAfterDialog(sourceId);
            return;
        }
        reportAfterDialog(status.elementId, 'The file could not be saved.',
            SAVE_ANNOUNCE_DELAY_MS, { focusId: sourceId });
        return;
    }

    markEvaluationSaved();
    reportAfterDialog(status.elementId, status.message,
        SAVE_ANNOUNCE_DELAY_MS, { focusId: sourceId });
}
