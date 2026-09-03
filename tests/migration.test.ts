import { describe, expect, test } from 'vitest';
import type { FunctionalTest } from '../src/types.js';
import {
    migrateLegacyTestRun, normalizeEvaluation, normalizeOperatingSystem
} from '../src/domain/migration.js';
import { testDisplayName } from '../src/domain/functional-test.js';
import { loadFixture } from './helpers/fixtures.js';

/**
 * Characterizes the load-time normalization pipeline against a real evaluation
 * file saved before runs existed (tests/fixtures/evaluation-legacy.json).
 */

describe('normalizeOperatingSystem', () => {
    test('takes the first element of an array', () => {
        expect(normalizeOperatingSystem(['Windows', 'macOS'])).toBe('Windows');
    });

    test('maps an empty array, null and undefined to an empty string', () => {
        expect(normalizeOperatingSystem([])).toBe('');
        expect(normalizeOperatingSystem(null)).toBe('');
        expect(normalizeOperatingSystem(undefined)).toBe('');
    });

    test('trims and stringifies anything else', () => {
        expect(normalizeOperatingSystem('  Windows  ')).toBe('Windows');
        expect(normalizeOperatingSystem(42)).toBe('42');
    });
});

describe('migrateLegacyTestRun', () => {
    test('is a no-op when runs already has entries', () => {
        const existing = { assistiveTechnology: 'JAWS', operatingSystem: 'Windows', score: 2, comments: [], steps: [] };
        const subject = {
            assistiveTechnologies: ['NVDA'], operatingSystem: 'Windows', score: 1, comments: ['ignored'],
            steps: [{ instructions: 'a', issues: [{ description: 'x', findingURL: '', score: '1' }] }],
            runs: [existing]
        } as unknown as FunctionalTest;
        migrateLegacyTestRun(subject);
        expect(subject.runs).toHaveLength(1);
        expect(subject.runs[0]).toBe(existing);
    });

    test('creates runs when the key is missing entirely', () => {
        const subject = { assistiveTechnologies: [], operatingSystem: '', score: 1, comments: [], steps: [] } as unknown as FunctionalTest;
        migrateLegacyTestRun(subject);
        expect(subject.runs).toEqual([]);
    });

    test('does not migrate a functional test whose steps hold no issues', () => {
        const subject = {
            assistiveTechnologies: ['NVDA'], operatingSystem: 'Windows', score: 1, comments: ['kept on the functional test'],
            steps: [{ instructions: 'a', issues: [] }, { instructions: 'b', issues: [] }]
        } as unknown as FunctionalTest;
        migrateLegacyTestRun(subject);
        expect(subject.runs).toEqual([]);
    });

    test('copies comments rather than aliasing them', () => {
        const subject = {
            assistiveTechnologies: ['NVDA'], operatingSystem: 'Windows', score: 3, comments: ['first'],
            steps: [{ instructions: 'a', issues: [{ description: 'x', findingURL: '', score: '3' }] }]
        } as unknown as FunctionalTest;
        migrateLegacyTestRun(subject);
        subject.comments.push('added later');
        expect(subject.runs[0].comments).toEqual([{ text: 'first' }]);
    });

    test('falls back to -1 when the functional test has no numeric score', () => {
        const subject = {
            assistiveTechnologies: ['NVDA'], operatingSystem: 'Windows', comments: [],
            steps: [{ instructions: 'a', issues: [{ description: 'x', findingURL: '', score: '2' }] }]
        } as unknown as FunctionalTest;
        migrateLegacyTestRun(subject);
        expect(subject.runs[0].score).toBe(-1);
    });

    test('falls back to empty strings for missing ats/operatingSystem', () => {
        const subject = {
            assistiveTechnologies: [], operatingSystem: '', score: 1, comments: [],
            steps: [{ instructions: 'a', issues: [{ description: 'x', findingURL: '', score: '1' }] }]
        } as unknown as FunctionalTest;
        migrateLegacyTestRun(subject);
        expect(subject.runs[0].assistiveTechnology).toBe('');
        expect(subject.runs[0].operatingSystem).toBe('');
    });
});

