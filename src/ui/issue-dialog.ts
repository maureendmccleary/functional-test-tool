import type { Issue } from '../types.js';
import { defaults } from '../config/defaults.js';
import { issuesMap, minimumScore } from '../domain/scoring.js';
import {
    getCurrentIssue, getCurrentRun, getCurrentStep, getCurrentTest,
    setCurrentIssue, setCurrentStep
} from '../state/store.js';
import { clearTable, fillListbox } from './controls.js';
import { requireEl } from './dom.js';
import { updateAddIssueButtons } from './perform-view.js';
import { getStepNumber } from './step-ids.js';

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
    requireEl("add-issue-description-error").innerHTML = "";
    requireEl("add-issue-score-error").innerHTML = "";
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
    requireEl("add-issue-msg").innerHTML = "";
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
        requireEl("add-issue-description-error").innerHTML = "Description is required.";
        descriptionInput.setAttribute("aria-invalid", "true");
        descriptionInput.focus();
        return false;
    }
    // The only thing keeping a "-1" score out of saved data.
    if (score === "-1") {
        requireEl("add-issue-score-error").innerHTML = "Score is required.";
        scoreInput.setAttribute("aria-invalid", "true");
        scoreInput.focus();
        return false;
    }
    return true;
}

/** Redraws the current step's issue list in the perform dialog. */
export function updateIssueList(): void {
    const run = getCurrentRun();
    const currentStep = getCurrentStep();
    const issueList = requireEl(`perform-step-results[${currentStep}]`);

    while (issueList.firstChild) {
        issueList.removeChild(issueList.firstChild);
    }
    if (run.steps[currentStep].issues.length === 0) {
        const issueLI = document.createElement("LI");
        issueLI.innerHTML = "No issues";
        issueList.appendChild(issueLI);

    }
    else {
        for (let i = 0; i < run.steps[currentStep].issues.length; i++) {
            const issueLI = document.createElement("LI");
            issueLI.innerHTML = run.steps[currentStep].issues[i].description;
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
    cell1.setAttribute("style", "text-align: center");
    cell1.innerHTML = String(issueTable.rows.length - 1);
    cell2.innerHTML = newIssue.description;
    cell3.innerHTML = newIssue.findingURL;
    cell4.innerHTML = newIssue.score;
    cell4.setAttribute("style", "text-align: center");
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
    const run = getCurrentRun();
    const currentStep = getCurrentStep();
    for (let i = 0; i < run.steps[currentStep].issues.length; i++) {
        insertIssueTable(run.steps[currentStep].issues[i]);
    }
}

/** Refreshes the table only when it no longer matches the recorded issues. */
export function updateIssueTable(): void {
    const issueTable = requireEl<HTMLTableElement>("add-issue-table");
    const rows = issueTable.rows;
    const run = getCurrentRun();
    const currentStep = getCurrentStep();
    if (run.steps[currentStep].issues.length === 0
        && rows.length === 1) {
        return;
    }
    else
        if (run.steps[currentStep].issues.length === 0) {
            clearTable(issueTable);
            return;
        }
        else if ((run.steps[currentStep].issues.length + 1) !== rows.length) {
            copyIssues2Table(issueTable);
            return;
        }

    // rows[0] is the header, so issue `i` lives in row `i + 1`; stop one short
    // of rows.length or the last iteration reads past the end.
    for (let i = 0; i < rows.length - 1; i++) {
        const row = rows[i + 1];
        const cells = row.cells;
        if (run.steps[currentStep].issues[i].description !== cells[1].innerHTML
            || run.steps[currentStep].issues[i].findingURL !== cells[2].innerHTML
            || run.steps[currentStep].issues[i].score !== cells[3].innerHTML) {
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
    const run = getCurrentRun();
    const currentStep = getCurrentStep();
    newIssue.description = requireEl<HTMLInputElement>("add-issue-description").value;
    newIssue.findingURL = requireEl<HTMLInputElement>("add-issue-findingURL").value;
    newIssue.score = requireEl<HTMLSelectElement>("add-issue-score").value;
    insertIssueTable(newIssue);
    run.steps[currentStep].issues.push(newIssue);
    updateIssueList();
    requireEl("add-issue-msg").innerHTML = "";
    requireEl("add-issue-msg").innerHTML = "Issue successfully saved!";
    hideAddIssueControls();
    setCurrentIssue(run.steps[currentStep].issues.length);
}

/** Validates and overwrites the issue currently being edited. */
export function editSaveIssueButtonClick(e: Event): void {
    e.preventDefault();
    if (!validateIssueInputs()) {
        return;
    }
    const newIssue = {} as Issue;
    const run = getCurrentRun();
    const currentStep = getCurrentStep();
    const currentIssue = getCurrentIssue();
    newIssue.description = requireEl<HTMLInputElement>("add-issue-description").value;
    newIssue.findingURL = requireEl<HTMLInputElement>("add-issue-findingURL").value;
    newIssue.score = requireEl<HTMLSelectElement>("add-issue-score").value;
    const issueTable = requireEl<HTMLTableElement>("add-issue-table");
    const row = issueTable.rows[currentIssue];
    row.cells[1].innerText = newIssue.description;
    row.cells[2].innerText = newIssue.findingURL;
    row.cells[3].innerText = newIssue.score;
    run.steps[currentStep].issues[currentIssue - 1] = newIssue;
    updateIssueList();
    requireEl("add-issue-msg").innerHTML = "";
    requireEl("add-issue-msg").innerHTML = "Issue successfully saved!";
    hideAddIssueControls();
    setCurrentIssue(run.steps[currentStep].issues.length);
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
    requireEl("add-issue-msg").innerHTML = "";
    requireEl("add-issue-msg").innerHTML = "Editing issue " + getCurrentIssue();
    requireEl("add-issue-description").focus();
}

/** Removes the clicked row and its issue, renumbering the rows after it. */
export function deleteIssue(e: Event): void {
    const button = e.target as HTMLElement;
    const row = button.parentNode!.parentNode as HTMLTableRowElement;
    const run = getCurrentRun();
    const currentStep = getCurrentStep();
    const issueTable = row.parentNode!.parentNode as HTMLTableElement;
    const rowIndex = row.rowIndex;
    requireEl("add-issue-msg").innerHTML = "";
    requireEl("add-issue-msg").innerHTML = "Deleting issue " + rowIndex;
    issueTable.deleteRow(rowIndex);
    setCurrentIssue(run.steps[currentStep].issues.length);
    for (let i = 1; i < issueTable.rows.length; i++) {
        issueTable.rows[i].cells[0].innerHTML = String(i);
    }
    run.steps[currentStep].issues.splice(rowIndex - 1, 1);
    updateIssueList();
}

/** Switches the dialog into add mode, pointing Save at the add handler. */
export function newIssueButtonClick(): void {
    showAddIssueControls();
    const saveIssueButton = requireEl("add-issue-dialog-save");
    saveIssueButton.removeEventListener("click", editSaveIssueButtonClick);
    saveIssueButton.addEventListener("click", saveIssueButtonClick);
}

/** Opens the issue dialog for the step whose button was activated. */
export function addIssueButtonClick(e: Event): void {
    e.preventDefault();
    const addIssueDialog = requireEl<HTMLDialogElement>("add-issue-dialog");
    const addIssueClose = requireEl("add-issue-dialog-close");
    addIssueDialog.showModal();
    addIssueClose.addEventListener("click", (e) => {
        e.preventDefault();
        if (!confirmDiscardUnsavedIssueEntry()) {
            return;
        }
        addIssueDialog.close();
    });
    const heading = requireEl("add-issue-dialog-title");
    requireEl("add-issue-msg").innerHTML = "";
    setCurrentStep(getStepNumber((e.target as HTMLElement).id));
    const currentStep = getCurrentStep();
    const test = getCurrentTest();
    const run = getCurrentRun();
    if (run.steps[currentStep].issues.length === 0) {
        heading.innerHTML = "Add Issue Step " + (currentStep + 1);
    }
    else {
        heading.innerHTML = "View Issue Step " + (currentStep + 1);
    }
    requireEl("add-issue-step-label").innerHTML = "Step " + String(currentStep + 1);
    requireEl("add-issue-step").innerHTML = test.steps[currentStep].instructions;
    setCurrentIssue(0);
    updateIssueTable();
    const newIssue = requireEl("add-issue-dialog-new-issue");
    newIssue.addEventListener("click", newIssueButtonClick);
    if (run.steps[currentStep].issues.length === 0) {
        newIssueButtonClick();
    }
}

// Runs whenever the add-issue dialog closes (X button, Escape key, or programmatic close), so the
// step buttons and score always reflect the current data regardless of how the dialog was dismissed.
export function onAddIssueDialogClosed(): void {
    const run = getCurrentRun();
    updateAddIssueButtons();
    let issueAggregate: string;
    run.steps.forEach((step, index) => {
        const resultId = "perform-step-results[" + index + "]";
        if (step.issues.length > 0) {
            issueAggregate = "";
            step.issues.forEach((issue) => {
                issueAggregate += issue.description + "\n\n";
            });
        }
        else {
            issueAggregate = "No issues";
        }
        (requireEl(resultId) as HTMLElement & { value: string }).value = issueAggregate;
    });
    const score = requireEl<HTMLSelectElement>("perform-score");
    score.value = String(minimumScore(issuesMap(run)));
    run.score = parseInt(score.value, 10);
}
