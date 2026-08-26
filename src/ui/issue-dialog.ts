import type { Issue } from '../types.js';
import { defaults } from '../config/defaults.js';
import {
    getCurrentIssue, getCurrentRecord, getCurrentSection, getCurrentStep, getCurrentTest,
    markEvaluationChanged, setCurrentIssue, setCurrentSection, setCurrentStep
} from '../state/store.js';
import { clearTable, fillListbox } from './controls.js';
import { requireEl } from './dom.js';
import { showStatusMessage } from './status.js';
import { populateIssuesList, updateAddIssueButtons } from './perform-view.js';
import { getIssueListId, getStepNumber, isExtensionElementId } from './step-ids.js';

/*
 * This module and perform-view import each other: perform-view builds the
 * "Add Issue" buttons that call into here, and onAddIssueDialogClosed calls
 * back to refresh them. ES module cycles are fine for hoisted function
 * declarations called at event time, which is all these are.
 */

// True while the description/findingURL/score fields are visible and hold data that hasn't been saved yet.
export function hasUnsavedIssueEntry(): boolean {
    const controls = document.getElementById("add-issue-controls");
    if (!controls || controls.classList.contains("inactive")) {
        return false;
    }
    const description = requireEl<HTMLInputElement>("add-issue-description").value.trim();
    const findingURL = requireEl<HTMLInputElement>("add-issue-findingURL").value.trim();
    const score = requireEl<HTMLSelectElement>("add-issue-score").value;
    return description !== "" || findingURL !== "" || score !== "-1";
}

/** Asks before discarding a part-entered issue. True when it is safe to close. */
export function confirmDiscardUnsavedIssueEntry(): boolean {
    return !hasUnsavedIssueEntry() || window.confirm("The issue data you entered has not been saved and will be lost. Close anyway?");
}

/** Removes any validation messages and invalid states. */
export function clearIssueFieldErrors(): void {
    requireEl("add-issue-description-error").textContent = "";
    requireEl("add-issue-score-error").textContent = "";
    requireEl("add-issue-description").removeAttribute("aria-invalid");
    requireEl("add-issue-score").removeAttribute("aria-invalid");
}

/** Reveals the issue fields, cleared and ready for entry. */
export function showAddIssueControls(): void {
    const addIssueDiv = requireEl("add-issue-controls");
    addIssueDiv.classList.remove('inactive');
    fillListbox(defaults["issue-scores"], "add-issue-score");
    requireEl("add-issue-dialog-new-issue").setAttribute("disabled", "true");
    requireEl("add-issue-dialog-save").classList.remove("inactive");
    requireEl<HTMLInputElement>("add-issue-description").value = "";
    requireEl<HTMLInputElement>("add-issue-findingURL").value = "";
    requireEl<HTMLSelectElement>("add-issue-score").value = "-1";
    requireEl("add-issue-msg").textContent = "";
    clearIssueFieldErrors();
    requireEl("add-issue-description").focus();
}

/** Hides the issue fields and re-enables New Issue. */
export function hideAddIssueControls(): void {
    requireEl("add-issue-controls").classList.add("inactive");
    requireEl("add-issue-dialog-save").classList.add("inactive");
    requireEl("add-issue-dialog-new-issue").removeAttribute("disabled");
}

// Description and Score are required; Finding URL is optional. Moves focus to the first invalid field.
export function validateIssueInputs(): boolean {
    const descriptionInput = requireEl<HTMLInputElement>("add-issue-description");
    const scoreInput = requireEl<HTMLSelectElement>("add-issue-score");
    const description = descriptionInput.value.trim();
    const score = scoreInput.value;
    clearIssueFieldErrors();
    if (description === "") {
        requireEl("add-issue-description-error").textContent = "Description is required.";
        descriptionInput.setAttribute("aria-invalid", "true");
        descriptionInput.focus();
        return false;
    }
    // The only thing keeping a "-1" score out of saved data.
    if (score === "-1") {
        requireEl("add-issue-score-error").textContent = "Score is required.";
        scoreInput.setAttribute("aria-invalid", "true");
        scoreInput.focus();
        return false;
    }
    return true;
}

