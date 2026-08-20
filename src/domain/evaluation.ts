import type {
    AssistiveTechnologySummary, Evaluation, FunctionalTest, Issue, TestRun
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

/**
 * The score for a single step: the mean of its issue scores, rounded down, or
 * 5 when it has none.
 *
 * Deliberately *not* `minimumScore`, which is what `runScore` and the perform
 * dialog use. A step holding one stopper and three minor issues averages to 2
 * here while the run it belongs to still scores 1. That is the reporting rule
 * this export has always used, and changing it is a scoring change, not a
 * cleanup.
 *
 * A score outside 1..5 counts as itself, and a non-numeric one as 0, both of
 * which can drag the average below 1. Issue scores are validated on entry, so
 * this only shows up in hand-edited files.
 */
export function stepScore(step: { issues: Issue[] }): number {
    const issues = Array.isArray(step.issues) ? step.issues : [];
    if (issues.length === 0) {
        return HIGHEST_SCORE;
    }
    const total = issues.reduce((sum, issue) => sum + (parseInt(issue.score) || 0), 0);
    return Math.floor(total / issues.length);
}

/** The summary stored for one assistive technology, or undefined when none is. */
export function findSummary(
    evaluation: Evaluation, assistiveTechnology: string
): AssistiveTechnologySummary | undefined {
    return (evaluation.assistiveTechnologySummaries || [])
        .find((summary) => summary.assistiveTechnology === assistiveTechnology);
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

    const ratings = (evaluation.assistiveTechnologySummaries || [])
        .map((summary) => summary.overallRating)
        .filter((rating) => typeof rating === 'number' && rating >= LOWEST_SCORE);
    const overallRating = ratings.length > 0
        ? ratings.reduce((total, rating) => total + rating, 0) / ratings.length
        : -1;

    return { totalRuns, countsByScore, overallRating };
}
