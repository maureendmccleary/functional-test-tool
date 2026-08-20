import { normalizeEvaluation } from '../domain/migration.js';
import { testDisplayName } from '../domain/functional-test.js';
import {
    getEvaluation, hasUnsavedChanges, markEvaluationChanged, setEvaluation
} from '../state/store.js';
import { requireEl } from './dom.js';
import { editTest, newTestButtonClicked } from './editor-view.js';
import {
    enableEvaluationControls, populateEvaluationDetails, refreshTestList
} from './evaluation-view.js';
import { showScreen } from './screens.js';
import { showStatusMessage } from './status.js';

/**
 * The evaluation screen: the evaluation's own details, and the list of
 * functional tests it holds.
 *
 * This is where an evaluation is put together. Scripts are added from here and
 * deleted from here; the landing screen is left with what a tester needs, which
 * is choosing a functional test and performing it.
 */

const DISCARD_WARNING =
    'The evaluation has changes that have not been saved to a file. Start a new one anyway?';

/** Starts an empty evaluation and opens the evaluation screen on it. */
export function newEvaluationButtonClicked(e: Event): void {
    e.preventDefault();
    if (hasUnsavedChanges() && !window.confirm(DISCARD_WARNING)) {
        return;
    }

    setEvaluation(normalizeEvaluation({}));
    populateEvaluationDetails();
    refreshTestList();
    enableEvaluationControls();
    showScreen('evaluation');
    showStatusMessage('evaluation-editor-msg', 'Started a new evaluation.');
}

/** Opens the evaluation screen on the evaluation already loaded. */
export function editEvaluationButtonClicked(e: Event): void {
    e.preventDefault();
    populateEvaluationDetails();
    refreshTestList();
    showScreen('evaluation');
}

/** Opens the functional test editor on a new script. */
export function addTestButtonClicked(e: Event): void {
    e.preventDefault();
    newTestButtonClicked('evaluation');
}

/**
 * Opens the functional test editor on the selected script.
 *
 * The copies made for each assistive technology start identical, and often
 * should not stay that way: the steps for driving a screen reader through a
 * task read differently from the steps for driving speech recognition through
 * it. This is where a copy is given instructions of its own.
 */
export function editSelectedTestButtonClicked(e: Event): void {
    e.preventDefault();
    editTest('eval-select-test', 'evaluation');
}

/**
 * Deletes the selected script, asking first.
 *
 * One copy, not every copy of the script: the copies are separate functional
 * tests once written, each with its own recorded results, and deleting the one
 * performed with JAWS must not take the NVDA results with it.
 */
export function deleteTestButtonClicked(e: Event): void {
    e.preventDefault();
    const tests = getEvaluation().tests;
    const index = Number(requireEl<HTMLSelectElement>('eval-select-test').value);
    const test = tests[index];
    if (!test) {
        return;
    }

    const name = testDisplayName(test);
    if (!window.confirm(`Delete ${name}? Everything recorded against it will be lost.`)) {
        return;
    }

    tests.splice(index, 1);
    markEvaluationChanged();
    refreshTestList();

    // Land on the script that took its place, or the last one when it was the
    // end of the list, so a run of deletions does not need reselecting.
    const select = requireEl<HTMLSelectElement>('eval-select-test');
    select.selectedIndex = Math.min(index, tests.length - 1);
    showStatusMessage('evaluation-editor-msg', `${name} was deleted.`);
}

/** Finishes with the evaluation screen and hands the tester the landing screen. */
export function saveEvaluationButtonClicked(e: Event): void {
    e.preventDefault();
    refreshTestList();
    showScreen('landing');
    showStatusMessage('evaluation-msg', 'Evaluation ready to perform.');
}

/**
 * Leaves the evaluation screen without declaring it finished.
 *
 * Nothing is held back until Save -- the evaluation is changed in place as it
 * is edited -- so this differs from Save only in not announcing that the
 * evaluation is ready to perform. It exists because leaving a screen should
 * never require claiming to be done with it.
 */
export function backEvaluationButtonClicked(e: Event): void {
    e.preventDefault();
    refreshTestList();
    showScreen('landing');
}