/** Redraws the current step's or extension's issue list in the perform dialog. */
export function updateIssueList(): void {
    const issues = getCurrentRecord().issues;
    const issueList = requireEl(getIssueListId(getCurrentSection(), getCurrentStep()));

    while (issueList.firstChild) {
        issueList.removeChild(issueList.firstChild);
    }
    if (issues.length === 0) {
        const issueLI = document.createElement("LI");
        issueLI.textContent = "No issues";
        issueList.appendChild(issueLI);

    }
    else {
        for (let i = 0; i < issues.length; i++) {
            const issueLI = document.createElement("LI");
            issueLI.textContent = issues[i].description;
            issueList.appendChild(issueLI);
        }
    }
}

/** Appends a row for one issue, with edit and delete buttons. */
export function insertIssueTable(newIssue: Issue): void {
    const issueTable = requireEl<HTMLTableElement>("add-issue-table");
    const row = issueTable.insertRow(-1);
    const cell1 = row.insertCell(0);
    const cell2 = row.insertCell(1);
    const cell3 = row.insertCell(2);
    const cell4 = row.insertCell(3);
    const cell5 = row.insertCell(4);
    cell1.classList.add("cell-centered");
    cell1.textContent = String(issueTable.rows.length - 1);
    cell2.textContent = newIssue.description;
    cell3.textContent = newIssue.findingURL;
    cell4.textContent = newIssue.score;
    cell4.classList.add("cell-centered");
    const deleteIssueButton = document.createElement('button');
    deleteIssueButton.setAttribute("aria-label", "delete");
    const deleteIssueIcon = document.createElement("span");
    deleteIssueIcon.classList.add("fa", "fa-trash");
    deleteIssueButton.appendChild(deleteIssueIcon);
    deleteIssueButton.type = "button";
    deleteIssueButton.addEventListener("click", deleteIssue);
    const editIssueButton = document.createElement('button');
    editIssueButton.setAttribute("aria-label", "edit");
    const editIssueIcon = document.createElement("span");
    editIssueIcon.classList.add("fa", "fa-edit");
    editIssueButton.appendChild(editIssueIcon);
    editIssueButton.type = "button";
    editIssueButton.addEventListener("click", editIssue);
    cell5.appendChild(editIssueButton);
    cell5.appendChild(deleteIssueButton);
}

/** Rebuilds the table from the recorded issues, discarding what was there. */
export function copyIssues2Table(issueTable: HTMLTableElement): void {
    clearTable(issueTable);
    for (let i = 0; i < getCurrentRecord().issues.length; i++) {
        insertIssueTable(getCurrentRecord().issues[i]);
    }
}

/** Refreshes the table only when it no longer matches the recorded issues. */
export function updateIssueTable(): void {
    const issueTable = requireEl<HTMLTableElement>("add-issue-table");
    const rows = issueTable.rows;
    if (getCurrentRecord().issues.length === 0
        && rows.length === 1) {
        return;
    }
    else
        if (getCurrentRecord().issues.length === 0) {
            clearTable(issueTable);
            return;
        }
        else if ((getCurrentRecord().issues.length + 1) !== rows.length) {
            copyIssues2Table(issueTable);
            return;
        }

    // rows[0] is the header, so issue `i` lives in row `i + 1`; stop one short
    // of rows.length or the last iteration reads past the end.
    for (let i = 0; i < rows.length - 1; i++) {
        const row = rows[i + 1];
        const cells = row.cells;
        // Compared as text, matching how the cells are written. Read back as
        // innerHTML, a description holding & or < came back escaped and never
        // matched, so the table redrew on every open.
        if (getCurrentRecord().issues[i].description !== cells[1].textContent
            || getCurrentRecord().issues[i].findingURL !== cells[2].textContent
            || getCurrentRecord().issues[i].score !== cells[3].textContent) {
            copyIssues2Table(issueTable);
        }
    }
}