describe('loading a file saved before runs existed', () => {
    const evaluation = normalizeEvaluation(loadFixture('evaluation-legacy'));
    const [search, renew, preferences] = evaluation.tests;

    test('renames the top-level list of tests', () => {
        expect(evaluation.tests).toHaveLength(3);
        expect((evaluation as unknown as Record<string, unknown>).evalUCs).toBeUndefined();
    });

    test('flattens the operating system from an array to a string', () => {
        expect(search.operatingSystem).toBe('Windows');
        expect(renew.operatingSystem).toBe('Windows');
        expect(preferences.operatingSystem).toBe('');
    });

    test('normalizes assistive technologies through the alias map', () => {
        expect(search.assistiveTechnologies).toEqual(['NVDA']);
        expect(preferences.assistiveTechnologies).toEqual([]);
    });

    test('moves step issues into a single run', () => {
        expect(search.runs).toHaveLength(1);
        const run = search.runs[0];
        expect(run.assistiveTechnology).toBe('NVDA');
        expect(run.operatingSystem).toBe('Windows');
        expect(run.score).toBe(1);
        expect(run.comments).toHaveLength(2);
        expect(run.steps.map((step) => step.issues.length)).toEqual([1, 0, 2, 2, 1, 2]);
    });

    test('falls back to empty strings when the test records no AT or OS', () => {
        expect(preferences.runs[0].assistiveTechnology).toBe('');
        expect(preferences.runs[0].operatingSystem).toBe('');
    });

    test('gives a test with no recorded issues an unperformed run', () => {
        // migrateLegacyTestRun still moves nothing, having nothing to move.
        // The split then adds the run every script carries, left unperformed so
        // the scorecard does not count it as a clean pass.
        expect(renew.runs).toHaveLength(1);
        expect(renew.runs[0].score).toBe(-1);
        expect(renew.runs[0].steps.every((step) => step.issues.length === 0)).toBe(true);
        expect(renew.runs[0].comments).toEqual([]);
    });

    test('carries comments onto the migrated run', () => {
        // The legacy file kept them on the test; they belong to the run now,
        // and arrive unclassified because nothing in that file says otherwise.
        expect(preferences.runs[0].comments).toHaveLength(2);
        expect(preferences.runs[0].comments.every((comment) => comment.severity === undefined))
            .toBe(true);
    });

    test('defaults the top-level comments array', () => {
        expect(Array.isArray(evaluation.comments)).toBe(true);
    });
});

describe('loading a file that already has runs', () => {
    const evaluation = normalizeEvaluation(loadFixture('evaluation-with-runs'));

    test('splits a test performed with two technologies into two scripts', () => {
        expect(evaluation.tests.map(testDisplayName)).toEqual([
            '01 Search the catalogue and place a hold - NVDA',
            '01 Search the catalogue and place a hold - JAWS',
            '02 Renew a borrowed item - NVDA',
            '03 Update notification preferences - NVDA'
        ]);
    });

    test('gives every script exactly one run', () => {
        expect(evaluation.tests.map((t) => t.runs.length)).toEqual([1, 1, 1, 1]);
    });

    test('renames run fields without disturbing their contents', () => {
        const nvda = evaluation.tests[0].runs[0];
        const jaws = evaluation.tests[1].runs[0];
        expect(nvda.assistiveTechnology).toBe('NVDA');
        expect(jaws.assistiveTechnology).toBe('JAWS');
        expect(nvda.steps.map((step) => step.issues.length)).toEqual([1, 0, 2, 2, 1, 2]);
        expect((nvda as unknown as Record<string, unknown>).ats).toBeUndefined();
    });

    test('does not add a second run to a script that already has one', () => {
        // migrateLegacyTestRun must not fire when runs are present, and a
        // second split must not re-split what is already one script per
        // technology, or every load would append another copy.
        const reloaded = normalizeEvaluation(JSON.parse(JSON.stringify(evaluation)));
        expect(reloaded.tests.map((t) => t.runs.length)).toEqual([1, 1, 1, 1]);
        expect(reloaded.tests).toHaveLength(4);
    });

    test('the copies of one script share its number', () => {
        expect(evaluation.tests.map((t) => t.testNumber)).toEqual([1, 1, 2, 3]);
    });

    test('does not share steps between the copies of one script', () => {
        const reloaded = normalizeEvaluation(loadFixture('evaluation-with-runs'));
        reloaded.tests[0].steps[0].instructions = 'changed';
        expect(reloaded.tests[1].steps[0].instructions).not.toBe('changed');
    });
});

describe('script numbers', () => {
    test('are assigned in order to a file that has none', () => {
        const evaluation = normalizeEvaluation(loadFixture('evaluation-legacy'));
        expect(evaluation.tests.map((t) => t.testNumber)).toEqual([1, 2, 3]);
    });

    test('already in the file are kept, and gaps are filled from the bottom', () => {
        // A number is part of the name the tester sees, so a stored one is
        // never reassigned; only the script without one is given a number.
        const evaluation = normalizeEvaluation({
            tests: [
                { name: 'kept', testNumber: 4, ats: ['NVDA'] },
                { name: 'new', ats: ['NVDA'] }
            ]
        });
        expect(evaluation.tests.map((t) => t.testNumber)).toEqual([4, 1]);
    });

    test('ignore a stored value that could not be a number', () => {
        const evaluation = normalizeEvaluation({
            tests: [{ name: 'one', testNumber: 'two', ats: ['NVDA'] }]
        });
        expect(evaluation.tests[0].testNumber).toBe(1);
    });
});

