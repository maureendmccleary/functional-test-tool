import type { FunctionalTest, TestRunStep } from '../types.js';
import { defaults } from '../config/defaults.js';
import { testAssistiveTechnology } from '../domain/functional-test.js';
import { normalizeOperatingSystem } from '../domain/migration.js';
import { safeLinkUrl } from '../domain/safe-url.js';
import { emptyTestRun, ensureTestRunShape } from '../domain/test-run.js';
import {
    getCurrentRun, getCurrentTest, markEvaluationChanged, setCurrentRunIndex, setCurrentTestIndex
} from '../state/store.js';
import { appendNewlines, fillListbox } from './controls.js';
import { findEl, requireEl, requireForm } from './dom.js';
import { saveFileButtonClick } from './evaluation-view.js';
import { addIssueButtonClick } from './issue-dialog.js';
import { viewResultsButtonClicked } from './results-view.js';
import {
    getExtensionLabelIdForPerform, getIssueListId, getStepLabelIdForPerform
} from './step-ids.js';
import { viewSummaryButtonClicked } from './summary-dialog.js';

/** The current test's operating system. */
export function getSelectedOperatingSystem(): string {
    return normalizeOperatingSystem(getCurrentTest().operatingSystem);
}

/** Redraws one list of recorded issues, a step's or an extension's. */
function drawIssueLists(section: 'steps' | 'extensions', records: TestRunStep[]): void {
    records.forEach((record, index) => {
        const issueAggregateUl = requireEl(getIssueListId(section, index));
        while (issueAggregateUl.firstChild) {
            issueAggregateUl.removeChild(issueAggregateUl.firstChild);
        }
        const issues = record.issues || [];
        if (issues.length > 0) {
            issues.forEach((issue) => {
                const issueDescLi = document.createElement("LI");
                issueDescLi.textContent = issue.description;
                issueAggregateUl.appendChild(issueDescLi);
            });
        }
        else {
            const issueDescLi = document.createElement("LI");
            issueDescLi.textContent = "No issues";
            issueAggregateUl.appendChild(issueDescLi);
        }
    });
}

/** Redraws every step's and extension's issue list from the selected run. */
export function populateIssuesList(): void {
    const run = getCurrentRun();
    drawIssueLists('steps', run.steps);
    drawIssueLists('extensions', run.extensions || []);
}

/** Relabels one set of buttons to reflect how many issues each holds. */
function relabelIssueButtons(selector: string, records: TestRunStep[]): void {
    requireEl('perform-dialog').querySelectorAll(selector).forEach((button, index) => {
        const record = records[index];
        const count = record && record.issues ? record.issues.length : 0;
        if (count === 0) {
            button.textContent = "Add Issue";
            return;
        }
        button.textContent = "View " + count + (count === 1 ? " Issue" : " Issues");
    });
}

/** Relabels each step's and extension's button to reflect how many issues it holds. */
export function updateAddIssueButtons(): void {
    const run = getCurrentRun();
    relabelIssueButtons('button[id^="add-issue-btn"]', run.steps);
    relabelIssueButtons('button[id^="add-extension-issue-btn"]', run.extensions || []);
}

/**
 * Points the store at the script's run and fills the dialog from it.
 *
 * A script is written for one assistive technology and carries one run, so
 * there is nothing to choose between here. The run is created only for a file
 * hand-edited to drop it; everything the tool writes already has one.
 *
 * The score is shown as stored and not recomputed. Picking one is what marks
 * the run performed, so filling it in on the tester's behalf would report every
 * script as performed the moment it was opened.
 */
export function openTestRun(): void {
    const test = getCurrentTest();
    if (test.runs.length === 0) {
        test.runs.push(emptyTestRun(test, testAssistiveTechnology(test), getSelectedOperatingSystem()));
    }
    ensureTestRunShape(test, test.runs[0]);
    setCurrentRunIndex(0);
    populateIssuesList();
    updateAddIssueButtons();
    requireEl<HTMLSelectElement>("perform-score").value = String(getCurrentRun().score);
}

/**
 * Records the score the tester picked.
 *
 * The only place the tester's own score reaches the run. Until it does, the
 * run's score is -1 and the run counts as not yet performed.
 */
