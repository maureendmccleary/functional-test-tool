import { describe, expect, test } from 'vitest';
import type { TestRun, FunctionalTest } from '../src/types.js';
import {
    DEFAULT_NEW_TEST_STEPS, buildTestReport, emptyFunctionalTest, getTestComments
} from '../src/domain/functional-test.js';
import {
    emptyTestRun, ensureTestRunStepCount, findTestRunIndex
} from '../src/domain/test-run.js';
import { normalizeEvaluation } from '../src/domain/migration.js';
import { loadFixture } from './helpers/fixtures.js';

describe('emptyFunctionalTest', () => {
    test('has every key the editor form writes to', () => {
        expect(emptyFunctionalTest()).toEqual({
            steps: [], comments: [], operatingSystem: '', assistiveTechnologies: [], name: '', startLocation: '',
            goal: '', operator: '', application: '', score: -1, runs: []
        });
    });

    test('does not share arrays between calls', () => {
        emptyFunctionalTest().steps.push({ instructions: 'x', issues: [] });
        expect(emptyFunctionalTest().steps).toEqual([]);
    });

    test('starts with the requested number of blank steps', () => {
        expect(emptyFunctionalTest(DEFAULT_NEW_TEST_STEPS).steps).toEqual([
            { instructions: '', issues: [] }, { instructions: '', issues: [] },
            { instructions: '', issues: [] }, { instructions: '', issues: [] },
            { instructions: '', issues: [] }
        ]);
    });

    test('the editor default is five steps', () => {
        expect(DEFAULT_NEW_TEST_STEPS).toBe(5);
    });

    test('gives each blank step its own object', () => {
        const subject = emptyFunctionalTest(DEFAULT_NEW_TEST_STEPS);
        subject.steps[0].instructions = 'first';
        subject.steps[0].issues.push({ description: 'x', findingURL: '', score: '1' });

        expect(subject.steps[1].instructions).toBe('');
        expect(subject.steps[1].issues).toEqual([]);
    });
});

test('emptyTestRun mirrors the functional test step count', () => {
    const subject = { steps: [{}, {}, {}] } as unknown as FunctionalTest;
    expect(emptyTestRun(subject, 'NVDA', 'Windows')).toEqual({
        assistiveTechnology: 'NVDA', operatingSystem: 'Windows', score: -1, comments: [],
        steps: [{ issues: [] }, { issues: [] }, { issues: [] }]
    });
});

describe('ensureTestRunStepCount', () => {
    test('pads with empty issue lists when steps were added', () => {
        const subject = { steps: [{}, {}, {}] } as unknown as FunctionalTest;
        const run = {
            steps: [{ issues: [{ description: 'kept', findingURL: '', score: '1' }] }]
        } as unknown as TestRun;
        ensureTestRunStepCount(subject, run);
        expect(run.steps).toHaveLength(3);
        expect(run.steps[0].issues).toHaveLength(1);
        expect(run.steps[1]).toEqual({ issues: [] });
    });

    test('truncates -- and drops issues -- when steps were removed', () => {
        const subject = { steps: [{}] } as unknown as FunctionalTest;
        const run = {
            steps: [{ issues: [] }, { issues: [{ description: 'discarded', findingURL: '', score: '1' }] }]
        } as unknown as TestRun;
        ensureTestRunStepCount(subject, run);
        expect(run.steps).toEqual([{ issues: [] }]);
    });
});

describe('findTestRunIndex', () => {
    test('matches on both ats and operatingSystem', () => {
        const subject = {
            runs: [{ assistiveTechnology: 'NVDA', operatingSystem: 'Windows' }, { assistiveTechnology: 'JAWS', operatingSystem: 'Windows' }]
        } as unknown as FunctionalTest;
        expect(findTestRunIndex(subject, 'JAWS', 'Windows')).toBe(1);
        expect(findTestRunIndex(subject, 'JAWS', 'macOS')).toBe(-1);
    });

    test('creates the array as a side effect when it is missing', () => {
        const subject = {} as FunctionalTest;
        expect(findTestRunIndex(subject, 'NVDA', 'Windows')).toBe(-1);
        expect(subject.runs).toEqual([]);
    });
});

describe('buildTestReport', () => {
    const subject = {
        name: 'Checkout', goal: 'Buy a thing', operator: 'Screen reader user',
        application: 'Store', startLocation: 'https://example.test',
        assistiveTechnologies: ['NVDA', 'JAWS'], operatingSystem: 'Windows', score: 3, comments: ['test comment'],
        steps: [{ instructions: 'one' }, { instructions: 'two' }, { instructions: 'three' }]
    } as unknown as FunctionalTest;

    test('takes ats/operatingSystem/score/comments from the run, not the functional test', () => {
        const run = {
            assistiveTechnology: 'NVDA', operatingSystem: 'Windows', score: 1, comments: ['performed comment'],
            steps: [{ issues: [] }, { issues: [] }, { issues: [] }]
        } as unknown as TestRun;
        const display = buildTestReport(subject, run);
        expect(display.assistiveTechnology).toBe('NVDA');
        expect(display.score).toBe(1);
        expect(display.comments).toEqual(['performed comment']);
        expect(display.name).toBe('Checkout');
    });

    test('drives step count from the functional test, filling missing steps', () => {
        // The run is shorter than the functional test, which happens whenever
        // steps are added in the editor without reopening Perform.
        const run = {
            assistiveTechnology: 'NVDA', operatingSystem: 'Windows', score: 2, comments: [],
            steps: [{ issues: [{ description: 'only issue', findingURL: '', score: '2' }] }]
        } as unknown as TestRun;
        const display = buildTestReport(subject, run);
        expect(display.steps).toHaveLength(3);
        expect(display.steps[0].issues).toHaveLength(1);
        expect(display.steps[1]).toEqual({ instructions: 'two', issues: [] });
        expect(display.steps[2]).toEqual({ instructions: 'three', issues: [] });
    });

    test('ignores run steps beyond the functional test step count', () => {
        const run = {
            assistiveTechnology: 'NVDA', operatingSystem: 'Windows', score: 2, comments: [],
            steps: [{ issues: [] }, { issues: [] }, { issues: [] }, { issues: [] }]
        } as unknown as TestRun;
        expect(buildTestReport(subject, run).steps).toHaveLength(3);
    });
});

describe('getTestComments', () => {
    test('returns an empty array when runs is not an array', () => {
        expect(getTestComments({} as FunctionalTest)).toEqual([]);
        expect(getTestComments({ runs: null } as unknown as FunctionalTest)).toEqual([]);
    });

    test('flattens comments across every run', () => {
        const subject = {
            runs: [{ comments: ['a', 'b'] }, { comments: [] }, { comments: ['c'] }]
        } as unknown as FunctionalTest;
        expect(getTestComments(subject)).toEqual(['a', 'b', 'c']);
    });

    test('skips a run whose comments are missing', () => {
        const subject = { runs: [{}, { comments: ['kept'] }] } as unknown as FunctionalTest;
        expect(getTestComments(subject)).toEqual(['kept']);
    });

    test('reports the comment counts from a real evaluation', () => {
        const evaluation = normalizeEvaluation(loadFixture('evaluation-with-runs'));
        // The first test was run twice, so its comments come from both runs.
        expect(evaluation.tests.map((t) => getTestComments(t).length)).toEqual([3, 0, 2]);
    });
});
