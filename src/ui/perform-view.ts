import type { FunctionalTest } from '../types.js';
import { defaults } from '../config/defaults.js';
import { normalizeOperatingSystem } from '../domain/migration.js';
import {
    emptyTestRun, ensureTestRunStepCount, findTestRunIndex
} from '../domain/test-run.js';
import { issuesMap, minimumScore } from '../domain/scoring.js';
import {
    getCurrentRun, getCurrentTest, setCurrentRunIndex, setCurrentTestIndex
} from '../state/store.js';
import { appendNewlines, fillListbox } from './controls.js';
import { requireEl, requireForm } from './dom.js';
import { saveFileButtonClick } from './evaluation-view.js';
import { addIssueButtonClick } from './issue-dialog.js';
import { viewResultsButtonClicked } from './results-view.js';
import { getStepLabelIdForPerform } from './step-ids.js';
import { viewSummaryButtonClicked } from './summary-dialog.js';

/** The assistive technology chosen in the perform dialog, or an empty string. */
export function getSelectedAssistiveTechnology(): string {
    const atSelect = requireEl<HTMLSelectElement>("perform-at");
    return atSelect.options.length ? atSelect.options[atSelect.selectedIndex].textContent as string : "";
}

/** The current test's operating system. */
export function getSelectedOperatingSystem(): string {
    return normalizeOperatingSystem(getCurrentTest().operatingSystem);
}

/** Redraws every step's issue list from the selected run. */
export function populateIssuesList(): void {
    const run = getCurrentRun();
    run.steps.forEach((step, index) => {
        const resultId = `perform-step-results[${index}]`;
        const issueAggregateUl = requireEl(resultId);
        while (issueAggregateUl.firstChild) {
            issueAggregateUl.removeChild(issueAggregateUl.firstChild);
        }
        if (step.issues.length > 0) {
            step.issues.forEach((issue) => {
                const issueDescLi = document.createElement("LI");
                issueDescLi.innerHTML = issue.description;
                issueAggregateUl.appendChild(issueDescLi);
            });
        }
        else {
            const issueDescLi = document.createElement("LI");
            issueDescLi.innerHTML = "No issues";
            issueAggregateUl.appendChild(issueDescLi);
        }
    });
}

/** Relabels each step's button to reflect how many issues it holds. */
export function updateAddIssueButtons(): void {
    const run = getCurrentRun();
    const dialog = requireEl('perform-dialog');
    const addIssueButtons = dialog.querySelectorAll('button[id^="add-issue-btn"]');
    addIssueButtons.forEach((button, index) => {
        const step = run.steps[index];
        if (step && step.issues && step.issues.length === 1) {
            const issueStr = " Issue";
            button.innerHTML = "View " + step.issues.length + issueStr;
        }
        else if (step && step.issues && step.issues.length > 1) {
            const issueStr = " Issues";
            button.innerHTML = "View " + step.issues.length + issueStr;
        }
        else {
            button.innerHTML = "Add Issue";
        }
    });
}

/** Switches to the performance matching the chosen AT/OS, creating it if needed. */
export function selectTestRun(): void {
    const test = getCurrentTest();
    const ats = getSelectedAssistiveTechnology();
    const operatingSystem = getSelectedOperatingSystem();
    let index = findTestRunIndex(test, ats, operatingSystem);
    if (index === -1) {
        test.runs.push(emptyTestRun(test, ats, operatingSystem));
        index = test.runs.length - 1;
    } else {
        ensureTestRunStepCount(test, test.runs[index]);
    }
    setCurrentRunIndex(index);
    const run = getCurrentRun();
    populateIssuesList();
    updateAddIssueButtons();
    const score = requireEl<HTMLSelectElement>("perform-score");
    score.value = String(minimumScore(issuesMap(run)));
    run.score = parseInt(score.value, 10);
}

function createStepLabelForPerform(stepNumber: number): HTMLElement {
    const newStepLabel = document.createElement('H3');
    newStepLabel.textContent = `Step ${stepNumber + 1}`;
    newStepLabel.setAttribute("id", getStepLabelIdForPerform(stepNumber));
    return newStepLabel;
}

function createStepInstructionsForPerform(stepNumber: number): HTMLElement {
    const test = getCurrentTest();
    const newStep = document.createElement('P');
    newStep.setAttribute("id", `perform-step-contents[${stepNumber}]`);
    newStep.textContent = test.steps[stepNumber].instructions;
    return newStep;
}

