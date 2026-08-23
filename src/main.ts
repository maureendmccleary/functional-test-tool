import { defaults } from './config/defaults.js';
import { fillCheckboxMenu } from './ui/controls.js';
import { requireEl } from './ui/dom.js';
import {
    addFormEvents, backButtonClicked, editTestButtonClicked, newExtensionButtonClicked,
    newStepButtonClick, saveTestButtonClicked
} from './ui/editor-view.js';
import { evalViewResultsButtonClicked } from './ui/eval-results-view.js';
import {
    addTestButtonClicked, backEvaluationButtonClicked, deleteTestButtonClicked,
    editEvaluationButtonClicked, editSelectedTestButtonClicked, newEvaluationButtonClicked,
    saveEvaluationButtonClicked
} from './ui/evaluation-editor-view.js';
import {
    addEvaluationDetailEvents, loadEvalButtonClicked, saveFileButtonClick
} from './ui/evaluation-view.js';
import { confirmDiscardUnsavedIssueEntry, onAddIssueDialogClosed } from './ui/issue-dialog.js';
import { populateEvaluationDetails, refreshTestList } from './ui/evaluation-view.js';
import { performButtonClick } from './ui/perform-view.js';

/** Wires the controls that exist in index.html from the start. */
function initialize(): void {
    requireEl("eval-file-load").addEventListener("click", loadEvalButtonClicked);
    requireEl("eval-new").addEventListener("click", newEvaluationButtonClicked);
    requireEl("eval-edit").addEventListener("click", editEvaluationButtonClicked);
    requireEl("eval-view-results").addEventListener("click", evalViewResultsButtonClicked);
    requireEl("eval-save-file").addEventListener("click", saveFileButtonClick);
    requireEl("edit-test").addEventListener("click", editTestButtonClicked);

    requireEl("eval-add-test").addEventListener("click", addTestButtonClicked);
    requireEl("eval-edit-test").addEventListener("click", editSelectedTestButtonClicked);
    requireEl("eval-delete-test").addEventListener("click", deleteTestButtonClicked);
    requireEl("eval-editor-save").addEventListener("click", saveEvaluationButtonClicked);
    requireEl("evaluation-editor-back").addEventListener("click", backEvaluationButtonClicked);

    fillCheckboxMenu(defaults["at-types"], "test-edit-at-menu", "assistiveTechnologies");
    addFormEvents();
    addEvaluationDetailEvents();
    refreshTestList();
    populateEvaluationDetails();

    const testSave = requireEl("test-save");
    testSave.addEventListener('click', saveTestButtonClicked);
    testSave.removeAttribute("disabled");
    requireEl("test-editor-back").addEventListener('click', backButtonClicked);

    requireEl("perform-test").addEventListener('click', performButtonClick);
    requireEl("new-step-btn").addEventListener('click', newStepButtonClick);
    requireEl("new-extension-btn").addEventListener('click', newExtensionButtonClicked);

    // No form here is ever meant to submit: every control has a click handler
    // and the data lives in the store. A submit reloads the page and silently
    // drops the whole evaluation, so this is a backstop, not a nicety.
    //
    // Two ways in. Buttons that omit `type` default to type="submit", and most
    // of their handlers open with preventDefault -- but `toggleMenu` (the AT
    // menu button) and `deleteStepButtonClicked` (a step's delete button) do
    // not, so for those two this loop is the only thing between a click and a
    // reload. Separately, pressing Enter in a lone text field submits its form:
    // the issue dialog is the live case, where Finding URL is the only text
    // input even though that form has no submit button at all.
    for (const form of document.forms) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
        });
    }

    const addIssueDialog = requireEl("add-issue-dialog");
    addIssueDialog.addEventListener('close', onAddIssueDialogClosed);
    addIssueDialog.addEventListener('cancel', (e) => {
        if (!confirmDiscardUnsavedIssueEntry()) {
            e.preventDefault();
        }
    });
}

initialize();