/** Validates and appends a new issue to the current step. */
export function saveIssueButtonClick(e: Event): void {
    e.preventDefault();
    if (!validateIssueInputs()) {
        return;
    }
    const newIssue = {} as Issue;
    newIssue.description = requireEl<HTMLInputElement>("add-issue-description").value;
    newIssue.findingURL = requireEl<HTMLInputElement>("add-issue-findingURL").value;
    newIssue.score = requireEl<HTMLSelectElement>("add-issue-score").value;
    insertIssueTable(newIssue);
    getCurrentRecord().issues.push(newIssue);
    markEvaluationChanged();
    updateIssueList();
    hideAddIssueControls();
    setCurrentIssue(getCurrentRecord().issues.length);
    // Focus, then announce. Hiding the Save button drops focus to the body, and
    // a screen reader treats that as a context change and discards a pending
    // announcement. JAWS did; NVDA happened not to.
    requireEl("add-issue-dialog-new-issue").focus();
    showStatusMessage("add-issue-msg", "Issue successfully saved!", 0);
}

/** Validates and overwrites the issue currently being edited. */
export function editSaveIssueButtonClick(e: Event): void {
    e.preventDefault();
    if (!validateIssueInputs()) {
        return;
    }
    const newIssue = {} as Issue;
    const currentIssue = getCurrentIssue();
    newIssue.description = requireEl<HTMLInputElement>("add-issue-description").value;
    newIssue.findingURL = requireEl<HTMLInputElement>("add-issue-findingURL").value;
    newIssue.score = requireEl<HTMLSelectElement>("add-issue-score").value;
    const issueTable = requireEl<HTMLTableElement>("add-issue-table");
    const row = issueTable.rows[currentIssue];
    row.cells[1].innerText = newIssue.description;
    row.cells[2].innerText = newIssue.findingURL;
    row.cells[3].innerText = newIssue.score;
    getCurrentRecord().issues[currentIssue - 1] = newIssue;
    markEvaluationChanged();
    updateIssueList();
    hideAddIssueControls();
    setCurrentIssue(getCurrentRecord().issues.length);
    // Focus, then announce. Hiding the Save button drops focus to the body, and
    // a screen reader treats that as a context change and discards a pending
    // announcement. JAWS did; NVDA happened not to.
    requireEl("add-issue-dialog-new-issue").focus();
    showStatusMessage("add-issue-msg", "Issue successfully saved!", 0);
}

/** Loads the clicked row into the fields for editing. */
export function editIssue(e: Event): void {
    const button = e.target as HTMLElement;
    let row = button.parentNode!.parentNode as HTMLTableRowElement;
    const issueTable = row.parentNode!.parentNode as HTMLTableElement;
    setCurrentIssue(row.rowIndex);
    row = issueTable.rows[getCurrentIssue()];
    showAddIssueControls();
    const saveIssueButton = requireEl("add-issue-dialog-save");
    saveIssueButton.removeEventListener("click", saveIssueButtonClick);
    saveIssueButton.addEventListener("click", editSaveIssueButtonClick);
    requireEl<HTMLInputElement>("add-issue-description").value = row.cells[1].innerText;
    requireEl<HTMLInputElement>("add-issue-findingURL").value = row.cells[2].innerText;
    requireEl<HTMLSelectElement>("add-issue-score").value = row.cells[3].innerText;
    showStatusMessage("add-issue-msg", "Editing issue " + getCurrentIssue(), 0);
    requireEl("add-issue-description").focus();
}

