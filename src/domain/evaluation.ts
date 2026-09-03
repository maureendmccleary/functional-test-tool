import type {
    AssistiveTechnologySummary, Evaluation, FunctionalTest, SummaryComment, TestRun
} from '../types.js';
import { issuesMap, minimumScore } from './scoring.js';
import { isPerformed } from './test-run.js';

/**
 * Evaluation-wide queries used to assemble the report.
 *
 * The report groups by assistive technology rather than by functional test, so
 * everything here answers "across the whole evaluation" questions that no
 * single test or run can answer on its own.
 */

/** How many issues stand in for a summary nobody has written. */
const TOP_ISSUE_COUNT = 3;

/** The lowest and highest score a run can be given. */
const LOWEST_SCORE = 1;
const HIGHEST_SCORE = 5;

/** One functional test performed with one assistive technology. */
export interface RunPairing {
    test: FunctionalTest;
    run: TestRun;
}

/** Every run recorded against one assistive technology, in evaluation order. */
export interface AssistiveTechnologyGroup {
    assistiveTechnology: string;
    pairings: RunPairing[];
}

/** The Scorecard section: how many runs landed on each score. */
export interface Scorecard {
    totalRuns: number;
    /** Runs at each score, keyed 1..5; every key is always present. */
    countsByScore: Map<number, number>;
    /**
     * The mean of the per-AT overall ratings, or -1 when no rating is set.
     *
     * Not computed from the run scores. The testers assign each AT its own
     * rating, and the report's overall figure is the average of those.
     */
    overallRating: number;
}

