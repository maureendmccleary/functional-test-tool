import type { TestRun, FunctionalTest } from '../types.js';

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
