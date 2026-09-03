import type { FunctionalTest } from '../types.js';
import { AT_ALIAS_MAP, normalizeOperatingSystem } from '../domain/migration.js';
import {
    collectSelectedValues, findTypeAheadIndex, normalizeSelectionValues, stepIndex
} from '../domain/selection-utils.js';
import {
    DEFAULT_NEW_TEST_STEPS, addAssistiveTechnologyCopies, emptyFunctionalTest,
    nextTestNumber, testDisplayName
} from '../domain/functional-test.js';
import {
    getCurrentTest, getCurrentTestIndex, getEvaluation, markEvaluationChanged, setCurrentTestIndex
} from '../state/store.js';
import { appendNewlines, fillListbox, toggleMenu } from './controls.js';
import { requireEl, requireForm } from './dom.js';
import { refreshTestList } from './evaluation-view.js';
import { createIcon } from './icons.js';
import { type ScreenName, setSectionTitle, showScreen } from './screens.js';
import { announce, showStatusMessage } from './status.js';
import { getExtensionId, getStepId, getStepNumber } from './step-ids.js';

/** Shown when Save cannot complete the script. */
const NAME_REQUIRED = 'Enter a name for the functional test before saving.';
const TECHNOLOGY_REQUIRED = 'Choose at least one assistive technology before saving.';
const DISCARD_DRAFT =
    'This functional test has not been saved and will be discarded. Leave anyway?';

/**
 * The screen the editor returns to, set by whoever opened it.
 *
 * Edit comes from the landing screen and Add Test from the evaluation screen,
 * and each has to go back where it came from.
 */
let returnScreen: ScreenName = 'landing';

function createStepLabelForEditor(stepNumber: number): HTMLElement {
    const newStepLabel = document.createElement('LABEL');
    newStepLabel.classList.add("label-top");
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
    deleteBtn.appendChild(createIcon("trash"));
    deleteBtn.addEventListener("click", deleteStepButtonClicked);
    deleteBtn.setAttribute("aria-labelledby", `${deleteBtn.id} ${newStepLabel.id}`);
    appendNewlines(stepDiv);
    stepDiv.appendChild(newStepLabel);
    stepDiv.appendChild(newStep);
    stepDiv.appendChild(deleteBtn);
    appendNewlines(stepDiv);
    return stepDiv;
}

/**
 * One extension: its instructions and a delete button.
 *
 * Numbered from 1 in the label, which is the number a step's own wording refers
 * to. Extensions are appended rather than inserted at a chosen position, unlike
 * steps: inserting one would renumber the extensions after it and silently
 * point every step that mentions them at the wrong one.
 */
function addExtensionToEditor(index: number): HTMLElement {
    const test = getCurrentTest();
    const extensionDiv = document.createElement("DIV");
    extensionDiv.setAttribute("id", `extension-div[${index}]`);

    const label = document.createElement("LABEL");
    label.classList.add("label-top");
    label.textContent = `Extension ${index + 1} `;
    label.setAttribute("id", `extension-label[${index}]`);
    label.setAttribute("for", getExtensionId(index));

    const instructions = document.createElement("textarea");
    instructions.setAttribute("id", getExtensionId(index));
    instructions.setAttribute("class", "step-contents");
    instructions.setAttribute("name", "extensions");
    instructions.value = test.extensions[index].instructions;
    instructions.addEventListener('blur', blurFormField);

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.setAttribute("id", `extension-delete[${index}]`);
    deleteBtn.setAttribute("aria-label", "delete");
    deleteBtn.appendChild(createIcon("trash"));
    deleteBtn.addEventListener("click", deleteExtensionButtonClicked);
    deleteBtn.setAttribute("aria-labelledby", `${deleteBtn.id} ${label.id}`);

    appendNewlines(extensionDiv);
    extensionDiv.appendChild(label);
    extensionDiv.appendChild(instructions);
    extensionDiv.appendChild(deleteBtn);
    appendNewlines(extensionDiv);
    return extensionDiv;
}

/** Replaces the rendered extension list with a fresh one built from the model. */
function redrawExtensions(test: FunctionalTest): void {
    const parent = requireEl("extension-list");
    parent.textContent = "";
    (test.extensions || []).forEach((extension, index) => {
        parent.appendChild(addExtensionToEditor(index));
    });
}

