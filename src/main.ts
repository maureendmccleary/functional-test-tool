import { defaults } from './config/defaults.js';
import { fillCheckboxMenu } from './ui/controls.js';
import { requireEl } from './ui/dom.js';
import {
    addFormEvents, editTestButtonClicked, newStepButtonClick, newTestButtonClicked
} from './ui/editor-view.js';
import { evalViewResultsButtonClicked } from './ui/eval-results-view.js';
import { loadEvalButtonClicked, saveFileButtonClick } from './ui/evaluation-view.js';
import { confirmDiscardUnsavedIssueEntry, onAddIssueDialogClosed } from './ui/issue-dialog.js';
import { performButtonClick } from './ui/perform-view.js';

/** Wires the controls that exist in index.html from the start. */
function initialize(): void {
    requireEl("eval-file-load").addEventListener("click", loadEvalButtonClicked);
    requireEl("eval-view-results").addEventListener("click", evalViewResultsButtonClicked);
    requireEl("eval-save-file").addEventListener("click", saveFileButtonClick);
    requireEl("edit-test").addEventListener("click", editTestButtonClicked);
    requireEl("new-test").addEventListener("click", newTestButtonClicked);

    fillCheckboxMenu(defaults["at-types"], "test-edit-at-menu", "ats");
    addFormEvents();

    const ucFileSave = requireEl("test-save");
    ucFileSave.addEventListener('click', saveFileButtonClick);
    ucFileSave.removeAttribute("disabled");

    requireEl("perform-test").addEventListener('click', performButtonClick);
    requireEl("new-step-btn").addEventListener('click', newStepButtonClick);

    // No form here is ever meant to submit: every control has a click handler
    // and the data lives in the store. Left unguarded, pressing Enter in a text
    // field implicitly submits, which reloads the page and silently drops the
    // whole evaluation. The issue dialog is the live case -- Finding URL is the
    // only text input in its form, so Enter submits it even though that form
    // has no submit button at all.
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
