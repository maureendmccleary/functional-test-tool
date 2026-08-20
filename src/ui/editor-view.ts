import type { FunctionalTest } from '../types.js';
import { AT_ALIAS_MAP, normalizeOperatingSystem } from '../domain/migration.js';
import { collectSelectedValues, normalizeSelectionValues } from '../domain/selection-utils.js';
import {
    DEFAULT_NEW_TEST_STEPS, addAssistiveTechnologyCopies, emptyFunctionalTest, getTestComments,
    nextTestNumber, testDisplayName
} from '../domain/functional-test.js';
import {
    getCurrentTest, getCurrentTestIndex, getEvaluation, setCurrentTestIndex
} from '../state/store.js';
import { appendNewlines, fillListbox, toggleMenu } from './controls.js';
import { requireEl, requireForm } from './dom.js';
import { refreshTestList } from './evaluation-view.js';
import { showStatusMessage } from './status.js';
import { getStepId, getStepNumber } from './step-ids.js';

/** Shown when Save cannot complete the script. */
const NAME_REQUIRED = 'Enter a name for the functional test before saving.';
const TECHNOLOGY_REQUIRED = 'Choose at least one assistive technology before saving.';

function createStepLabelForEditor(stepNumber: number): HTMLElement {
    const newStepLabel = document.createElement('LABEL');
    newStepLabel.setAttribute("style", "vertical-align:top");
    newStepLabel.textContent = "Step " + (stepNumber + 1) + " ";
    const newStepLabelId = `step-label[${stepNumber}]`;
    newStepLabel.setAttribute("id", newStepLabelId);
    newStepLabel.setAttribute('for', getStepId(stepNumber));
    return newStepLabel;
}

function createStepForEditor(stepNumber: number): HTMLTextAreaElement {
    const test = getCurrentTest();
    const newStep = document.createElement('textarea');
    newStep.setAttribute("id", getStepId(stepNumber));
    newStep.setAttribute("class", "step-contents");
    newStep.value = test.steps[stepNumber].instructions;
    newStep.setAttribute("name", "steps");
    newStep.addEventListener('blur', blurFormField);
    return newStep;
}

function addStepToEditor(stepNumber: number): HTMLElement {
    const stepDiv = document.createElement("DIV");
    stepDiv.setAttribute("id", `step-div[${stepNumber}]`);
    const newStepLabel = createStepLabelForEditor(stepNumber);
    const newStep = createStepForEditor(stepNumber);
    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.setAttribute("id", `step-delete[${stepNumber}]`);
    deleteBtn.setAttribute("aria-label", "delete");
    const deleteIcon = document.createElement("span");
    deleteIcon.classList.add("fa", "fa-trash");
    deleteBtn.appendChild(deleteIcon);
    deleteBtn.addEventListener("click", deleteStepButtonClicked);
    deleteBtn.setAttribute("aria-labelledby", `${deleteBtn.id} ${newStepLabel.id}`);
    appendNewlines(stepDiv);
    stepDiv.appendChild(newStepLabel);
    stepDiv.appendChild(newStep);
    stepDiv.appendChild(deleteBtn);
    appendNewlines(stepDiv);
    return stepDiv;
}

/** Builds the editable step list for a test. */
export function renderSteps(test: FunctionalTest): HTMLElement {
    const stepParentDiv = document.createElement("div");

    for (let i = 0; i < test.steps.length; i++) {
        stepParentDiv.appendChild(addStepToEditor(i));
    }
    return stepParentDiv;
}

/** Replaces the rendered step list with a fresh one built from the model. */
function redrawSteps(test: FunctionalTest): void {
    const stepParentDiv = requireEl("step-list");
    stepParentDiv.innerHTML = "";
    stepParentDiv.appendChild(renderSteps(test));
}

/** Removes a step, redraws the list, and moves focus to the step that took its place. */
export function deleteStepButtonClicked(e: Event): void {
    const stepId = (e.target as HTMLElement).id;
    const test = getCurrentTest();
    const i = getStepNumber(stepId);
    test.steps.splice(i, 1);
    redrawSteps(test);
    requireEl("test-editor-msg").innerHTML = "";
    requireEl("test-editor-msg").innerHTML = `Step ${(i + 1)} was successfully deleted!`;
    if (test.steps.length <= i) {
        requireEl(getStepId(test.steps.length - 1)).focus();
    }
    else {
        requireEl(getStepId(i)).focus();
    }
}

