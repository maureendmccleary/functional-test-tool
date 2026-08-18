import { describe, expect, test } from 'vitest';
import type { Evaluation, FunctionalTest, Issue } from '../src/types.js';
import {
    buildScorecard, collectAssistiveTechnologies, findSummary,
    groupRunsByAssistiveTechnology, runScore, stepScore
} from '../src/domain/evaluation.js';

/** An issue at the given severity, which is all the scoring cares about. */
function issue(score: string): Issue {
    return { description: `issue scored ${score}`, findingURL: '', score };
}

/**
 * A test with one run per entry of `runIssues`, each run named for its
 * assistive technology and carrying a single step holding those issues.
 */
function testWithRuns(name: string, runIssues: Record<string, Issue[]>): FunctionalTest {
    return {
        name,
        goal: '',
        startLocation: '',
        operatingSystem: 'Windows',
        assistiveTechnologies: Object.keys(runIssues),
        steps: [{ instructions: 'step one', issues: [] }],
        comments: [],
        runs: Object.entries(runIssues).map(([assistiveTechnology, issues]) => ({
            assistiveTechnology,
            operatingSystem: 'Windows',
            score: -1,
            comments: [],
            steps: [{ issues }]
        }))
    };
}

function evaluationOf(tests: FunctionalTest[]): Evaluation {
    return { tests, score: 0, comments: [], assistiveTechnologySummaries: [] };
}

describe('collectAssistiveTechnologies', () => {
    test('reads the assigned lists in first seen order', () => {
        const tests = [
            testWithRuns('one', {}),
            testWithRuns('two', {})
        ];
        tests[0].assistiveTechnologies = ['NVDA', 'JAWS'];
        tests[1].assistiveTechnologies = ['JAWS', 'TalkBack'];
        expect(collectAssistiveTechnologies(tests)).toEqual(['NVDA', 'JAWS', 'TalkBack']);
    });

    test('includes an assistive technology only a run refers to', () => {
        const subject = testWithRuns('one', { VoiceOver: [] });
        subject.assistiveTechnologies = [];
        expect(collectAssistiveTechnologies([subject])).toEqual(['VoiceOver']);
    });

    test('skips blank names and tolerates missing arrays', () => {
        const subject = { assistiveTechnologies: ['', '   ', 'JAWS'] } as unknown as FunctionalTest;
        expect(collectAssistiveTechnologies([subject])).toEqual(['JAWS']);
        expect(collectAssistiveTechnologies(undefined as unknown as FunctionalTest[])).toEqual([]);
    });
});

describe('groupRunsByAssistiveTechnology', () => {
    test('gathers the runs of every test under its assistive technology', () => {
        const evaluation = evaluationOf([
            testWithRuns('one', { NVDA: [], JAWS: [] }),
            testWithRuns('two', { NVDA: [] })
        ]);
        const groups = groupRunsByAssistiveTechnology(evaluation);
        expect(groups.map((group) => group.assistiveTechnology)).toEqual(['NVDA', 'JAWS']);
        expect(groups[0].pairings.map((pairing) => pairing.test.name)).toEqual(['one', 'two']);
        expect(groups[1].pairings).toHaveLength(1);
    });

    test('omits an assistive technology that was never performed', () => {
        const subject = testWithRuns('one', { NVDA: [] });
        subject.assistiveTechnologies = ['NVDA', 'JAWS'];
        const groups = groupRunsByAssistiveTechnology(evaluationOf([subject]));
        expect(groups.map((group) => group.assistiveTechnology)).toEqual(['NVDA']);
    });

    test('numbers each test by its place in the evaluation, not in the group', () => {
        const evaluation = evaluationOf([
            testWithRuns('one', { NVDA: [] }),
            testWithRuns('two', { JAWS: [] }),
            testWithRuns('three', { NVDA: [], JAWS: [] })
        ]);
        const groups = groupRunsByAssistiveTechnology(evaluation);
        const positionsFor = (at: string) => groups
            .find((group) => group.assistiveTechnology === at)!
            .pairings.map((pairing) => pairing.position);
        // "three" is third in the evaluation, so it is 3 under both ATs even
        // though it is only the second use case listed under JAWS.
        expect(positionsFor('NVDA')).toEqual([1, 3]);
        expect(positionsFor('JAWS')).toEqual([2, 3]);
    });

    test('skips runs with no assistive technology recorded', () => {
        const evaluation = evaluationOf([testWithRuns('one', { '': [], NVDA: [] })]);
        expect(groupRunsByAssistiveTechnology(evaluation)).toHaveLength(1);
    });
});

describe('runScore', () => {
    test('is 5 when the run recorded no issues', () => {
        const subject = testWithRuns('one', { NVDA: [] });
        expect(runScore(subject.runs[0])).toBe(5);
    });

    test('is the most severe issue present', () => {
        const subject = testWithRuns('one', { NVDA: [issue('3'), issue('1'), issue('4')] });
        expect(runScore(subject.runs[0])).toBe(1);
    });
});

describe('stepScore', () => {
    test('is 5 for a step with no issues', () => {
        expect(stepScore({ issues: [] })).toBe(5);
    });

    test('is the most severe issue on that step', () => {
        expect(stepScore({ issues: [issue('4'), issue('2')] })).toBe(2);
    });

    test('ignores issues scored outside the scale', () => {
        expect(stepScore({ issues: [issue('-1')] })).toBe(5);
    });
});

describe('buildScorecard', () => {
    test('counts every run by its score', () => {
        const evaluation = evaluationOf([
            testWithRuns('one', { NVDA: [issue('1')], JAWS: [issue('3')] }),
            testWithRuns('two', { NVDA: [], JAWS: [issue('1')] })
        ]);
        const scorecard = buildScorecard(evaluation);
        expect(scorecard.totalRuns).toBe(4);
        expect(scorecard.countsByScore.get(1)).toBe(2);
        expect(scorecard.countsByScore.get(3)).toBe(1);
        expect(scorecard.countsByScore.get(5)).toBe(1);
        expect(scorecard.countsByScore.get(2)).toBe(0);
        expect(scorecard.countsByScore.get(4)).toBe(0);
    });

    test('averages the per assistive technology ratings, not the run scores', () => {
        const evaluation = evaluationOf([testWithRuns('one', { NVDA: [], JAWS: [] })]);
        evaluation.assistiveTechnologySummaries = [
            { assistiveTechnology: 'NVDA', overallRating: 1, significantIssues: [] },
            { assistiveTechnology: 'JAWS', overallRating: 2, significantIssues: [] }
        ];
        const scorecard = buildScorecard(evaluation);
        expect(scorecard.countsByScore.get(5)).toBe(2);
        expect(scorecard.overallRating).toBe(1.5);
    });

    test('reports -1 when no rating has been assigned', () => {
        const evaluation = evaluationOf([testWithRuns('one', { NVDA: [] })]);
        evaluation.assistiveTechnologySummaries = [
            { assistiveTechnology: 'NVDA', overallRating: -1, significantIssues: [] }
        ];
        expect(buildScorecard(evaluation).overallRating).toBe(-1);
    });
});

describe('findSummary', () => {
    test('finds the entry for an assistive technology, or nothing', () => {
        const evaluation = evaluationOf([]);
        evaluation.assistiveTechnologySummaries = [
            { assistiveTechnology: 'JAWS', overallRating: 4, significantIssues: ['one'] }
        ];
        expect(findSummary(evaluation, 'JAWS')?.overallRating).toBe(4);
        expect(findSummary(evaluation, 'NVDA')).toBeUndefined();
    });
});