describe('out of scope records', () => {
    /** One script with a run whose step records carry the given flags. */
    function withFlags(flags: unknown[]): FunctionalTest {
        return normalizeEvaluation({
            tests: [{
                name: 'one',
                ats: ['NVDA'],
                steps: flags.map(() => ({ instructions: 'a step', issues: [] })),
                performedUCs: [{
                    ats: 'NVDA',
                    score: 5,
                    steps: flags.map((outOfScope) => ({ issues: [], outOfScope })),
                    extensions: []
                }]
            }]
        }).tests[0];
    }

    test('keeps the flag a tester set', () => {
        expect(withFlags([true]).runs[0].steps[0].outOfScope).toBe(true);
    });

    test('drops anything else, so an unmarked record carries no field at all', () => {
        const steps = withFlags([false, undefined, 'yes', 1]).runs[0].steps;
        expect(steps.map((step) => 'outOfScope' in step)).toEqual([false, false, false, false]);
    });

    test('a file written before the flag existed reads as not out of scope', () => {
        const evaluation = normalizeEvaluation(loadFixture('evaluation-with-runs'));
        const steps = evaluation.tests.flatMap((test) => test.runs[0].steps);
        expect(steps.some((step) => 'outOfScope' in step)).toBe(false);
    });
});

describe('extensions', () => {
    test('default to an empty list in a file that predates them', () => {
        const evaluation = normalizeEvaluation(loadFixture('evaluation-legacy'));
        expect(evaluation.tests.every((test) => Array.isArray(test.extensions))).toBe(true);
        expect(evaluation.tests[0].extensions).toEqual([]);
        expect(evaluation.tests[0].runs[0].extensions).toEqual([]);
    });

    test('are kept, with their instructions coerced to a string', () => {
        const evaluation = normalizeEvaluation({
            tests: [{
                name: 'one', ats: ['NVDA'],
                extensions: [{ instructions: 'Credentials below' }, { instructions: 42 }, {}]
            }]
        });
        expect(evaluation.tests[0].extensions.map((e) => e.instructions))
            .toEqual(['Credentials below', '42', '']);
    });

    test('a run gains a record for every extension of its test', () => {
        const evaluation = normalizeEvaluation({
            tests: [{
                name: 'one', ats: ['NVDA'],
                extensions: [{ instructions: 'a' }, { instructions: 'b' }]
            }]
        });
        expect(evaluation.tests[0].runs[0].extensions).toEqual([{ issues: [] }, { issues: [] }]);
    });
});

describe('report identity fields', () => {
    test('are empty strings in a file saved before they existed', () => {
        const evaluation = normalizeEvaluation(loadFixture('evaluation-legacy'));
        expect(evaluation.workspace).toBe('');
        expect(evaluation.asset).toBe('');
        expect(evaluation.name).toBe('');
    });

    test('are trimmed and stringified when present', () => {
        const evaluation = normalizeEvaluation({
            tests: [], workspace: '  Example Company  ', asset: 42, name: 'Q3 Evaluation'
        });
        expect(evaluation.workspace).toBe('Example Company');
        expect(evaluation.asset).toBe('42');
        expect(evaluation.name).toBe('Q3 Evaluation');
    });
});

describe('assistive technology summaries', () => {
    test('gains an empty summary for every assistive technology in use', () => {
        const evaluation = normalizeEvaluation(loadFixture('evaluation-with-runs'));
        expect(evaluation.assistiveTechnologySummaries)
            .toEqual([
                { assistiveTechnology: 'NVDA', overallRating: -1, significantIssues: [] },
                { assistiveTechnology: 'JAWS', overallRating: -1, significantIssues: [] }
            ]);
    });

    test('keeps a stored summary whose assistive technology is no longer assigned', () => {
        const evaluation = normalizeEvaluation({
            tests: [],
            assistiveTechnologySummaries: [
                { assistiveTechnology: 'JAWS', overallRating: 2, significantIssues: ['kept'] }
            ]
        });
        // Stored as a plain string by an older version, read back unclassified.
        expect(evaluation.assistiveTechnologySummaries).toEqual([
            { assistiveTechnology: 'JAWS', overallRating: 2, significantIssues: [{ text: 'kept' }] }
        ]);
    });

    test('drops entries naming no assistive technology and repairs bad fields', () => {
        const evaluation = normalizeEvaluation({
            tests: [],
            assistiveTechnologySummaries: [
                { assistiveTechnology: '  ', overallRating: 3, significantIssues: [] },
                { assistiveTechnology: 'NVDA', overallRating: 'two', significantIssues: 'nope' }
            ]
        });
        expect(evaluation.assistiveTechnologySummaries).toEqual([
            { assistiveTechnology: 'NVDA', overallRating: -1, significantIssues: [] }
        ]);
    });

    test('survives a load, save and reload without duplicating', () => {
        const evaluation = normalizeEvaluation(loadFixture('evaluation-with-runs'));
        const reloaded = normalizeEvaluation(JSON.parse(JSON.stringify(evaluation)));
        expect(reloaded.assistiveTechnologySummaries)
            .toEqual(evaluation.assistiveTechnologySummaries);
    });
});
