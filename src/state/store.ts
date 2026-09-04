import type { Evaluation, TestRun, TestRunStep, FunctionalTest } from '../types.js';

/**
 * The single owner of the application's mutable state.
 *
 * This is deliberately a plain mutable module: no immutability, no events, no
 * reactive layer. The app mutates the evaluation in place everywhere and
 * re-renders by hand. Changing that would be a behavior change, not a refactor.
 */

let evaluation: Evaluation = {
    workspace: '',
    asset: '',
    name: '',
    tests: [],
    score: 0,
    comments: [],
    assistiveTechnologySummaries: []
};

/**
 * A full-page editor works against a private evaluation draft.
 *
 * `evaluation` remains the last committed version. The draft is exposed
 * through the normal getters while an editor is open, which lets the existing
 * UI keep mutating plain objects without leaking those mutations to the rest
 * of the app before Save changes is pressed.
 */
let pageEditDraft: Evaluation | null = null;
let pageEditBaseline = '';

/** Evaluations are JSON data, so the saved representation is also a safe clone boundary. */
function cloneEvaluation(value: Evaluation): Evaluation {
    return JSON.parse(JSON.stringify(value)) as Evaluation;
}

/** The comparison users care about: whether saving would change the evaluation. */
function serializedEvaluation(value: Evaluation): string {
    return JSON.stringify(value);
}

/**
 * Index of the functional test being edited.
 *
 * Assigned a *string* from selectUC.value in some paths and a number in others.
 * Array indexing coerces, so it works. Do not normalize it here; that is a
 * separate, tested change. See ARCHITECTURE.md.
 */
let currentTestIndex: string | number = 0;
let currentStep = 0;

/**
 * Which of the run's two lists the issue dialog is working on.
 *
 * Steps and extensions both record issues, and `currentStep` is the index
 * within whichever of them is in play. Keeping the two apart here is what stops
 * an issue found in extension 2 being filed against step 2.
 */
let currentSection: 'steps' | 'extensions' = 'steps';
let currentIssue = 0;
let currentRunIndex = -1;

/**
 * Whether the evaluation has changed since it was last written to a file.
 *
 * Set when a page draft is committed, or by Perform and dialog handlers that
 * knowingly change the committed evaluation in place. It exists so that
 * starting a new evaluation can warn before discarding work.
 */
let unsavedChanges = false;

/** The evaluation currently loaded. */
export function getEvaluation(): Evaluation {
    return pageEditDraft || evaluation;
}

/** Replaces the loaded evaluation, discarding any previous one. */
export function setEvaluation(value: Evaluation): void {
    evaluation = value;
    pageEditDraft = null;
    pageEditBaseline = '';
    unsavedChanges = false;
}

/** Starts a full-page edit session from the last committed evaluation. */
export function beginPageEditSession(): void {
    pageEditDraft = cloneEvaluation(evaluation);
    pageEditBaseline = serializedEvaluation(pageEditDraft);
}

/**
 * Treats the current draft as the untouched starting state.
 *
 * A new functional test is inserted into the private draft so the existing
 * editor can render it. The blank scaffold must not itself trigger a warning,
 * but dropping the session still removes it because it was never committed.
 */
export function resetPageEditBaseline(): void {
    if (pageEditDraft) {
        pageEditBaseline = serializedEvaluation(pageEditDraft);
    }
}

/** True when the current editor draft differs from its last saved state. */
export function hasPendingPageChanges(): boolean {
    return pageEditDraft !== null
        && serializedEvaluation(pageEditDraft) !== pageEditBaseline;
}

/**
 * Commits the whole editor draft and keeps a clean draft open for further edits.
 */
export function commitPageEditSession(): boolean {
    if (!pageEditDraft || !hasPendingPageChanges()) {
        return false;
    }

    evaluation = cloneEvaluation(pageEditDraft);
    unsavedChanges = true;
    pageEditDraft = cloneEvaluation(evaluation);
    pageEditBaseline = serializedEvaluation(pageEditDraft);
    return true;
}

/** Drops every uncommitted page change and returns to the committed evaluation. */
export function discardPageEditSession(): void {
    pageEditDraft = null;
    pageEditBaseline = '';
}

/** Ends a clean or committed edit session before another screen is shown. */
export function endPageEditSession(): void {
    pageEditDraft = null;
    pageEditBaseline = '';
}

/** True when the evaluation holds changes that have not been written to a file. */
export function hasUnsavedChanges(): boolean {
    return unsavedChanges;
}

/** True when closing the tab would lose either committed or still-pending work. */
export function hasUnsavedWork(): boolean {
    return unsavedChanges || hasPendingPageChanges();
}

/** Records that the evaluation has been changed. */
export function markEvaluationChanged(): void {
    unsavedChanges = true;
}

/** Records that the evaluation has been written to a file. */
export function markEvaluationSaved(): void {
    unsavedChanges = false;
}

/** Index of the test being edited or performed. */
export function getCurrentTestIndex(): string | number {
    return currentTestIndex;
}

/** Selects which test is being edited or performed. */
export function setCurrentTestIndex(value: string | number): void {
    currentTestIndex = value;
}

/** Index, within the current section, of the record the issue dialog is showing. */
export function getCurrentStep(): number {
    return currentStep;
}

/** Selects which step the issue dialog operates on, in the current section. */
export function setCurrentStep(value: number): void {
    currentStep = value;
}

/** Whether the issue dialog is working on a step or on an extension. */
export function getCurrentSection(): 'steps' | 'extensions' {
    return currentSection;
}

/** Selects which of the run's lists the issue dialog operates on. */
export function setCurrentSection(value: 'steps' | 'extensions'): void {
    currentSection = value;
}

/** The run's record -- a step's or an extension's -- that holds the issues in play. */
export function getCurrentRecord(): TestRunStep {
    return getCurrentRun()[currentSection][currentStep];
}

/** Row index of the issue being edited, or the issue count when adding a new one. */
export function getCurrentIssue(): number {
    return currentIssue;
}

/** Selects which issue row an edit applies to. */
export function setCurrentIssue(value: number): void {
    currentIssue = value;
}

/** Index of the selected run within the current test, or -1. */
export function getCurrentRunIndex(): number {
    return currentRunIndex;
}

/** Selects which recorded run is being performed. */
export function setCurrentRunIndex(value: number): void {
    currentRunIndex = value;
}

/** The test currently selected. Throws nothing: an out-of-range index yields undefined. */
export function getCurrentTest(): FunctionalTest {
    return getEvaluation().tests[currentTestIndex as number];
}

/** The run currently selected within the current test. */
export function getCurrentRun(): TestRun {
    return getCurrentTest().runs[currentRunIndex];
}
