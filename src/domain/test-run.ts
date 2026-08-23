import type { TestRun, TestRunStep, FunctionalTest } from '../types.js';

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

/** Creates an unscored run with an empty record per step and per extension. */
export function emptyTestRun(test: FunctionalTest, assistiveTechnology: string, operatingSystem: string): TestRun {
    return {
        assistiveTechnology,
        operatingSystem: operatingSystem,
        score: -1,
        comments: [],
        steps: test.steps.map(() => ({ issues: [] })),
        extensions: (Array.isArray(test.extensions) ? test.extensions : []).map(() => ({ issues: [] }))
    };
}

/** Pads or truncates a run's records to match what the test now has. */
function matchLength(records: TestRunStep[], length: number): void {
    while (records.length < length) {
        records.push({ issues: [] });
    }
    records.length = length;
}

/**
 * Makes the performance's records match the functional test's steps and
 * extensions.
 *
 * Truncating discards any issues recorded against removed steps or extensions.
 * That is current behavior and is relied on when either is deleted in the
 * editor.
 */
export function ensureTestRunShape(test: FunctionalTest, run: TestRun): void {
    if (!Array.isArray(run.extensions)) {
        run.extensions = [];
    }
    matchLength(run.steps, test.steps.length);
    matchLength(run.extensions, (Array.isArray(test.extensions) ? test.extensions : []).length);
}