/** Gets the id of the control that owns a click handler. */
export function getEventControlId(e: Event): string {
    // A delete button contains an SVG icon, so event.target may be the SVG or
    // one of its paths. currentTarget is the element that owns the handler.
    return (e.currentTarget as HTMLElement | null)?.id
        || (e.target as HTMLElement | null)?.id
        || "";
}

/**
 * Removes an extension, after warning that the ones after it are renumbered.
 *
 * The warning is the point: steps refer to extensions by number in their own
 * wording, and nothing can rewrite that wording automatically.
 */
export function deleteExtensionButtonClicked(e: Event): void {
    const test = getCurrentTest();
    const index = getStepNumber(getEventControlId(e));
    const later = test.extensions.length - index - 1;
    const warning = later > 0
        ? `Delete extension ${index + 1}? The ${later} after it are renumbered, and any step that refers to them by number will need updating.`
        : `Delete extension ${index + 1}? Anything recorded against it will be lost.`;
    if (!window.confirm(warning)) {
        return;
    }

    test.extensions.splice(index, 1);
    markEvaluationChanged();
    redrawExtensions(test);
    requireEl("new-extension-btn").focus();
    showStatusMessage("test-editor-msg", `Extension ${index + 1} was deleted.`);
}

/** Appends a blank extension and puts focus in it. */
export function newExtensionButtonClicked(e: Event): void {
    e.preventDefault();
    const test = getCurrentTest();
    test.extensions.push({ instructions: "" });
    markEvaluationChanged();
    redrawExtensions(test);
    requireEl(getExtensionId(test.extensions.length - 1)).focus();
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
    stepParentDiv.textContent = "";
    stepParentDiv.appendChild(renderSteps(test));
}

/** Removes a step, redraws the list, and moves focus to the step that took its place. */
export function deleteStepButtonClicked(e: Event): void {
    const stepId = getEventControlId(e);
    const test = getCurrentTest();
    const i = getStepNumber(stepId);
    test.steps.splice(i, 1);
    markEvaluationChanged();
    redrawSteps(test);

    // Focus before announcing: the step that had focus has just been removed,
    // and a screen reader discards a pending message when focus moves. The
    // last step deleted leaves nothing to focus, so New Step takes it.
    if (test.steps.length === 0) {
        requireEl("new-step-btn").focus();
    } else {
        requireEl(getStepId(Math.min(i, test.steps.length - 1))).focus();
    }
    showStatusMessage("test-editor-msg", `Step ${(i + 1)} was successfully deleted!`);
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
    } else if (target.name === "extensions") {
        test.extensions[stepNumber].instructions = target.value;
    } else if (target.name === "results") {
        test.steps[stepNumber].results = target.value;
    } else {
        (test as unknown as Record<string, unknown>)[target.name] = target.value;
    }
    markEvaluationChanged();
}

/** Writes the checked assistive technologies back to the test, by field name as above. */
export function changeFormField(e: Event): void {
    const target = e.target as HTMLInputElement;
    const test = getCurrentTest();
    const checkedElements = document.querySelectorAll<HTMLInputElement>(
        `input[type="checkbox"][name="${target.name}"]:checked`
    );
    (test as unknown as Record<string, unknown>)[target.name] = collectSelectedValues(checkedElements);
    markEvaluationChanged();
}

/**
 * How long a typed character stays part of the search before it starts a new
 * one. The value a native listbox uses.
 */
const TYPE_AHEAD_RESET_MS = 500;

/** What has been typed so far, and when the last character arrived. */
let typeAhead = { query: '', at: 0 };

/** The group's checkboxes, and which of them focus is on, or -1. */
function assistiveTechnologyCheckboxes(atMenu: HTMLElement): {
    checkboxes: HTMLInputElement[]; focused: number;
} {
    const checkboxes = [...atMenu.querySelectorAll<HTMLInputElement>("input[type='checkbox']")];
    return { checkboxes, focused: checkboxes.indexOf(document.activeElement as HTMLInputElement) };
}

/**
 * Moves focus through the list with the arrow keys, and to its ends with Home
 * and End.
 *
 * The group needs to handle these itself. Moving focus into it puts a screen
 * reader into focus mode, where it stops browsing the page and hands arrow
 * keys to the control; a bare group of checkboxes does nothing with them, so
 * the list became unnavigable the moment first letter navigation moved focus
 * into it. Handling them here means the list walks the same way in either mode.
 *
 * @returns true when the key was one of these and has been dealt with
 */
