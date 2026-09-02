import type { Issue, TestRun, TestRunStep, FunctionalTest } from '../types.js';

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

/**
 * How a record marked out of scope reads where its issues would be listed.
 *
 * The perform screen's issue list and the "Issues Encountered" column of both
 * the results dialog and the report all say this, because all three are the
 * same list of what the tester found. Kept beside isOutOfScope so the flag and
 * the words it puts on the page cannot drift apart.
 */
export const OUT_OF_SCOPE_TEXT = 'Out of scope';

/** How a record marked out of scope reads in a Score column. */
export const OUT_OF_SCOPE_SCORE_TEXT = 'N/A';

/** What an unmarked record with nothing recorded against it reads as. */
export const NO_ISSUES_TEXT = 'No issues';

/**
 * True when the tester marked this step or extension outside the test's scope.
 *
 * Only the flag set to true counts. Files written before it existed leave it
 * out entirely, and a hand-edited one may hold anything at all.
 */
export function isOutOfScope(record: { outOfScope?: boolean } | undefined): boolean {
    return record !== undefined && record.outOfScope === true;
}

/**
 * The lines a record's issue list shows: what was found, or the one line that
 * stands in for it.
 *
 * Out of scope wins over anything recorded. A step the tester never performed
 * has no findings to report whatever is stored against it, which is the same
 * reason issuesMap leaves those issues out of the totals; they are kept in the
 * file, and the View Issues button still reaches them.
 */
export function issueLines(record: { issues?: Issue[]; outOfScope?: boolean }): string[] {
    if (isOutOfScope(record)) {
        return [OUT_OF_SCOPE_TEXT];
    }
    const issues = Array.isArray(record.issues) ? record.issues : [];
    return issues.length === 0
        ? [NO_ISSUES_TEXT]
        : issues.map((issue) => String(issue.description || ''));
}

/**
 * Marks a record out of scope, or clears the mark.
 *
 * Clearing removes the field rather than storing false, so a record nobody has
 * marked reads and saves the way one written before the flag existed does.
 * The migration holds the same rule for the other direction.
 */
export function setOutOfScope(record: TestRunStep, outOfScope: boolean): void {
    if (outOfScope) {
        record.outOfScope = true;
    } else {
        delete record.outOfScope;
    }
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