function createIssueListHeading(): HTMLElement {
    const issueListH4 = document.createElement('H4');
    issueListH4.innerHTML = "Issues";
    return issueListH4;
}

function createStepResultsForPerform(stepNumber: number): HTMLElement {
    const stepResults = document.createElement('UL');
    stepResults.setAttribute("id", `perform-step-results[${stepNumber}]`);
    return stepResults;
}

function createAddIssueButtonForPerform(stepNumber: number): HTMLElement {
    const addIssueButton = document.createElement('BUTTON');
    const stepLabelId = getStepLabelIdForPerform(stepNumber);
    (addIssueButton as HTMLButtonElement).type = "button";
    (addIssueButton as HTMLButtonElement).innerText = "Add Issue";
    addIssueButton.addEventListener('click', addIssueButtonClick);
    addIssueButton.setAttribute("id", `add-issue-btn[${stepNumber}]`);
    addIssueButton.setAttribute("aria-labelledby", `${addIssueButton.id} ${stepLabelId}`);
    return addIssueButton;
}

/** Appends one step, with its issue list and Add Issue button. */
export function addStepToPerform(test: FunctionalTest, stepNumber: number): void {
    const form = requireForm("performForm");
    const stepDiv = document.createElement("DIV");
    stepDiv.setAttribute("id", `step-div[${stepNumber}]`);
    const newStepLabel = createStepLabelForPerform(stepNumber);
    const newStep = createStepInstructionsForPerform(stepNumber);
    const issueListH4 = createIssueListHeading();
    const stepResults = createStepResultsForPerform(stepNumber);
    const addIssueButton = createAddIssueButtonForPerform(stepNumber);

    appendNewlines(form);
    stepDiv.appendChild(newStepLabel);
    stepDiv.appendChild(newStep);
    stepDiv.appendChild(issueListH4);
    stepDiv.appendChild(stepResults);
    appendNewlines(stepDiv);
    stepDiv.appendChild(addIssueButton);
    form.appendChild(stepDiv);
    appendNewlines(form);
}

/** Fills the perform dialog for the current test and selects a run. */
export function populatePerform(): void {
    const test = getCurrentTest();
    const performDialog = requireEl<HTMLDialogElement>("perform-dialog");
    const stepDivs = performDialog.querySelectorAll('div[id^="step-div"]');
    for (let i = 1; i < stepDivs.length; i++) {
        stepDivs[i].remove();
    }

    const performDialogClose = requireEl("perform-dialog-close");
    performDialog.showModal();
    performDialogClose.addEventListener("click", (e) => {
        e.preventDefault();
        performDialog.close();
    });
    const performForm = requireEl<HTMLFormElement>("perform-form");
    performForm.reset();
    fillListbox(test.assistiveTechnologies, "perform-at");
    fillListbox(defaults["scores"], "perform-score");
    requireEl("perform-name").innerHTML = test.name;
    requireEl("perform-goal").innerHTML = test.goal;
    requireEl("perform-operator").textContent = test.operator || "";
    requireEl("perform-application").textContent = test.application || "";
    requireEl("perform-operating-system").textContent = normalizeOperatingSystem(test.operatingSystem);
    const a = document.createElement('a');
    a.href = test.startLocation;
    a.textContent = test.startLocation;
    a.target = "_blank";
    const span = requireEl("perform-start-location");
    span.innerHTML = "";
    span.appendChild(a);
    requireEl("perform-at").addEventListener("change", selectTestRun);

    for (let i = 0; i < test.steps.length; i++) {
        if (i === 0) {
            requireEl("perform-step-contents[0]").textContent = test.steps[i].instructions;
        } else {
            addStepToPerform(test, i);
        }
    }
    const saveResultsButton = requireEl("perform-save");
    saveResultsButton.addEventListener("click", saveFileButtonClick);
    const viewResults = requireEl("view-test-results");
    viewResults.addEventListener('click', viewResultsButtonClicked);
    const viewSummaryBtn = requireEl("view-summary");
    viewSummaryBtn.addEventListener('click', viewSummaryButtonClicked);

    requireEl("add-issue-btn[0]").addEventListener('click', addIssueButtonClick);
    selectTestRun();
}

/** Opens the perform dialog on the test chosen in the list. */
export function performButtonClick(): void {
    const selectUC = requireEl<HTMLSelectElement>("select-test");
    setCurrentTestIndex(selectUC.value);
    populatePerform();
}
