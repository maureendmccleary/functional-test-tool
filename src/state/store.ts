import type { Evaluation, TestRun, FunctionalTest } from '../types.js';

/**
 * The single owner of the application's mutable state.
 *
 * This is deliberately a plain mutable module: no immutability, no events, no
 * reactive layer. The app mutates the evaluation in place everywhere and
 * re-renders by hand. Changing that would be a behavior change, not a refactor.
 */

let evaluation: Evaluation = {
    tests: [],
    score: 0,
    comments: []
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
let currentIssue = 0;
let currentRunIndex = -1;

/** The evaluation currently loaded. */
export function getEvaluation(): Evaluation {
    return evaluation;
}

/** Replaces the loaded evaluation, discarding any previous one. */
export function setEvaluation(value: Evaluation): void {
    evaluation = value;
}

/** Index of the test being edited or performed. */
export function getCurrentTestIndex(): string | number {
    return currentTestIndex;
}

/** Selects which test is being edited or performed. */
export function setCurrentTestIndex(value: string | number): void {
    currentTestIndex = value;
}

/** Index of the step whose issues the issue dialog is showing. */
export function getCurrentStep(): number {
    return currentStep;
}

/** Selects which step the issue dialog operates on. */
export function setCurrentStep(value: number): void {
    currentStep = value;
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