function assistiveTechnologyArrowKeys(e: KeyboardEvent, atMenu: HTMLElement): boolean {
    const steps: Record<string, number> = { ArrowDown: 1, ArrowUp: -1 };
    const { checkboxes, focused } = assistiveTechnologyCheckboxes(atMenu);

    let target = -1;
    if (e.key in steps) {
        target = stepIndex(checkboxes.length, focused, steps[e.key]);
    } else if (e.key === 'Home') {
        target = checkboxes.length > 0 ? 0 : -1;
    } else if (e.key === 'End') {
        target = checkboxes.length - 1;
    } else {
        return false;
    }

    if (target !== -1) {
        e.preventDefault();
        checkboxes[target].focus();
    }
    return true;
}

/**
 * Moves focus to the assistive technology matching what was just typed.
 *
 * The list runs to thirty entries, so reaching Windows Narrator by Tab alone
 * means passing everything before it. Space is left alone deliberately: it
 * ticks the focused checkbox, and stealing it would break the control.
 */
function assistiveTechnologyTypeAhead(e: KeyboardEvent, atMenu: HTMLElement): void {
    if (e.key.length !== 1 || e.key === ' ' || e.ctrlKey || e.altKey || e.metaKey) {
        return;
    }

    const now = Date.now();
    typeAhead = {
        query: (now - typeAhead.at > TYPE_AHEAD_RESET_MS ? '' : typeAhead.query) + e.key,
        at: now
    };

    const { checkboxes, focused } = assistiveTechnologyCheckboxes(atMenu);
    const labels = checkboxes.map((checkbox) => checkbox.value);
    const match = findTypeAheadIndex(labels, typeAhead.query, focused === -1 ? 0 : focused);
    if (match !== -1) {
        e.preventDefault();
        checkboxes[match].focus();
    }
}

/**
 * Wires the Assistive Technology disclosure button to the checkbox group it
 * shows and hides. Called once at startup, not from `populateEditor`, so the
 * Escape handler is not re-registered every time a test is opened.
 */
/** What collapsing the list says, since nothing else says it. */
const AT_LIST_COLLAPSED = 'Assistive technology list collapsed.';

/**
 * The role the open list carries, so a screen reader hands it the keyboard.
 *
 * In browse mode a screen reader keeps single letter keys for its own quick
 * navigation, so first letter navigation never reached this group: the keys
 * were spent before the page saw them. There is no way to ask a reader to
 * change mode, but focus entering an application region makes it change by
 * itself, and pass the keys through.
 *
 * The cost of an application region is that browse mode stops working inside
 * it, which is why it is worth so little here and would be worth a lot
 * elsewhere: the container holds nothing but the checkboxes, every one of them
 * is focusable, and each announces its own label when focus arrives. It is
 * added when the list opens and taken off when it closes, so it is present only
 * while the widget really is handling arrows, Home, End and letters.
 */
const AT_LIST_ROLE = 'application';

/**
 * Closes the list, puts focus back on the button, and says it has closed.
 *
 * The announcement is the point. Collapsing from the button leaves focus where
 * it already was, so there is no focus change for a reader to speak, and a
 * screen reader will not reliably report an aria-expanded that flips underneath
 * it: the tester had to ask what was focused to find out whether the list had
 * closed. Escape collapses through here too, so both routes say the same thing.
 *
 * Expanding says nothing extra on purpose. Focus moves into the list and the
 * reader speaks the checkbox it lands on, which is already the answer.
 */
export function collapseAssistiveTechnologies(
    atMenuBtn: HTMLElement, atMenu: HTMLElement
): void {
    atMenuBtn.setAttribute("aria-expanded", "false");
    atMenu.hidden = true;
    atMenu.removeAttribute("role");
    atMenuBtn.focus();
    announce(AT_LIST_COLLAPSED);
}