/**
 * Writes an edited field back to the test when focus leaves it.
 *
 * The field's `name` attribute is the property it writes, so every input in the
 * editor must be named for the property it edits. Naming them for the spellings
 * older files used -- `startlocation`, `oses` -- wrote fields nothing reads,
 * and the edit was lost the next time the editor was opened. The migration is
 * where old spellings are understood; see domain/migration.ts.
 */
export function blurFormField(e: Event): void {
    const target = e.target as HTMLInputElement | HTMLTextAreaElement;
    const test = getCurrentTest();
    const stepNumber = getStepNumber(target.id);
    if (target.name === "steps") {
        // In place: rebuilding the step would drop its recorded issues.
        test.steps[stepNumber].instructions = target.value;
    } else if (target.name === "results") {
        test.steps[stepNumber].results = target.value;
    } else {
        (test as unknown as Record<string, unknown>)[target.name] = target.value;
    }
}

/** Writes the checked assistive technologies back to the test, by field name as above. */
export function changeFormField(e: Event): void {
    const target = e.target as HTMLInputElement;
    const test = getCurrentTest();
    const checkedElements = document.querySelectorAll<HTMLInputElement>(
        `input[type="checkbox"][name="${target.name}"]:checked`
    );
    (test as unknown as Record<string, unknown>)[target.name] = collectSelectedValues(checkedElements);
}

/**
 * Wires the Assistive Technology disclosure button to the checkbox group it
 * shows and hides. Called once at startup, not from `populateEditor`, so the
 * Escape handler is not re-registered every time a test is opened.
 */
function addAssistiveTechnologyDisclosureEvents(): void {
    const atMenuBtn = requireEl('test-edit-at-btn');
    const atMenu = requireEl("test-edit-at-menu");

    atMenuBtn.addEventListener("click", toggleMenu);
    atMenu.addEventListener('keydown', (e) => {
        if ((e as KeyboardEvent).key === "Escape") {
            atMenuBtn.setAttribute("aria-expanded", "false");
            atMenu.hidden = true;
            atMenuBtn.focus(); // Return focus to button
        }
    });
}

/** Wires blur and change handlers onto every field of the editor form. */
export function addFormEvents(): void {
    const form = requireForm("testEditor");
    form.addEventListener('submit', (e) => {
        e.preventDefault();
    });
    const formelements = form.elements;
    for (const element of formelements) {
        const field = element as HTMLInputElement;
        if (field.tagName === "INPUT" && field.type !== "checkbox" || field.tagName === "TEXTAREA") {
            field.addEventListener('blur', blurFormField);
        } else if (field.tagName === "INPUT" && field.type === "checkbox") {
            field.addEventListener('change', changeFormField);
        }
    }
    addAssistiveTechnologyDisclosureEvents();
}

/** Fills the editor with the current test and renders its steps and comments. */
export function populateEditor(): void {
    const test = getCurrentTest();
    requireEl<HTMLInputElement>("test-edit-start-location").value = test.startLocation;
    requireEl("test-edit-name").focus();
    requireEl<HTMLInputElement>("test-edit-name").value = test.name;
    requireEl<HTMLInputElement>("test-edit-goal").value = test.goal;
    requireEl<HTMLInputElement>("test-edit-operator").value = test.operator || "";
    requireEl<HTMLInputElement>("test-edit-application").value = test.application || "";
    requireEl<HTMLInputElement>("test-edit-operating-system").value = normalizeOperatingSystem(test.operatingSystem);
    redrawSteps(test);
    const summaryList = requireEl("summary-list");
    while (summaryList.firstChild) {
        summaryList.removeChild(summaryList.firstChild);
    }
    const testComments = getTestComments(test);
    if (testComments.length > 0) {
        testComments.forEach((comment) => {
            const summaryLi = document.createElement("LI");
            summaryLi.innerHTML = comment;
            summaryList.appendChild(summaryLi);
        });
    }
    else {
        const summaryLi = document.createElement("LI");
        summaryLi.innerHTML = "No Issues";
        summaryList.appendChild(summaryLi);
    }
}

/**
 * Ticks the checkbox of every assistive technology assigned to the test.
 *
 * Redrawn on its own after a save, because completing a script leaves the
 * editor on the copy for one technology and the others must no longer look
 * checked.
 */
