import { describe, expect, test } from 'vitest';
import type { Evaluation, FunctionalTest, Issue } from '../src/types.js';
import {
    buildScorecard, collectAssistiveTechnologies, findSummary,
    effectiveSummaryFor, groupRunsByAssistiveTechnology, runScore, stepScore, stepScoreText,
    topIssuesFor, worstScoreFor
} from '../src/domain/evaluation.js';

/** An issue at the given severity, which is all the scoring cares about. */
function issue(score: string): Issue {
    return { description: `issue scored ${score}`, findingURL: '', score };
}

/**
 * Any score at or above 1 marks a run performed, whatever its value: the
 * reported score is recomputed from the issues, not read back from here.
 */
const PERFORMED = 5;

/**
 * A test with one run per entry of `runIssues`, each run named for its
 * assistive technology and carrying a single step holding those issues.
 *
 * The runs count as performed. Use `unperformed` for the other case.
 */
function testWithRuns(
    name: string, runIssues: Record<string, Issue[]>, score = PERFORMED
): FunctionalTest {
    return {
        name,
        testNumber: 1,
        extensions: [],
        goal: '',
        startLocation: '',
        operatingSystem: 'Windows',
        assistiveTechnologies: Object.keys(runIssues),
        steps: [{ instructions: 'step one', issues: [] }],
        comments: [],
        runs: Object.entries(runIssues).map(([assistiveTechnology, issues]) => ({
            assistiveTechnology,
            operatingSystem: 'Windows',
            score,
            comments: [],
            steps: [{ issues }],
            extensions: []
        }))
    };
}

/** The same, with no score picked yet, which is how a script starts life. */
function unperformed(name: string, runIssues: Record<string, Issue[]>): FunctionalTest {
    return testWithRuns(name, runIssues, -1);
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

    test('omits an assistive technology with no run recorded against it', () => {
        const subject = testWithRuns('one', { NVDA: [] });
        subject.assistiveTechnologies = ['NVDA', 'JAWS'];
        const groups = groupRunsByAssistiveTechnology(evaluationOf([subject]));
        expect(groups.map((group) => group.assistiveTechnology)).toEqual(['NVDA']);
    });

    test('includes a run nobody has scored yet', () => {
        // The detailed section lists it as "Not rated". Leaving it out would
        // hide the work still outstanding.
        const groups = groupRunsByAssistiveTechnology(evaluationOf([unperformed('one', { NVDA: [] })]));
        expect(groups[0].pairings).toHaveLength(1);
    });

    test('each pairing carries its own script, whose number is its own', () => {
        const tests = [
            testWithRuns('one', { NVDA: [] }),
            testWithRuns('two', { JAWS: [] }),
            testWithRuns('three', { NVDA: [], JAWS: [] })
        ];
        tests.forEach((test, index) => { test.testNumber = index + 1; });
        const groups = groupRunsByAssistiveTechnology(evaluationOf(tests));
        const numbersFor = (at: string) => groups
            .find((group) => group.assistiveTechnology === at)!
            .pairings.map((pairing) => pairing.test.testNumber);
        // "three" is numbered 3 under both technologies even though it is only
        // the second use case listed under JAWS.
        expect(numbersFor('NVDA')).toEqual([1, 3]);
        expect(numbersFor('JAWS')).toEqual([2, 3]);
    });

    test('skips runs with no assistive technology recorded', () => {
        const evaluation = evaluationOf([testWithRuns('one', { '': [], NVDA: [] })]);
        expect(groupRunsByAssistiveTechnology(evaluation)).toHaveLength(1);
    });
});

