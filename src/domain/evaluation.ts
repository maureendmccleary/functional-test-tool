import type {
    AssistiveTechnologySummary, Evaluation, FunctionalTest, Issue, TestRun
} from '../types.js';
import { issuesMap, minimumScore } from './scoring.js';

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
    /**
     * The test's 1-based position in the evaluation, which the report prints
     * as the use case number.
     *
     * Taken from the evaluation, not from the position within the group, so a
     * script keeps the same number under every assistive technology it was
     * performed with.
     */
    position: number;
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
 * Only ATs with at least one recorded run appear: the report's detailed
 * section has nothing to show for an AT that was assigned but never performed.
 */
export function groupRunsByAssistiveTechnology(evaluation: Evaluation): AssistiveTechnologyGroup[] {
    const groups = new Map<string, RunPairing[]>();

    (evaluation.tests || []).forEach((test, testIndex) => {
        (test.runs || []).forEach((run) => {
            const name = cleanName(run.assistiveTechnology);
            if (name === '') {
                return;
            }
            const pairing = { test, run, position: testIndex + 1 };
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
 * The score a run is reported at.
 *
 * Derived from the issues rather than read from `run.score`, which is only
 * written while the perform dialog is open and is stale in files whose issues
 * were edited afterwards.
 */
export function runScore(run: TestRun): number {
    return minimumScore(issuesMap(run));
}

/**
 * The score for a single step: its most severe issue, or 5 when it has none.
 *
 * The same rule as `runScore` and as the perform dialog, so a step's score and
 * the use case's score are read off the same scale.
 */
export function stepScore(step: { issues: Issue[] }): number {
    return minimumScore(issuesMap({ steps: [step] }));
}

/** The summary stored for one assistive technology, or undefined when none is. */
export function findSummary(
    evaluation: Evaluation, assistiveTechnology: string
): AssistiveTechnologySummary | undefined {
    return (evaluation.assistiveTechnologySummaries || [])
        .find((summary) => summary.assistiveTechnology === assistiveTechnology);
}

/** Counts every recorded run by score and averages the per-AT overall ratings. */
export function buildScorecard(evaluation: Evaluation): Scorecard {
    const countsByScore = new Map<number, number>();
    for (let score = LOWEST_SCORE; score <= HIGHEST_SCORE; score++) {
        countsByScore.set(score, 0);
    }

    let totalRuns = 0;
    (evaluation.tests || []).forEach((test) => {
        (test.runs || []).forEach((run) => {
            totalRuns++;
            const score = runScore(run);
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