function showAssistiveTechnologies(test: FunctionalTest): void {
    const atMenu = requireEl("test-edit-at-menu");
    const atOptions = atMenu.querySelectorAll("label");
    const existingAts = normalizeSelectionValues(test.assistiveTechnologies || [], AT_ALIAS_MAP);
    test.assistiveTechnologies = existingAts;

    for (let j = 0; j < atOptions.length; j++) {
        const checkbox = atOptions[j].querySelector<HTMLInputElement>("input[type='checkbox']");
        if (!checkbox) {
            continue;
        }
        checkbox.checked = existingAts.some((value) => value === checkbox.value || value === atOptions[j].textContent?.trim());
    }
}

/**
 * Completes the script: one functional test for each assistive technology.
 *
 * This is where a script written once becomes the several tests that have to be
 * performed, which is the whole point of assigning more than one technology.
 * The editor stays where it is and reports what was created; the evaluation is
 * written to a file from the evaluation screen, not here.
 */
export function saveTestButtonClicked(e: Event): void {
    e.preventDefault();
    const tests = getEvaluation().tests;
    const index = Number(getCurrentTestIndex());
    const test = tests[index];

    if ((test.name || "").trim() === "") {
        showStatusMessage("test-editor-msg", NAME_REQUIRED, 0);
        requireEl("test-edit-name").focus();
        return;
    }
    if (test.assistiveTechnologies.length === 0) {
        showStatusMessage("test-editor-msg", TECHNOLOGY_REQUIRED, 0);
        requireEl("test-edit-at-btn").focus();
        return;
    }

    const added = addAssistiveTechnologyCopies(tests, index);
    refreshTestList();
    showAssistiveTechnologies(tests[index]);

    const saved = `Saved as ${testDisplayName(tests[index])}.`;
    const copies = added.length === 0
        ? ""
        : ` Created ${added.length} more: ${added.map(testDisplayName).join(", ")}.`;
    showStatusMessage("test-editor-msg", `${saved}${copies}`, 0);
}

/** Reveals the editor form and its New Step control. */
function activateEditorForm(): void {
    requireEl('test-editor-form').classList.remove('inactive');
    requireEl("new-step-btn").classList.remove("inactive");
}

/** Opens the editor on the test chosen in the list. */
export function editTestButtonClicked(): void {
    activateEditorForm();
    const selectUC = requireEl<HTMLSelectElement>("select-test");
    setCurrentTestIndex(selectUC.value);
    populateEditor();
}

/**
 * Appends a test with the default blank steps and opens the editor on it.
 *
 * It is numbered past every script already in the evaluation rather than by its
 * position, so deleting a script never gives a later one a number that has
 * already been reported on.
 */
export function newTestButtonClicked(): void {
    activateEditorForm();
    const evaluation = getEvaluation();
    setCurrentTestIndex(evaluation.tests.length);
    evaluation.tests.push(
        emptyFunctionalTest(DEFAULT_NEW_TEST_STEPS, nextTestNumber(evaluation.tests))
    );
    populateEditor();
    requireEl("test-edit-name").focus();
}

/** Inserts a blank step at the chosen position and focuses it. */
export function addStepButtonClicked(): void {
    requireEl<HTMLDialogElement>("new-step-dialog").close();
    const test = getCurrentTest();
    const newStep = { instructions: "", issues: [] };
    const i = Number(requireEl<HTMLSelectElement>("step-number").value);
    test.steps.splice(i, 0, newStep);
    redrawSteps(test);
    requireEl(getStepId(i)).focus();
}

/** Opens the step-number dialog, offering every insertion point including the end. */
export function newStepButtonClick(e: Event): void {
    e.preventDefault();
    const newStepDialog = requireEl<HTMLDialogElement>("new-step-dialog");
    const test = getCurrentTest();
    const newStepCloseBtn = requireEl("new-step-dialog-close");
    newStepDialog.showModal();
    newStepCloseBtn.addEventListener("click", (e) => {
        e.preventDefault();
        newStepDialog.close();
    });
    const numbers: number[] = [];
    for (let i = 1; i <= test.steps.length + 1; i++) {
        numbers.push(i);
    }
    requireEl("step-number").innerHTML = "";
    fillListbox(numbers, "step-number");
    const stepNumberCmb = requireEl<HTMLSelectElement>("step-number");
    stepNumberCmb.selectedIndex = numbers.length - 1;

    const addStepBtn = requireEl("add-step");
    addStepBtn.addEventListener("click", addStepButtonClicked);
}