/** Trims a name, treating anything that is not a string as absent. */
function cleanName(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

/**
 * Every assistive technology the evaluation refers to, in first-seen order.
 *
 * Reads both the tests' assigned lists and the runs actually recorded, since a
 * run can exist for an AT that was later unassigned from the test.
 */
export function collectAssistiveTechnologies(tests: FunctionalTest[]): string[] {
    const seen: string[] = [];

    const add = (value: unknown): void => {
        const name = cleanName(value);
        if (name !== '' && !seen.includes(name)) {
            seen.push(name);
        }
    };

    (Array.isArray(tests) ? tests : []).forEach((test) => {
        (Array.isArray(test.assistiveTechnologies) ? test.assistiveTechnologies : []).forEach(add);
        (Array.isArray(test.runs) ? test.runs : []).forEach((run) => add(run.assistiveTechnology));
    });

    return seen;
}

/**
 * The evaluation's runs bundled by assistive technology.
 *
 * Unperformed runs are included: every script carries one from the moment it is
 * created, and the detailed section listing them as "Not rated" is how the
 * report shows what is still outstanding. Only the scorecard leaves them out.
 */
export function groupRunsByAssistiveTechnology(evaluation: Evaluation): AssistiveTechnologyGroup[] {
    const groups = new Map<string, RunPairing[]>();

    (evaluation.tests || []).forEach((test) => {
        (test.runs || []).forEach((run) => {
            const name = cleanName(run.assistiveTechnology);
            if (name === '') {
                return;
            }
            const pairing = { test, run };
            const pairings = groups.get(name);
            if (pairings) {
                pairings.push(pairing);
            } else {
                groups.set(name, [pairing]);
            }
        });
    });

    return [...groups.entries()].map(([assistiveTechnology, pairings]) => ({
        assistiveTechnology, pairings
    }));
}

/**
 * The score a run is reported at, or -1 when it has not been performed.
 *
 * The value is derived from the issues rather than read from `run.score`, which
 * goes stale in files whose issues were edited after the score was picked.
 * `run.score` is still consulted for one thing: whether a score was ever picked
 * at all. Without that, a script nobody has opened yet is indistinguishable
 * from a clean pass and would report as a 5.
 */
export function runScore(run: TestRun): number {
    return isPerformed(run) ? minimumScore(issuesMap(run)) : -1;
}

/** Every performed run recorded with one assistive technology. */
function performedRunsFor(evaluation: Evaluation, assistiveTechnology: string): TestRun[] {
    return groupRunsByAssistiveTechnology(evaluation)
        .filter((group) => group.assistiveTechnology === assistiveTechnology)
        .flatMap((group) => group.pairings.map((pairing) => pairing.run))
        .filter((run) => runScore(run) >= LOWEST_SCORE);
}

/**
 * The lowest score any test reached with one assistive technology, or -1 when
 * none has been performed.
 *
 * Offered as the starting point for that technology's overall rating. The
 * tester can raise it, but the worst result is the honest place to begin: an
 * evaluation where one task cannot be completed at all is not a pass whatever
 * the others did.
 */
export function worstScoreFor(evaluation: Evaluation, assistiveTechnology: string): number {
    const scores = performedRunsFor(evaluation, assistiveTechnology).map(runScore);
    return scores.length === 0 ? -1 : Math.min(...scores);
}

/**
 * Every issue recorded with one assistive technology, bucketed by severity.
 *
 * The whole technology's issues merged into one map of the shape issuesMap
 * returns, so a summary can be generated for a technology exactly as one is
 * generated for a single run. Unperformed runs are left out, matching
 * topIssuesFor: a script nobody has scored has not found anything yet.
 */
export function issuesMapFor(
    evaluation: Evaluation, assistiveTechnology: string
): Map<number, Set<string>> {
    const merged = new Map<number, Set<string>>();
    performedRunsFor(evaluation, assistiveTechnology).forEach((run) => {
        issuesMap(run).forEach((descriptions, severity) => {
            const bucket = merged.get(severity) || new Set<string>();
            descriptions.forEach((description) => bucket.add(description));
            merged.set(severity, bucket);
        });
    });
    return merged;
}

/**
 * The most severe issues recorded with one assistive technology, worst first
 * and deduplicated, each keeping the severity it was found at.
 *
 * Fills the overall comments the first time they are opened, so the tester
 * starts from what actually went wrong rather than an empty box.
 */
export function topIssuesFor(
    evaluation: Evaluation, assistiveTechnology: string, limit: number
): SummaryComment[] {
    return [...issuesMapFor(evaluation, assistiveTechnology).entries()]
        .sort((a, b) => a[0] - b[0])
        .flatMap(([severity, descriptions]) => (
            [...descriptions].map((text) => ({ text, severity }))
        ))
        .slice(0, limit);
}

/** The summary stored for one assistive technology, or undefined when none is. */
export function findSummary(
    evaluation: Evaluation, assistiveTechnology: string
): AssistiveTechnologySummary | undefined {
    return (evaluation.assistiveTechnologySummaries || [])
        .find((summary) => summary.assistiveTechnology === assistiveTechnology);
}

/**
 * The rating and issues the report shows for one assistive technology.
 *
 * The tester's own where they have given them, and otherwise the same defaults
 * their dialog would have offered: the worst score that technology reached, and
 * its three most severe issues. A tester who never opened the dialog has still
 * performed the tests, and the report knowing what happened should not depend
 * on their having typed it out again.
 */
export function effectiveSummaryFor(
    evaluation: Evaluation, assistiveTechnology: string
): { overallRating: number; significantIssues: SummaryComment[] } {
    const stored = findSummary(evaluation, assistiveTechnology);
    const rating = stored && stored.overallRating >= LOWEST_SCORE
        ? stored.overallRating
        : worstScoreFor(evaluation, assistiveTechnology);
    const issues = stored && stored.significantIssues.length > 0
        ? stored.significantIssues
        : topIssuesFor(evaluation, assistiveTechnology, TOP_ISSUE_COUNT);
    return { overallRating: rating, significantIssues: issues };
}

/**
 * Counts every performed run by score and averages the per-AT overall ratings.
 *
 * Runs nobody has scored yet are left out entirely rather than counted at their
 * derived score: an evaluation that has been written but not yet performed
 * would otherwise report every script as a 5.
 */
export function buildScorecard(evaluation: Evaluation): Scorecard {
    const countsByScore = new Map<number, number>();
    for (let score = LOWEST_SCORE; score <= HIGHEST_SCORE; score++) {
        countsByScore.set(score, 0);
    }

    let totalRuns = 0;
    (evaluation.tests || []).forEach((test) => {
        (test.runs || []).forEach((run) => {
            const score = runScore(run);
            if (score < LOWEST_SCORE) {
                return;
            }
            totalRuns++;
            countsByScore.set(score, (countsByScore.get(score) || 0) + 1);
        });
    });

    // Effective ratings, so a technology the tester never wrote up still counts
    // at the worst score it reached rather than dropping out of the average.
    const ratings = collectAssistiveTechnologies(evaluation.tests || [])
        .map((assistiveTechnology) => effectiveSummaryFor(evaluation, assistiveTechnology))
        .map((summary) => summary.overallRating)
        .filter((rating) => typeof rating === 'number' && rating >= LOWEST_SCORE);
    const overallRating = ratings.length > 0
        ? ratings.reduce((total, rating) => total + rating, 0) / ratings.length
        : -1;

    return { totalRuns, countsByScore, overallRating };
}