describe('runScore and unperformed runs', () => {
    test('a run with no score picked reports -1, not a clean pass', () => {
        const [test] = [unperformed('one', { NVDA: [] })];
        expect(runScore(test.runs[0])).toBe(-1);
    });

    test('a performed run with no issues reports 5', () => {
        const [test] = [testWithRuns('one', { NVDA: [] })];
        expect(runScore(test.runs[0])).toBe(5);
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

    test('averages the issue scores and rounds down', () => {
        expect(stepScore({ issues: [issue('4'), issue('2')] })).toBe(3);
        expect(stepScore({ issues: [issue('4'), issue('3')] })).toBe(3);
        expect(stepScore({ issues: [issue('1'), issue('3'), issue('3'), issue('3')] })).toBe(2);
    });

    test('does not take the most severe issue, unlike runScore', () => {
        // One stopper among minor issues averages up; the run it belongs to
        // still scores 1. See the note on stepScore.
        expect(stepScore({ issues: [issue('1'), issue('3'), issue('3')] })).toBe(2);
    });

    test('counts an unrated issue as its own value and junk as zero', () => {
        expect(stepScore({ issues: [issue('-1')] })).toBe(-1);
        expect(stepScore({ issues: [issue('not a score'), issue('4')] })).toBe(2);
    });
});

describe('stepScoreText', () => {
    test('prints the step score for a record that was performed', () => {
        expect(stepScoreText({ issues: [] })).toBe('5');
        expect(stepScoreText({ issues: [issue('2'), issue('4')] })).toBe('3');
    });

    test('prints N/A for a record marked out of scope', () => {
        expect(stepScoreText({ issues: [], outOfScope: true })).toBe('N/A');
        expect(stepScoreText({ issues: [issue('1')], outOfScope: true })).toBe('N/A');
    });
});

describe('out of scope and the totals', () => {
    /** A run whose only stopper is on a step nobody performed. */
    function withSkippedStopper(): FunctionalTest {
        const subject = testWithRuns('Place a hold', { NVDA: [] });
        subject.runs[0].steps = [{ issues: [issue('1')], outOfScope: true }, { issues: [] }];
        return subject;
    }

    test('the run scores as if the skipped step were not there', () => {
        expect(runScore(withSkippedStopper().runs[0])).toBe(5);
    });

    test('its issues stay out of the scorecard and the significant issues', () => {
        const evaluation = evaluationOf([withSkippedStopper()]);
        expect(buildScorecard(evaluation).countsByScore.get(5)).toBe(1);
        expect(buildScorecard(evaluation).countsByScore.get(1)).toBe(0);
        expect(topIssuesFor(evaluation, 'NVDA', 3)).toEqual([]);
        expect(worstScoreFor(evaluation, 'NVDA')).toBe(5);
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

    test('leaves out runs nobody has scored yet', () => {
        // A written but unperformed evaluation must not report every script as
        // a 5 just because no issues have been recorded against it.
        const evaluation = evaluationOf([
            testWithRuns('one', { NVDA: [issue('2')] }),
            unperformed('two', { NVDA: [], JAWS: [] })
        ]);
        const scorecard = buildScorecard(evaluation);
        expect(scorecard.totalRuns).toBe(1);
        expect(scorecard.countsByScore.get(2)).toBe(1);
        expect(scorecard.countsByScore.get(5)).toBe(0);
    });

    test('counts a technology nobody rated at the worst score it reached', () => {
        // The tests were performed even if their summary was never written, and
        // dropping the technology from the average would overstate the rest.
        const evaluation = evaluationOf([testWithRuns('one', { NVDA: [issue('2')] })]);
        evaluation.assistiveTechnologySummaries = [
            { assistiveTechnology: 'NVDA', overallRating: -1, significantIssues: [] }
        ];
        expect(buildScorecard(evaluation).overallRating).toBe(2);
    });

    test('reports -1 when nothing has been performed at all', () => {
        const evaluation = evaluationOf([unperformed('one', { NVDA: [] })]);
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

describe('worstScoreFor', () => {
    test('is the lowest score any of that technology\'s tests reached', () => {
        const evaluation = evaluationOf([
            testWithRuns('one', { NVDA: [issue('3')] }),
            testWithRuns('two', { NVDA: [issue('1')] }),
            testWithRuns('three', { JAWS: [issue('4')] })
        ]);
        expect(worstScoreFor(evaluation, 'NVDA')).toBe(1);
        expect(worstScoreFor(evaluation, 'JAWS')).toBe(4);
    });

    test('a clean run counts as the 5 it scores', () => {
        const evaluation = evaluationOf([testWithRuns('one', { NVDA: [] })]);
        expect(worstScoreFor(evaluation, 'NVDA')).toBe(5);
    });

    test('leaves out tests nobody has scored', () => {
        const evaluation = evaluationOf([
            testWithRuns('one', { NVDA: [issue('4')] }),
            unperformed('two', { NVDA: [issue('1')] })
        ]);
        expect(worstScoreFor(evaluation, 'NVDA')).toBe(4);
    });

    test('reports -1 when the technology has not been performed', () => {
        expect(worstScoreFor(evaluationOf([]), 'NVDA')).toBe(-1);
        expect(worstScoreFor(evaluationOf([unperformed('one', { NVDA: [] })]), 'NVDA')).toBe(-1);
    });
});

describe('topIssuesFor', () => {
    test('takes the most severe first, across that technology only', () => {
        const evaluation = evaluationOf([
            testWithRuns('one', { NVDA: [issue('3'), issue('1')] }),
            testWithRuns('two', { NVDA: [issue('2')] }),
            testWithRuns('three', { JAWS: [issue('1')] })
        ]);
        expect(topIssuesFor(evaluation, 'NVDA', 3))
            .toEqual(['issue scored 1', 'issue scored 2', 'issue scored 3']);
    });

    test('takes fewer than asked for when fewer exist', () => {
        const evaluation = evaluationOf([testWithRuns('one', { NVDA: [issue('2')] })]);
        expect(topIssuesFor(evaluation, 'NVDA', 3)).toEqual(['issue scored 2']);
    });

    test('reports the same description once', () => {
        const evaluation = evaluationOf([
            testWithRuns('one', { NVDA: [issue('2')] }),
            testWithRuns('two', { NVDA: [issue('2')] })
        ]);
        expect(topIssuesFor(evaluation, 'NVDA', 3)).toEqual(['issue scored 2']);
    });

    test('has nothing to offer for a technology with no issues', () => {
        expect(topIssuesFor(evaluationOf([testWithRuns('one', { NVDA: [] })]), 'NVDA', 3))
            .toEqual([]);
    });
});

describe('effectiveSummaryFor', () => {
    test('uses what the tester wrote, when they wrote it', () => {
        const evaluation = evaluationOf([testWithRuns('one', { NVDA: [issue('1')] })]);
        evaluation.assistiveTechnologySummaries = [
            { assistiveTechnology: 'NVDA', overallRating: 4, significantIssues: ['as written'] }
        ];
        expect(effectiveSummaryFor(evaluation, 'NVDA'))
            .toEqual({ overallRating: 4, significantIssues: ['as written'] });
    });

    test('falls back to the worst score and the top issues when they did not', () => {
        // A technology whose dialog was never opened has still been performed.
        const evaluation = evaluationOf([
            testWithRuns('one', { NVDA: [issue('2'), issue('4')] })
        ]);
        expect(effectiveSummaryFor(evaluation, 'NVDA')).toEqual({
            overallRating: 2,
            significantIssues: ['issue scored 2', 'issue scored 4']
        });
    });

    test('falls back for each half independently', () => {
        const evaluation = evaluationOf([testWithRuns('one', { NVDA: [issue('3')] })]);
        evaluation.assistiveTechnologySummaries = [
            { assistiveTechnology: 'NVDA', overallRating: 5, significantIssues: [] }
        ];
        expect(effectiveSummaryFor(evaluation, 'NVDA'))
            .toEqual({ overallRating: 5, significantIssues: ['issue scored 3'] });
    });

    test('has nothing to fall back on for an unperformed technology', () => {
        const evaluation = evaluationOf([unperformed('one', { NVDA: [issue('1')] })]);
        expect(effectiveSummaryFor(evaluation, 'NVDA'))
            .toEqual({ overallRating: -1, significantIssues: [] });
    });
});
