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
 * Set by the handlers that knowingly change the evaluation rather than by the
 * store itself: everything mutates the evaluation in place, so there is no one
 * place a write passes through. It exists so that starting a new evaluation can
 * warn before discarding work, and it errs towards not warning.
 */
let unsavedChanges = false;

/** The evaluation currently loaded. */
export function getEvaluation(): Evaluation {
    return evaluation;
}

/** Replaces the loaded evaluation, discarding any previous one. */
export function setEvaluation(value: Evaluation): void {
    evaluation = value;
    unsavedChanges = false;
}

/** True when the evaluation holds changes that have not been written to a file. */
export function hasUnsavedChanges(): boolean {
    return unsavedChanges;
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
    return evaluation.tests[currentTestIndex as number];
}

/** The run currently selected within the current test. */
export function getCurrentRun(): TestRun {
    return getCurrentTest().runs[currentRunIndex];
}
