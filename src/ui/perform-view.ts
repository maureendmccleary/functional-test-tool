import type { FunctionalTest, TestRunStep } from '../types.js';
import { defaults } from '../config/defaults.js';
import {
    isLastTestForItsTechnology, testAssistiveTechnology
} from '../domain/functional-test.js';
import { normalizeOperatingSystem } from '../domain/migration.js';
import { safeLinkUrl } from '../domain/safe-url.js';
import { summaryWithoutSkippedIssues } from '../domain/summary.js';
import {
    emptyTestRun, ensureTestRunShape, isOutOfScope, issueLines, setOutOfScope
} from '../domain/test-run.js';
import {
    getCurrentRun, getCurrentTest, getEvaluation, hasUnsavedChanges, markEvaluationChanged,
    setCurrentRunIndex, setCurrentTestIndex
} from '../state/store.js';
import { appendNewlines, fillListbox } from './controls.js';
import { findEl, requireEl, requireForm } from './dom.js';
import { showScreen } from './screens.js';
import { saveFileButtonClick } from './evaluation-view.js';
import { addIssueButtonClick } from './issue-dialog.js';
import { viewResultsButtonClicked } from './results-view.js';
import {
    getExtensionLabelIdForPerform, getIssueListId, getOutOfScopeId, getOutOfScopeLabelId,
    getStepLabelIdForPerform, getStepNumber, isExtensionElementId
} from './step-ids.js';
import { viewSummaryButtonClicked } from './summary-dialog.js';

/** The current test's operating system. */
export function getSelectedOperatingSystem(): string {
    return normalizeOperatingSystem(getCurrentTest().operatingSystem);
}

/**
 * Redraws one list of recorded issues, a step's or an extension's.
 *
 * What each list says comes from issueLines, which the results dialog and the
 * report use for the same column: the tester reads the same words on the screen
 * they are working on as the ones the report will carry.
 */
function drawIssueLists(section: 'steps' | 'extensions', records: TestRunStep[]): void {
    records.forEach((record, index) => {
        const issueAggregateUl = requireEl(getIssueListId(section, index));
        while (issueAggregateUl.firstChild) {
            issueAggregateUl.removeChild(issueAggregateUl.firstChild);
        }
        issueLines(record).forEach((text) => {
            const issueDescLi = document.createElement("LI");
            issueDescLi.textContent = text;
            issueAggregateUl.appendChild(issueDescLi);
        });
    });
}

/** Redraws every step's and extension's issue list from the selected run. */
export function populateIssuesList(): void {
    const run = getCurrentRun();
    drawIssueLists('steps', run.steps);
    drawIssueLists('extensions', run.extensions || []);
}

/**
 * Redraws the Summary list under the score from the selected run.
 *
 * Filled when the screen opens, not only when a summary is saved. The list is a
 * single element that every test on the screen shares, so a test whose run has
 * no comments has to actively clear what the last one left there: without this
 * the tester read the previous script's summary under this script's score.
 */
export function populateSummaryList(): void {
    const summaryList = requireEl("summary-list");
    while (summaryList.firstChild) {
        summaryList.removeChild(summaryList.firstChild);
    }
    const comments = getCurrentRun().comments;
    const lines = comments.length > 0
        ? comments.map((comment) => comment.text)
        : ["No Issues"];
    lines.forEach((text) => {
        const summaryLi = document.createElement("LI");
        summaryLi.textContent = text;
        summaryList.appendChild(summaryLi);
    });
}

/**
 * Records that the tester marked a step or extension outside the test's scope,
 * or took the mark off again.
 *
 * The whole of what the checkbox does. A marked record reports as "Out of
 * scope" with no score and its issues stop counting, so the issue lists are
 * redrawn from the run rather than only the one that changed.
 *
 * A summary already written for this run is brought back into line as well.
 * Everything else derives its totals from the issues at the moment it is asked,
 * so marking a record is enough on its own; the summary is the one thing stored
 * as text, and it would otherwise keep describing a step nobody performed --
 * in the results dialog and the report as much as on this screen.
 *
 * The score is deliberately left alone. It is the tester's, and this is not the
 * score control.
 */
export function outOfScopeChanged(e: Event): void {
    const checkbox = e.currentTarget as HTMLInputElement;
    const section = isExtensionElementId(checkbox.id) ? 'extensions' : 'steps';
    const run = getCurrentRun();
    const record = run[section][getStepNumber(checkbox.id)];
    if (!record) {
        return;
    }
    setOutOfScope(record, checkbox.checked);
    run.comments = summaryWithoutSkippedIssues(run.comments, run);
    markEvaluationChanged();
    populateIssuesList();
    populateSummaryList();
}

/**
 * Builds the "Out of scope" checkbox for one step or extension.
 *
 * A plain checkbox, so it is announced as one and toggles with the space bar
 * without any help from this app. Its own label is what makes the box clickable
 * and is named in aria-labelledby beside the step's heading, because "Out of
 * scope" on its own says nothing about which step is being taken out of it:
 * every step on the screen has one of these.
 */
function createOutOfScopeCheckbox(
    section: 'steps' | 'extensions', index: number, headingId: string
): HTMLElement {
    const container = document.createElement("DIV");
    container.classList.add("out-of-scope");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.id = getOutOfScopeId(section, index);
    checkbox.setAttribute("aria-labelledby", `${getOutOfScopeLabelId(section, index)} ${headingId}`);
    checkbox.addEventListener("change", outOfScopeChanged);

    const label = document.createElement("label");
    label.setAttribute("id", getOutOfScopeLabelId(section, index));
    label.htmlFor = checkbox.id;
    label.textContent = "Out of scope";

    container.appendChild(checkbox);
    container.appendChild(label);
    return container;
}