/** Removes the clicked row and its issue, renumbering the rows after it. */
export function deleteIssue(e: Event): void {
    const button = e.target as HTMLElement;
    const row = button.parentNode!.parentNode as HTMLTableRowElement;
    const issueTable = row.parentNode!.parentNode as HTMLTableElement;
    const rowIndex = row.rowIndex;
    issueTable.deleteRow(rowIndex);
    setCurrentIssue(getCurrentRecord().issues.length);
    for (let i = 1; i < issueTable.rows.length; i++) {
        issueTable.rows[i].cells[0].textContent = String(i);
    }
    getCurrentRecord().issues.splice(rowIndex - 1, 1);
    markEvaluationChanged();
    updateIssueList();
    // The row just removed held the button that had focus, so focus has to land
    // somewhere before the message, or it is discarded with the old context.
    requireEl("add-issue-dialog-new-issue").focus();
    showStatusMessage("add-issue-msg", `Issue ${rowIndex} was deleted.`, 0);
}

/** Switches the dialog into add mode, pointing Save at the add handler. */
export function newIssueButtonClick(): void {
    showAddIssueControls();
    const saveIssueButton = requireEl("add-issue-dialog-save");
    saveIssueButton.removeEventListener("click", editSaveIssueButtonClick);
    saveIssueButton.addEventListener("click", saveIssueButtonClick);
}

/** Opens the issue dialog for the step whose button was activated. */
/**
 * Closes the dialog from its own X button, asking first if an issue is part
 * entered.
 *
 * Registered once at startup, not each time the dialog opens. As an inline
 * function inside the open handler it was a fresh closure every time, so the
 * browser kept all of them: ten opens meant ten handlers, each running the
 * discard prompt in turn.
 */
export function addIssueDialogCloseClicked(e: Event): void {
    e.preventDefault();
    if (!confirmDiscardUnsavedIssueEntry()) {
        return;
    }
    requireEl<HTMLDialogElement>("add-issue-dialog").close();
}

/** Wires the issue dialog's own controls. Called once at startup. */
export function addIssueDialogEvents(): void {
    requireEl("add-issue-dialog-close").addEventListener("click", addIssueDialogCloseClicked);
    requireEl("add-issue-dialog-new-issue").addEventListener("click", newIssueButtonClick);
}

export function addIssueButtonClick(e: Event): void {
    e.preventDefault();
    const addIssueDialog = requireEl<HTMLDialogElement>("add-issue-dialog");
    addIssueDialog.showModal();
    const heading = requireEl("add-issue-dialog-title");
    requireEl("add-issue-msg").textContent = "";
    // Which button was pressed decides both the index and the list it indexes,
    // so an issue found in extension 2 is not filed against step 2.
    const buttonId = (e.target as HTMLElement).id;
    setCurrentSection(isExtensionElementId(buttonId) ? 'extensions' : 'steps');
    setCurrentStep(getStepNumber(buttonId));

    const currentStep = getCurrentStep();
    const test = getCurrentTest();
    const isExtension = getCurrentSection() === 'extensions';
    const label = `${isExtension ? "Extension" : "Step"} ${currentStep + 1}`;
    const source = isExtension ? test.extensions : test.steps;

    heading.textContent = getCurrentRecord().issues.length === 0
        ? `Add Issue ${label}`
        : `View Issue ${label}`;
    requireEl("add-issue-step-label").textContent = label;
    requireEl("add-issue-step").textContent = (source[currentStep] || { instructions: "" }).instructions;
    setCurrentIssue(0);
    updateIssueTable();
    if (getCurrentRecord().issues.length === 0) {
        newIssueButtonClick();
        return;
    }
    // On the heading, which names the step, rather than on the close button:
    // "close" is not what the tester came here to hear.
    heading.focus();
}

// Runs whenever the add-issue dialog closes (X button, Escape key, or programmatic close), so the
// step buttons and issue lists always reflect the current data regardless of how the dialog was
// dismissed. The score is deliberately left alone: it is the tester's, and recomputing it here
// would overwrite their choice and mark an untouched run as performed.
export function onAddIssueDialogClosed(): void {
    updateAddIssueButtons();
    populateIssuesList();
}
