import { describe, expect, test } from 'vitest';
import type { TestRun, FunctionalTest } from '../src/types.js';
import {
    DEFAULT_NEW_TEST_STEPS, addAssistiveTechnologyCopies, buildTestReport, emptyFunctionalTest,
    getTestComments, isLastTestForItsTechnology, nextTestNumber, splitByAssistiveTechnology,
    testAssistiveTechnology, testDisplayName
} from '../src/domain/functional-test.js';
import {
    emptyTestRun, ensureTestRunShape, isOutOfScope, isPerformed, issueLines, issueRows
} from '../src/domain/test-run.js';
import { normalizeEvaluation } from '../src/domain/migration.js';
import { SCORE_LABELS } from '../src/domain/report-format.js';
import { loadFixture } from './helpers/fixtures.js';

describe('emptyFunctionalTest', () => {
    test('has every key the editor form writes to', () => {
        expect(emptyFunctionalTest()).toEqual({
            steps: [], extensions: [], comments: [], operatingSystem: '',
            assistiveTechnologies: [], name: '', testNumber: 1, startLocation: '', goal: '',
            operator: '', application: '', score: -1, runs: []
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

describe('nextTestNumber', () => {
    test('starts at one for an empty evaluation', () => {
        expect(nextTestNumber([])).toBe(1);
    });

    test('follows the highest number in use, not the count', () => {
        // Deleting a script leaves a gap. Reusing its number would give two
        // scripts the same name.
        const tests = [{ testNumber: 1 }, { testNumber: 7 }] as FunctionalTest[];
        expect(nextTestNumber(tests)).toBe(8);
    });
});

describe('testAssistiveTechnology', () => {
    test('reads the single assigned technology', () => {
        expect(testAssistiveTechnology({ assistiveTechnologies: ['NVDA'] } as FunctionalTest))
            .toBe('NVDA');
    });

    test('is empty when none is assigned', () => {
        expect(testAssistiveTechnology({ assistiveTechnologies: [] } as unknown as FunctionalTest))
            .toBe('');
        expect(testAssistiveTechnology({} as FunctionalTest)).toBe('');
    });
});

describe('testDisplayName', () => {
    test('joins the number, the name and the assistive technology', () => {
        const subject = {
            testNumber: 4, name: 'Place a hold', assistiveTechnologies: ['JAWS']
        } as FunctionalTest;
        expect(testDisplayName(subject)).toBe('04 Place a hold - JAWS');
    });
});

describe('splitByAssistiveTechnology', () => {
    /** A drafted script, as the editor hands one over. */
    function draft(assistiveTechnologies: string[]): FunctionalTest {
        return {
            ...emptyFunctionalTest(2, 3),
            name: 'Place a hold',
            assistiveTechnologies,
            operatingSystem: 'Windows'
        };
    }

    test('makes one script per assigned technology', () => {
        const scripts = splitByAssistiveTechnology(draft(['NVDA', 'JAWS', 'ZoomText']));
        expect(scripts.map(testDisplayName)).toEqual([
            '03 Place a hold - NVDA', '03 Place a hold - JAWS', '03 Place a hold - ZoomText'
        ]);
    });

    test('gives each script one unperformed run for its own technology', () => {
        const scripts = splitByAssistiveTechnology(draft(['NVDA', 'JAWS']));
        expect(scripts.map((script) => script.runs.length)).toEqual([1, 1]);
        expect(scripts.map((script) => script.runs[0].assistiveTechnology)).toEqual(['NVDA', 'JAWS']);
        expect(scripts.every((script) => script.runs[0].score === -1)).toBe(true);
        expect(scripts[0].runs[0].steps).toHaveLength(2);
    });

    test('carries the operating system onto the run', () => {
        const [script] = splitByAssistiveTechnology(draft(['NVDA']));
        expect(script.runs[0].operatingSystem).toBe('Windows');
    });

    test('does not share steps between the copies', () => {
        const [nvda, jaws] = splitByAssistiveTechnology(draft(['NVDA', 'JAWS']));
        nvda.steps[0].instructions = 'changed';
        nvda.runs[0].steps[0].issues.push({ description: 'x', findingURL: '', score: '1' });

        expect(jaws.steps[0].instructions).toBe('');
        expect(jaws.runs[0].steps[0].issues).toEqual([]);
    });

    test('keeps the run already recorded for a technology', () => {
        const subject = draft(['NVDA', 'JAWS']);
        subject.runs = [{
            assistiveTechnology: 'JAWS', operatingSystem: 'Windows', score: 2, comments: ['kept'],
            steps: [{ issues: [] }, { issues: [] }], extensions: []
        }];
        const [nvda, jaws] = splitByAssistiveTechnology(subject);
        expect(jaws.runs[0].comments).toEqual(['kept']);
        expect(jaws.runs[0].score).toBe(2);
        expect(nvda.runs[0].score).toBe(-1);
    });

    test('yields one script when no technology is assigned', () => {
        const scripts = splitByAssistiveTechnology(draft([]));
        expect(scripts).toHaveLength(1);
        expect(scripts[0].assistiveTechnologies).toEqual([]);
        expect(scripts[0].runs[0].assistiveTechnology).toBe('');
    });

    test('every copy keeps the script number', () => {
        const scripts = splitByAssistiveTechnology(draft(['NVDA', 'JAWS']));
        expect(scripts.map((script) => script.testNumber)).toEqual([3, 3]);
    });
});

test('emptyTestRun mirrors the functional test step and extension counts', () => {
    const subject = { steps: [{}, {}, {}], extensions: [{}] } as unknown as FunctionalTest;
    expect(emptyTestRun(subject, 'NVDA', 'Windows')).toEqual({
        assistiveTechnology: 'NVDA', operatingSystem: 'Windows', score: -1, comments: [],
        steps: [{ issues: [] }, { issues: [] }, { issues: [] }],
        extensions: [{ issues: [] }]
    });
});

test('emptyTestRun copes with a test written before extensions existed', () => {
    const subject = { steps: [{}] } as unknown as FunctionalTest;
    expect(emptyTestRun(subject, 'NVDA', 'Windows').extensions).toEqual([]);
});

describe('ensureTestRunShape', () => {
    test('pads with empty issue lists when steps were added', () => {
        const subject = { steps: [{}, {}, {}] } as unknown as FunctionalTest;
        const run = {
            steps: [{ issues: [{ description: 'kept', findingURL: '', score: '1' }] }]
        } as unknown as TestRun;
        ensureTestRunShape(subject, run);
        expect(run.steps).toHaveLength(3);
        expect(run.steps[0].issues).toHaveLength(1);
        expect(run.steps[1]).toEqual({ issues: [] });
    });

    test('truncates -- and drops issues -- when steps were removed', () => {
        const subject = { steps: [{}] } as unknown as FunctionalTest;
        const run = {
            steps: [{ issues: [] }, { issues: [{ description: 'discarded', findingURL: '', score: '1' }] }]
        } as unknown as TestRun;
        ensureTestRunShape(subject, run);
        expect(run.steps).toEqual([{ issues: [] }]);
    });
});

describe('addAssistiveTechnologyCopies', () => {
    /** A script as it stands after being saved once, with a run of its own. */
    function script(testNumber: number, assistiveTechnology: string, score = -1): FunctionalTest {
        return {
            ...emptyFunctionalTest(1, testNumber),
            name: 'Place a hold',
            assistiveTechnologies: [assistiveTechnology],
            runs: [{
                assistiveTechnology, operatingSystem: 'Windows', score, comments: [],
                steps: [{ issues: [] }], extensions: []
            }]
        };
    }

    test('turns a draft into one script per technology assigned', () => {
        const draft = { ...emptyFunctionalTest(1, 1), name: 'Place a hold' };
        draft.assistiveTechnologies = ['NVDA', 'JAWS', 'ZoomText'];
        const tests = [draft];

        const added = addAssistiveTechnologyCopies(tests, 0);

        expect(tests.map(testDisplayName)).toEqual([
            '01 Place a hold - NVDA', '01 Place a hold - JAWS', '01 Place a hold - ZoomText'
        ]);
        expect(added.map(testDisplayName))
            .toEqual(['01 Place a hold - JAWS', '01 Place a hold - ZoomText']);
    });

    test('inserts the copies next to the script they came from', () => {
        const draft = { ...emptyFunctionalTest(1, 2), name: 'Renew' };
        draft.assistiveTechnologies = ['NVDA', 'JAWS'];
        const tests = [script(1, 'NVDA'), draft, script(3, 'NVDA')];

        addAssistiveTechnologyCopies(tests, 1);

        expect(tests.map(testDisplayName)).toEqual([
            '01 Place a hold - NVDA', '02 Renew - NVDA', '02 Renew - JAWS',
            '03 Place a hold - NVDA'
        ]);
    });

    test('re-saving a script with only its own technology changes nothing', () => {
        // The path taken when a copy is opened to give it instructions of its
        // own. Saving must not spawn a second copy of the same technology.
        const tests = [script(1, 'NVDA', 4)];

        expect(addAssistiveTechnologyCopies(tests, 0)).toEqual([]);
        expect(tests.map(testDisplayName)).toEqual(['01 Place a hold - NVDA']);
        expect(tests[0].runs[0].score).toBe(4);
    });

    test('keeps the edits made to a copy when it is saved again', () => {
        const tests = [script(1, 'NVDA')];
        tests[0].steps[0].instructions = 'Use NVDA browse mode to reach the search field.';

        addAssistiveTechnologyCopies(tests, 0);

        expect(tests[0].steps[0].instructions)
            .toBe('Use NVDA browse mode to reach the search field.');
    });

    test('brings an unperformed run into line with its script operating system', () => {
        // One script, one run, so the operating system chosen for the script is
        // the one the run was performed under and the one the report prints.
        const tests = [script(1, 'VoiceOver')];
        tests[0].operatingSystem = 'macOS';

        addAssistiveTechnologyCopies(tests, 0);

        expect(tests[0].runs[0].operatingSystem).toBe('macOS');
    });

    test('leaves a performed run on the operating system it was performed under', () => {
        const tests = [script(1, 'NVDA', 2)];
        tests[0].operatingSystem = 'macOS';

        addAssistiveTechnologyCopies(tests, 0);

        expect(tests[0].runs[0].operatingSystem).toBe('Windows');
    });

    test('gives each new copy the script operating system', () => {
        const tests = [script(1, 'NVDA')];
        tests[0].operatingSystem = 'Windows 11';
        tests[0].assistiveTechnologies = ['NVDA', 'JAWS'];

        const added = addAssistiveTechnologyCopies(tests, 0);

        expect(added[0].runs[0].operatingSystem).toBe('Windows 11');
    });

    test('adds a copy for a technology checked after the script was written', () => {
        const tests = [script(1, 'NVDA', 3)];
        tests[0].assistiveTechnologies = ['NVDA', 'JAWS'];

        const added = addAssistiveTechnologyCopies(tests, 0);

        expect(added.map(testDisplayName)).toEqual(['01 Place a hold - JAWS']);
        // The script keeps the run it already had; the new copy starts unperformed.
        expect(tests[0].runs[0].score).toBe(3);
        expect(tests[1].runs[0].score).toBe(-1);
    });

    test('leaves the checked technology alone when a sibling already covers it', () => {
        const tests = [script(1, 'NVDA'), script(1, 'JAWS')];
        tests[0].assistiveTechnologies = ['NVDA', 'JAWS'];

        expect(addAssistiveTechnologyCopies(tests, 0)).toEqual([]);
        expect(tests).toHaveLength(2);
    });

    test('never removes the script written for a technology since unchecked', () => {
        // Unchecking must not throw away recorded work; that is what Delete is
        // for, and Delete asks first.
        const tests = [script(1, 'NVDA', 2)];
        tests[0].assistiveTechnologies = ['JAWS'];

        const added = addAssistiveTechnologyCopies(tests, 0);

        expect(tests.map(testDisplayName))
            .toEqual(['01 Place a hold - NVDA', '01 Place a hold - JAWS']);
        expect(added).toHaveLength(1);
        expect(tests[0].runs[0].score).toBe(2);
    });
});

describe('isPerformed', () => {
    test('is false until a score is picked', () => {
        expect(isPerformed({ score: -1 } as TestRun)).toBe(false);
        expect(isPerformed({} as TestRun)).toBe(false);
    });

    test('is true for any score a tester can assign', () => {
        expect(isPerformed({ score: 1 } as TestRun)).toBe(true);
        expect(isPerformed({ score: 5 } as TestRun)).toBe(true);
    });
});

describe('isOutOfScope', () => {
    test('is true only for the flag actually set to true', () => {
        expect(isOutOfScope({ outOfScope: true })).toBe(true);
        expect(isOutOfScope({ outOfScope: false })).toBe(false);
        expect(isOutOfScope({})).toBe(false);
        expect(isOutOfScope(undefined)).toBe(false);
    });
});

describe('issueLines', () => {
    const issue = (description: string) => ({ description, findingURL: '', score: '2' });

    test('lists what was recorded', () => {
        expect(issueLines({ issues: [issue('one'), issue('two')] })).toEqual(['one', 'two']);
    });

    test('stands in for an empty list', () => {
        expect(issueLines({ issues: [] })).toEqual(['No issues']);
        expect(issueLines({})).toEqual(['No issues']);
    });

    test('out of scope replaces whatever was recorded', () => {
        expect(issueLines({ issues: [], outOfScope: true })).toEqual(['Out of scope']);
        expect(issueLines({ issues: [issue('found earlier')], outOfScope: true }))
            .toEqual(['Out of scope']);
    });

    test('is the descriptions of the same rows the report is built from', () => {
        const record = { issues: [issue('one'), issue('two')] };
        expect(issueLines(record)).toEqual(issueRows(record).map((row) => row.description));
    });
});

describe('issueRows', () => {
    const scored = (score: string) => ({ description: `issue at ${score}`, findingURL: '', score });

    test('gives every issue a row of its own, in order and unaveraged', () => {
        // A stopper beside two minor issues. The mean of these rounded down
        // printed a single "2", which is what issue #27 was about.
        expect(issueRows({ issues: [scored('1'), scored('3'), scored('3')] })).toEqual([
            { score: '1', description: 'issue at 1' },
            { score: '3', description: 'issue at 3' },
            { score: '3', description: 'issue at 3' }
        ]);
    });

    test('keeps each score with its own description', () => {
        const rows = issueRows({ issues: [scored('1'), scored('4')] });
        // The pairing is the point: it is what lets the report put the two in
        // the same table row.
        rows.forEach((row) => expect(row.description).toBe(`issue at ${row.score}`));
    });

    test('a record with nothing recorded is one row reading a clean pass', () => {
        expect(issueRows({ issues: [] })).toEqual([{ score: '5', description: 'No issues' }]);
        expect(issueRows({})).toEqual([{ score: '5', description: 'No issues' }]);
    });

    test('out of scope collapses to one row, whatever is recorded', () => {
        expect(issueRows({ issues: [], outOfScope: true }))
            .toEqual([{ score: 'N/A', description: 'Out of scope' }]);
        expect(issueRows({ issues: [scored('1'), scored('3')], outOfScope: true }))
            .toEqual([{ score: 'N/A', description: 'Out of scope' }]);
    });

    test('the clean pass it reports is the top of the scale the report prints', () => {
        // SCORE_LABELS is highest first, and is where the report's own idea of
        // a perfect score lives.
        expect(issueRows({ issues: [] })[0].score).toBe(String(SCORE_LABELS[0].score));
    });
});


describe('ensureTestRunShape and extensions', () => {
    test('pads and truncates extensions the same way as steps', () => {
        const subject = { steps: [], extensions: [{}, {}] } as unknown as FunctionalTest;
        const run = {
            steps: [],
            extensions: [{ issues: [{ description: 'kept', findingURL: '', score: '2' }] }]
        } as unknown as TestRun;

        ensureTestRunShape(subject, run);

        expect(run.extensions).toHaveLength(2);
        expect(run.extensions[0].issues).toHaveLength(1);
        expect(run.extensions[1].issues).toEqual([]);
    });

    test('creates the extensions list for a run saved before extensions existed', () => {
        const subject = { steps: [], extensions: [{}] } as unknown as FunctionalTest;
        const run = { steps: [] } as unknown as TestRun;

        ensureTestRunShape(subject, run);

        expect(run.extensions).toEqual([{ issues: [] }]);
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
        expect(display.steps[1]).toEqual({ instructions: 'two', issues: [], outOfScope: false });
        expect(display.steps[2]).toEqual({ instructions: 'three', issues: [], outOfScope: false });
    });

    test('ignores run steps beyond the functional test step count', () => {
        const run = {
            assistiveTechnology: 'NVDA', operatingSystem: 'Windows', score: 2, comments: [],
            steps: [{ issues: [] }, { issues: [] }, { issues: [] }, { issues: [] }]
        } as unknown as TestRun;
        expect(buildTestReport(subject, run).steps).toHaveLength(3);
    });
});

describe('buildTestReport and extensions', () => {
    test('pairs each extension with the issues recorded against it', () => {
        const subject = {
            name: 'x', goal: '', startLocation: '', operatingSystem: '', comments: [],
            steps: [{ instructions: 'step one', issues: [] }],
            extensions: [
                { instructions: 'Credentials: tester / hunter2' },
                { instructions: 'Trigger the timeout' }
            ]
        } as unknown as FunctionalTest;
        const run = {
            steps: [{ issues: [] }],
            extensions: [
                { issues: [] },
                { issues: [{ description: 'no warning', findingURL: '', score: '2' }] }
            ]
        } as unknown as TestRun;

        const report = buildTestReport(subject, run);

        expect(report.extensions.map((e) => e.instructions))
            .toEqual(['Credentials: tester / hunter2', 'Trigger the timeout']);
        expect(report.extensions[1].issues).toHaveLength(1);
    });

    test('an extension added after the run appears with no issues', () => {
        const subject = {
            steps: [], extensions: [{ instructions: 'added later' }]
        } as unknown as FunctionalTest;
        const run = { steps: [], extensions: [] } as unknown as TestRun;

        expect(buildTestReport(subject, run).extensions[0].issues).toEqual([]);
    });

    test('carries each record out-of-scope flag through from the run', () => {
        const subject = {
            steps: [{ instructions: 'sign in', issues: [] }, { instructions: 'search', issues: [] }],
            extensions: [{ instructions: 'Credentials' }]
        } as unknown as FunctionalTest;
        const run = {
            steps: [{ issues: [], outOfScope: true }, { issues: [] }],
            extensions: [{ issues: [], outOfScope: true }]
        } as unknown as TestRun;

        const report = buildTestReport(subject, run);

        expect(report.steps.map((step) => step.outOfScope)).toEqual([true, false]);
        expect(report.extensions[0].outOfScope).toBe(true);
    });

    test('a step the run has no record for is not out of scope', () => {
        const subject = {
            steps: [{ instructions: 'added later', issues: [] }], extensions: []
        } as unknown as FunctionalTest;
        const run = { steps: [], extensions: [] } as unknown as TestRun;

        expect(buildTestReport(subject, run).steps[0].outOfScope).toBe(false);
    });

    test('a test written before extensions existed reports none', () => {
        const subject = { steps: [] } as unknown as FunctionalTest;
        const run = { steps: [] } as unknown as TestRun;

        expect(buildTestReport(subject, run).extensions).toEqual([]);
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
        // The first script was run with two assistive technologies, so loading
        // it yields two scripts, each holding the comments of its own run.
        expect(evaluation.tests.map((t) => getTestComments(t).length)).toEqual([2, 1, 0, 2]);
    });
});

describe('isLastTestForItsTechnology', () => {
    const script = (testNumber: number, at: string) =>
        ({ testNumber, assistiveTechnologies: [at] }) as FunctionalTest;

    test('the highest numbered script for that technology is the last', () => {
        const tests = [script(1, 'NVDA'), script(2, 'NVDA'), script(3, 'JAWS')];
        expect(isLastTestForItsTechnology(tests, tests[1])).toBe(true);
        expect(isLastTestForItsTechnology(tests, tests[0])).toBe(false);
    });

    test('each technology has its own last, whatever the numbers are', () => {
        // JAWS stops at 3 while NVDA runs to 5; both have a last test.
        const tests = [script(3, 'JAWS'), script(5, 'NVDA')];
        expect(isLastTestForItsTechnology(tests, tests[0])).toBe(true);
        expect(isLastTestForItsTechnology(tests, tests[1])).toBe(true);
    });

    test('a technology with one test has that test as its last', () => {
        const tests = [script(7, 'Orca')];
        expect(isLastTestForItsTechnology(tests, tests[0])).toBe(true);
    });
});