function addAssistiveTechnologyDisclosureEvents(): void {
    const atMenuBtn = requireEl('test-edit-at-btn');
    const atMenu = requireEl("test-edit-at-menu");

    atMenuBtn.addEventListener("click", (e) => {
        if (atMenuBtn.getAttribute("aria-expanded") === "true") {
            collapseAssistiveTechnologies(atMenuBtn, atMenu);
            return;
        }
        toggleMenu(e);
        // Set before focus moves, so the reader meets the application region as
        // it arrives rather than a moment after.
        atMenu.setAttribute("role", AT_LIST_ROLE);
        // Expanding lands inside the list rather than leaving focus on the
        // button. From the button the arrows and first letter navigation have
        // nothing to act on, so the group looked unresponsive until Tab was
        // pressed. It lands on the technology already assigned, since that is
        // what the scripter came to look at, and on the first entry only when
        // nothing is assigned yet.
        const { checkboxes } = assistiveTechnologyCheckboxes(atMenu);
        const target = checkboxes.find((checkbox) => checkbox.checked) || checkboxes[0];
        if (target) {
            target.focus();
        }
    });
    atMenu.addEventListener('keydown', (e) => {
        const event = e as KeyboardEvent;
        if (event.key === "Escape") {
            collapseAssistiveTechnologies(atMenuBtn, atMenu);
            return;
        }
        if (assistiveTechnologyArrowKeys(event, atMenu)) {
            return;
        }
        assistiveTechnologyTypeAhead(event, atMenu);
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
    showAssistiveTechnologies(test);
    redrawSteps(test);
    redrawExtensions(test);
    // The Summary list is not on this screen. Filling it from here wrote the
    // comments of whichever test was last edited onto the perform screen, where
    // openTestRun now fills it from the run actually being performed.
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
    markEvaluationChanged();
    refreshTestList();
    showAssistiveTechnologies(tests[index]);

    const saved = `Saved as ${testDisplayName(tests[index])}.`;
    const copies = added.length === 0
        ? ""
        : ` Created ${added.length} more: ${added.map(testDisplayName).join(", ")}.`;
    showStatusMessage("test-editor-msg", `${saved}${copies}`, 0);
}

/** Shows the editor, remembering where to go back to. */
function openTestEditor(from: ScreenName): void {
    returnScreen = from;
    showScreen('test');
}

/** True for a script that has never been saved, so has no run of its own yet. */
function isUnsavedDraft(test: FunctionalTest | undefined): boolean {
    return test !== undefined && (!Array.isArray(test.runs) || test.runs.length === 0);
}

/**
 * Leaves the editor for the screen it was opened from.
 *
 * A script that was never saved is dropped on the way out. It has no assistive
 * technology and so no place in the evaluation, and leaving it behind would put
 * a nameless entry in every list of functional tests.
 */
export function backButtonClicked(e: Event): void {
    e.preventDefault();
    const tests = getEvaluation().tests;
    const index = Number(getCurrentTestIndex());

    if (isUnsavedDraft(tests[index])) {
        if (!window.confirm(DISCARD_DRAFT)) {
            return;
        }
        tests.splice(index, 1);
        refreshTestList();
    }
    showScreen(returnScreen);
}

/**
 * Opens the editor on the test chosen in one of the lists.
 *
 * Both screens that list functional tests can edit one, and each has to be
 * returned to afterwards, so the caller says which list it read and where the
 * editor came from.
 */
export function editTest(selectId: string, from: ScreenName): void {
    openTestEditor(from);
    setCurrentTestIndex(requireEl<HTMLSelectElement>(selectId).value);
    populateEditor();
}

/** Opens the editor on the test chosen on the landing screen. */
export function editTestButtonClicked(): void {
    editTest("select-test", 'landing');
}

/**
 * Appends a test with the default blank steps and opens the editor on it.
 *
 * It is numbered past every script already in the evaluation rather than by its
 * position, so deleting a script never gives a later one a number that has
 * already been reported on.
 */
export function newTestButtonClicked(from: ScreenName = 'landing'): void {
    openTestEditor(from);
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
    markEvaluationChanged();
    redrawSteps(test);
    requireEl(getStepId(i)).focus();
}

/** Opens the step-number dialog, offering every insertion point including the end. */
export function newStepButtonClick(e: Event): void {
    e.preventDefault();
    const newStepDialog = requireEl<HTMLDialogElement>("new-step-dialog");
    const test = getCurrentTest();
    const newStepCloseBtn = requireEl("new-step-dialog-close");
    setSectionTitle('Select Step Number To Add');
    newStepDialog.showModal();
    requireEl('add-step-heading').focus();
    newStepCloseBtn.addEventListener("click", (e) => {
        e.preventDefault();
        newStepDialog.close();
    });
    const numbers: number[] = [];
    for (let i = 1; i <= test.steps.length + 1; i++) {
        numbers.push(i);
    }
    requireEl("step-number").textContent = "";
    fillListbox(numbers, "step-number");
    const stepNumberCmb = requireEl<HTMLSelectElement>("step-number");
    stepNumberCmb.selectedIndex = numbers.length - 1;

    const addStepBtn = requireEl("add-step");
    addStepBtn.addEventListener("click", addStepButtonClicked);
}