export function scoreChanged(): void {
    getCurrentRun().score = parseInt(requireEl<HTMLSelectElement>("perform-score").value, 10);
    markEvaluationChanged();
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
    issueListH4.textContent = "Issues";
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

/**
 * Builds the extension blocks, replacing any left from the last test opened.
 *
 * They follow the steps and are laid out the same way, at the same heading
 * level: an extension is not a step in the walkthrough, but the tester records
 * issues against it in exactly the same way, and "Extension 1" against
 * "Step 1" is what tells the two apart.
 */
function renderExtensionsForPerform(test: FunctionalTest): void {
    const form = requireForm("performForm");
    const existing = findEl("perform-extensions");
    if (existing) {
        existing.remove();
    }

    const extensions = Array.isArray(test.extensions) ? test.extensions : [];
    if (extensions.length === 0) {
        return;
    }

    const container = document.createElement("DIV");
    container.setAttribute("id", "perform-extensions");
    extensions.forEach((extension, index) => {
        const extensionDiv = document.createElement("DIV");
        extensionDiv.setAttribute("id", `extension-div[${index}]`);

        const label = document.createElement("H3");
        label.textContent = `Extension ${index + 1}`;
        label.setAttribute("id", getExtensionLabelIdForPerform(index));

        const instructions = document.createElement("P");
        instructions.setAttribute("id", `perform-extension-contents[${index}]`);
        instructions.textContent = extension.instructions;

        const issuesHeading = document.createElement("H4");
        issuesHeading.textContent = "Issues";

        const results = document.createElement("UL");
        results.setAttribute("id", getIssueListId('extensions', index));

        const addIssueButton = document.createElement("BUTTON");
        (addIssueButton as HTMLButtonElement).type = "button";
        (addIssueButton as HTMLButtonElement).innerText = "Add Issue";
        addIssueButton.setAttribute("id", `add-extension-issue-btn[${index}]`);
        addIssueButton.setAttribute("aria-labelledby", `${addIssueButton.id} ${label.id}`);
        addIssueButton.addEventListener('click', addIssueButtonClick);

        extensionDiv.appendChild(label);
        extensionDiv.appendChild(instructions);
        extensionDiv.appendChild(issuesHeading);
        extensionDiv.appendChild(results);
        appendNewlines(extensionDiv);
        extensionDiv.appendChild(addIssueButton);
        container.appendChild(extensionDiv);
        appendNewlines(container);
    });
    form.appendChild(container);
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
    fillListbox(defaults["scores"], "perform-score");
    requireEl("perform-at").textContent = testAssistiveTechnology(test);
    requireEl("perform-name").textContent = test.name;
    requireEl("perform-goal").textContent = test.goal;
    requireEl("perform-operator").textContent = test.operator || "";
    requireEl("perform-application").textContent = test.application || "";
    requireEl("perform-operating-system").textContent = normalizeOperatingSystem(test.operatingSystem);
    // Only a real web address becomes a link. Anything else is shown as the
    // text it is, so a saved file cannot turn the start location into script
    // that runs when the tester follows it.
    const span = requireEl("perform-start-location");
    span.textContent = "";
    const address = safeLinkUrl(test.startLocation);
    if (address === "") {
        span.textContent = test.startLocation;
    } else {
        const a = document.createElement('a');
        a.href = address;
        a.textContent = test.startLocation;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        span.appendChild(a);
    }
    requireEl("perform-score").addEventListener("change", scoreChanged);

    for (let i = 0; i < test.steps.length; i++) {
        if (i === 0) {
            requireEl("perform-step-contents[0]").textContent = test.steps[i].instructions;
        } else {
            addStepToPerform(test, i);
        }
    }
    renderExtensionsForPerform(test);

    const saveResultsButton = requireEl("perform-save");
    saveResultsButton.addEventListener("click", saveFileButtonClick);
    const viewResults = requireEl("view-test-results");
    viewResults.addEventListener('click', viewResultsButtonClicked);
    const viewSummaryBtn = requireEl("view-summary");
    viewSummaryBtn.addEventListener('click', viewSummaryButtonClicked);

    requireEl("add-issue-btn[0]").addEventListener('click', addIssueButtonClick);
    openTestRun();
}

/** Opens the perform dialog on the test chosen in the list. */
export function performButtonClick(): void {
    const selectUC = requireEl<HTMLSelectElement>("select-test");
    setCurrentTestIndex(selectUC.value);
    populatePerform();
}