/** Ticks each checkbox that the selected run has a mark stored for. */
export function updateOutOfScopeCheckboxes(): void {
    const run = getCurrentRun();
    ([['steps', run.steps], ['extensions', run.extensions || []]] as const)
        .forEach(([section, records]) => {
            records.forEach((record, index) => {
                requireEl<HTMLInputElement>(getOutOfScopeId(section, index)).checked
                    = isOutOfScope(record);
            });
        });
}

/** Relabels one set of buttons to reflect how many issues each holds. */
function relabelIssueButtons(selector: string, records: TestRunStep[]): void {
    requireEl('perform-screen').querySelectorAll(selector).forEach((button, index) => {
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
    updateOutOfScopeCheckboxes();
    populateSummaryList();
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
    const newStepLabel = document.createElement('H2');
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
    const issueListHeading = document.createElement('H3');
    issueListHeading.textContent = "Issues";
    return issueListHeading;
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
    const issueListHeading = createIssueListHeading();
    const stepResults = createStepResultsForPerform(stepNumber);
    const addIssueButton = createAddIssueButtonForPerform(stepNumber);

    appendNewlines(form);
    stepDiv.appendChild(newStepLabel);
    stepDiv.appendChild(newStep);
    stepDiv.appendChild(issueListHeading);
    stepDiv.appendChild(stepResults);
    appendNewlines(stepDiv);
    stepDiv.appendChild(addIssueButton);
    stepDiv.appendChild(createOutOfScopeCheckbox('steps', stepNumber, newStepLabel.id));
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

        const label = document.createElement("H2");
        label.textContent = `Extension ${index + 1}`;
        label.setAttribute("id", getExtensionLabelIdForPerform(index));

        const instructions = document.createElement("P");
        instructions.setAttribute("id", `perform-extension-contents[${index}]`);
        instructions.textContent = extension.instructions;

        const issuesHeading = document.createElement("H3");
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
        extensionDiv.appendChild(createOutOfScopeCheckbox('extensions', index, label.id));
        container.appendChild(extensionDiv);
        appendNewlines(container);
    });
    form.appendChild(container);
}

/**
 * Fills the perform screen for the current test and selects a run.
 *
 * Built before the screen is shown, the way the issue dialog is filled before
 * it opens: nothing is seen part drawn, and showScreen moves focus to the
 * heading once it is all there.
 */
export function populatePerform(): void {
    const test = getCurrentTest();
    const performScreen = requireEl("perform-screen");
    const stepDivs = performScreen.querySelectorAll('div[id^="step-div"]');
    for (let i = 1; i < stepDivs.length; i++) {
        stepDivs[i].remove();
    }

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
    for (let i = 0; i < test.steps.length; i++) {
        if (i === 0) {
            requireEl("perform-step-contents[0]").textContent = test.steps[i].instructions;
        } else {
            addStepToPerform(test, i);
        }
    }
    renderExtensionsForPerform(test);
    showOverallCommentsButton(test);

    requireEl("add-issue-btn[0]").addEventListener('click', addIssueButtonClick);
    openTestRun();

    showScreen('perform');
}

/**
 * Shows View Overall Comments only on the last test of its technology.
 *
 * On every test it would invite summarising the technology before the testing
 * is done; on the last one it is where the tester has just finished with it.
 */
function showOverallCommentsButton(test: FunctionalTest): void {
    const last = isLastTestForItsTechnology(getEvaluation().tests, test);
    requireEl("view-overall-comments").classList.toggle("inactive", !last);
}

/**
 * What Back asks when results have not been written to a file.
 *
 * Deliberately not "your changes will be lost". Going back keeps everything:
 * the evaluation lives in the store and the tester can walk straight back into
 * this test and find it as they left it. What the message is for is the thing
 * that does lose it, which is closing the tab, and testers were reading Back as
 * the culprit. Saying what is actually true is what makes the warning worth
 * reading rather than something to click through.
 */
const UNSAVED_RESULTS_WARNING =
    'These results have not been saved to a file. They are kept while the app is open, but '
    + 'will be lost if you close it. Go back anyway?';

/** Leaves the perform screen for the one it was opened from. */
export function performBackButtonClicked(e: Event): void {
    e.preventDefault();
    if (hasUnsavedChanges() && !window.confirm(UNSAVED_RESULTS_WARNING)) {
        return;
    }
    showScreen('landing');
}

/** Wires the perform screen's own controls. Called once at startup. */
export function addPerformScreenEvents(): void {
    requireEl("perform-back").addEventListener('click', performBackButtonClicked);
    requireEl("perform-save").addEventListener("click", saveFileButtonClick);
    requireEl("view-test-results").addEventListener('click', viewResultsButtonClicked);
    requireEl("view-summary").addEventListener('click', viewSummaryButtonClicked);
    requireEl("perform-score").addEventListener("change", scoreChanged);
    // The first step is written into index.html rather than built here, so its
    // checkbox is the one control of this kind the screen already owns.
    requireEl(getOutOfScopeId('steps', 0)).addEventListener("change", outOfScopeChanged);
}

/** Opens the perform dialog on the test chosen in the list. */
export function performButtonClick(): void {
    const selectUC = requireEl<HTMLSelectElement>("select-test");
    setCurrentTestIndex(selectUC.value);
    populatePerform();
}
