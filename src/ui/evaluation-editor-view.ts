import { normalizeEvaluation } from '../domain/migration.js';
import { forgetSavedFile } from '../io/file-picker.js';
import { testDisplayName } from '../domain/functional-test.js';
import {
    commitPageEditSession, getEvaluation, setEvaluation
} from '../state/store.js';
import { requireEl } from './dom.js';
import { editTest, newTestButtonClicked } from './editor-view.js';
import {
    confirmDiscardingEvaluation, enableEvaluationControls, populateEvaluationDetails,
    openEvaluationEditor, refreshTestList
} from './evaluation-view.js';
import {
    CHANGES_SAVED_MESSAGE, type PageSaveResult, pageDraftChanged, pageSaveIsDisabled,
    requestPageExit, updatePageSaveState
} from './page-edit.js';
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

/** Starts an empty evaluation and opens the evaluation screen on it. */
export function newEvaluationButtonClicked(e: Event): void {
    e.preventDefault();
    if (!confirmDiscardingEvaluation('Start a new one anyway?')) {
        return;
    }

    forgetSavedFile();
    setEvaluation(normalizeEvaluation({}));
    enableEvaluationControls();
    openEvaluationEditor();
    showStatusMessage('evaluation-editor-msg', 'Started a new evaluation.');
}

/** Opens the evaluation screen on the evaluation already loaded. */
export function editEvaluationButtonClicked(e: Event): void {
    e.preventDefault();
    openEvaluationEditor();
}

/** Opens the functional test editor on a new script. */
export function addTestButtonClicked(e: Event): void {
    requestPageExit(e, {
        save: saveEvaluationChanges,
        continueNavigation: () => newTestButtonClicked('evaluation'),
        successStatusId: 'test-editor-msg'
    });
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
    const select = requireEl<HTMLSelectElement>('eval-select-test');
    const selectedName = testDisplayName(getEvaluation().tests[Number(select.value)]);
    requestPageExit(e, {
        save: saveEvaluationChanges,
        continueNavigation: () => {
            refreshTestList();
            const restoredIndex = getEvaluation().tests.findIndex(
                (test) => testDisplayName(test) === selectedName
            );
            requireEl<HTMLSelectElement>('eval-select-test').value = String(
                Math.max(0, restoredIndex)
            );
            editTest('eval-select-test', 'evaluation');
        },
        successStatusId: 'test-editor-msg'
    });
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
    pageDraftChanged('eval-editor-save', 'evaluation-editor-msg');
    refreshTestList();

    // Land on the script that took its place, or the last one when it was the
    // end of the list, so a run of deletions does not need reselecting.
    const select = requireEl<HTMLSelectElement>('eval-select-test');
    select.selectedIndex = Math.min(index, tests.length - 1);
    showStatusMessage('evaluation-editor-msg', `${name} was deleted.`);
}

/** Commits every Evaluation-page change while keeping the editor open. */
export function saveEvaluationChanges(): PageSaveResult {
    if (!commitPageEditSession()) {
        return { saved: false };
    }

    refreshTestList();
    populateEvaluationDetails();
    updatePageSaveState('eval-editor-save');
    return { saved: true, message: CHANGES_SAVED_MESSAGE };
}

/** Saves Evaluation-page changes without treating Save as navigation. */
export function saveEvaluationButtonClicked(e: Event): void {
    e.preventDefault();
    if (pageSaveIsDisabled('eval-editor-save')) {
        return;
    }

    const result = saveEvaluationChanges();
    if (result.saved) {
        showStatusMessage('evaluation-editor-msg', result.message || CHANGES_SAVED_MESSAGE, 0);
    }
}

/** Leaves the Evaluation editor, guarding only its uncommitted page draft. */
export function backEvaluationButtonClicked(e: Event): void {
    requestPageExit(e, {
        save: saveEvaluationChanges,
        continueNavigation: () => {
            refreshTestList();
            populateEvaluationDetails();
            showScreen('landing');
        },
        successStatusId: 'evaluation-msg'
    });
}
