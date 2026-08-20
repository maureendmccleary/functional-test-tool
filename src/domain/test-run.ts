import type { TestRun, FunctionalTest } from '../types.js';

/** The lowest score a tester can assign. Below it means no score was chosen. */
const LOWEST_SCORE = 1;

/**
 * True once the tester has chosen a score for this run.
 *
 * Every script carries a run from the moment it is created, so an empty issue
 * list cannot tell a clean pass from work not yet started. Picking a score is
 * the tester's signal that the run happened, which is why the Perform dialog no
 * longer fills the score in on their behalf. Unperformed runs are left out of
 * the scorecard.
 */
export function isPerformed(run: TestRun): boolean {
    return typeof run.score === 'number' && run.score >= LOWEST_SCORE;
}

/** Creates an unscored run with one empty step per step of the test. */
export function emptyTestRun(test: FunctionalTest, assistiveTechnology: string, operatingSystem: string): TestRun {
    return {
        assistiveTechnology,
        operatingSystem: operatingSystem,
        score: -1,
        comments: [],
        steps: test.steps.map(() => ({ issues: [] }))
    };
}

/**
 * Makes the performance's step count match the functional test's.
 *
 * Truncating discards any issues recorded against removed steps. That is
 * current behavior and is relied on when steps are deleted in the editor.
 */
export function ensureTestRunStepCount(test: FunctionalTest, run: TestRun): void {
    while (run.steps.length < test.steps.length) {
        run.steps.push({ issues: [] });
    }
    run.steps.length = test.steps.length;
}

/** Creates the runs array as a side effect when it is missing. */
export function findTestRunIndex(test: FunctionalTest, assistiveTechnology: string, operatingSystem: string): number {
    if (!Array.isArray(test.runs)) {
        test.runs = [];
    }
    return test.runs.findIndex((run) => run.assistiveTechnology === assistiveTechnology
            && run.operatingSystem === operatingSystem);
}
