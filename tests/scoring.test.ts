import { describe, expect, test } from 'vitest';
import type { Issue } from '../src/types.js';
import { insertIssue, issuesMap, issuesText, minimumScore } from '../src/domain/scoring.js';
import { normalizeEvaluation } from '../src/domain/migration.js';
import { loadFixture } from './helpers/fixtures.js';

/**
 * issue.score is a *string* in the data files ("1".."4") while
 * run.score is a number. That mixed representation is load-bearing --
 * see ARCHITECTURE.md.
 */
function issue(description: string, score: string): Issue {
    return { description, findingURL: '', score };
}

describe('issuesMap', () => {
    test('always has buckets 1 through 4, and only those', () => {
        const map = issuesMap({ steps: [] });
        expect([...map.keys()]).toEqual([1, 2, 3, 4]);
        expect([...map.values()].map((set) => set.size)).toEqual([0, 0, 0, 0]);
    });

    test('buckets by numeric value of the string score', () => {
        const map = issuesMap({
            steps: [
                { issues: [issue('a', '1'), issue('b', '3')] },
                { issues: [issue('c', '3')] }
            ]
        });
        expect([...map.get(1)!]).toEqual(['a']);
        expect([...map.get(3)!]).toEqual(['b', 'c']);
        expect(map.get(2)!.size).toBe(0);
    });

    test('deduplicates by description, keeping first-seen order', () => {
        const map = issuesMap({
            steps: [
                { issues: [issue('same', '2'), issue('other', '2')] },
                { issues: [issue('same', '2')] }
            ]
        });
        expect([...map.get(2)!]).toEqual(['same', 'other']);
    });

    test('keeps the same description in two buckets when scores differ', () => {
        const map = issuesMap({ steps: [{ issues: [issue('dup', '1'), issue('dup', '4')] }] });
        expect([...map.get(1)!]).toEqual(['dup']);
        expect([...map.get(4)!]).toEqual(['dup']);
    });
});

describe('insertIssue', () => {
    test('skips scores outside 1-4 instead of throwing', () => {
        // "-1" ("Not Rated") is offered in the issue-scores list and blocked at
        // save time, but legacy and hand-edited files can still contain it.
        const map = issuesMap({ steps: [] });
        expect(() => insertIssue(map, issue('not rated', '-1'))).not.toThrow();
        expect(() => insertIssue(map, issue('out of range', '5'))).not.toThrow();
        expect(() => insertIssue(map, issue('not a number', 'high'))).not.toThrow();
        expect([...map.values()].map((set) => set.size)).toEqual([0, 0, 0, 0]);
    });

    test('an unscored issue does not affect the overall score', () => {
        const map = issuesMap({ steps: [{ issues: [issue('rated', '3'), issue('unrated', '-1')] }] });
        expect(minimumScore(map)).toBe(3);
    });
});

describe('minimumScore', () => {
    test('returns 5 when there are no issues at all', () => {
        expect(minimumScore(issuesMap({ steps: [] }))).toBe(5);
    });

    test('returns the most severe populated bucket', () => {
        const map = issuesMap({ steps: [{ issues: [issue('a', '4'), issue('b', '2')] }] });
        expect(minimumScore(map)).toBe(2);
    });
});

describe('issuesText', () => {
    test('returns an empty string for an empty or unknown bucket', () => {
        expect(issuesText(issuesMap({ steps: [] }), 1)).toBe('');
        expect(issuesText(issuesMap({ steps: [] }), 9)).toBe('');
    });

    test('joins descriptions with a blank line', () => {
        const map = issuesMap({ steps: [{ issues: [issue('first', '2'), issue('second', '2')] }] });
        expect(issuesText(map, 2)).toBe('first\n\nsecond');
    });

    test('accepts a string score', () => {
        const map = issuesMap({ steps: [{ issues: [issue('only', '3')] }] });
        expect(issuesText(map, '3')).toBe('only');
    });
});

describe('scoring a real evaluation', () => {
    const evaluation = normalizeEvaluation(loadFixture('evaluation-with-runs'));
    const runs = evaluation.tests.flatMap((t) => t.runs);

    test('unique issue counts per severity', () => {
        const counts = runs.map((run) => {
            const map = issuesMap(run);
            return [1, 2, 3, 4].map((score) => map.get(score)!.size);
        });
        // One run per script, and the search script was split in two.
        expect(counts).toEqual([
            [2, 3, 2, 1],   // search, NVDA
            [0, 3, 2, 1],   // search, JAWS -- the blocking issues do not occur
            [0, 0, 0, 0],   // renew, no issues found
            [1, 3, 1, 0]    // preferences, NVDA
        ]);
    });

    test('recomputed scores', () => {
        expect(runs.map((run) => minimumScore(issuesMap(run)))).toEqual([1, 2, 5, 1]);
    });

    test('a run with no issues scores 5', () => {
        const renew = evaluation.tests[2].runs[0];
        expect(minimumScore(issuesMap(renew))).toBe(5);
    });

    test('the stored score can disagree with the recomputed one', () => {
        // Stored scores are only refreshed when Generate Summary is clicked, so
        // a file can drift. Do not "fix" this by recomputing on load.
        const jaws = evaluation.tests[1].runs[0];
        expect(jaws.score).toBe(1);
        expect(minimumScore(issuesMap(jaws))).toBe(2);
    });
});
