import type { Issue, IssueBearing } from '../types.js';

/** Severities an issue can be bucketed under, most severe first. */
const SEVERITIES = [1, 2, 3, 4];

/**
 * Buckets every issue by severity, deduplicating descriptions within a bucket.
 *
 * The map always holds exactly keys 1..4.
 */
export function issuesMap(test: IssueBearing): Map<number, Set<string>> {
    const allIssues = new Map<number, Set<string>>();
    for (const severity of SEVERITIES) {
        allIssues.set(severity, new Set<string>());
    }
    for (const step of test.steps) {
        for (const issue of step.issues) {
            insertIssue(allIssues, issue);
        }
    }
    return allIssues;
}

/** The most severe severity present, or 5 when there are no issues at all. */
export function minimumScore(allIssues: Map<number, Set<string>>): number {
    let result = 5;
    for (const [score, issues] of allIssues) {
        if (issues.size > 0) {
            result = Math.min(result, score);
        }
    }
    return result;
}

/**
 * Adds an issue to its severity bucket.
 *
 * Scores outside 1..4 -- "-1" ("Not Rated"), or anything non-numeric an older
 * or hand-edited file may contain -- have no bucket to go in and are skipped
 * rather than counted.
 */
export function insertIssue(allIssues: Map<number, Set<string>>, issue: Issue): void {
    const bucket = allIssues.get(parseInt(issue.score));
    if (!bucket) {
        return;
    }
    bucket.add(issue.description);
}

/** Descriptions at one severity, joined by a blank line. */
export function issuesText(allIssues: Map<number, Set<string>>, score: number | string): string {
    const bucket = allIssues.get(parseInt(String(score)));
    return bucket ? [...bucket].join("\n\n") : "";
}
