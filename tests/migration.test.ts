import { describe, expect, test } from 'vitest';
import type { FunctionalTest } from '../src/types.js';
import {
    migrateLegacyTestRun, normalizeEvaluation, normalizeOperatingSystem
} from '../src/domain/migration.js';
import { getTestComments } from '../src/domain/functional-test.js';
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
        expect(subject.runs[0].comments).toEqual(['first']);
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

    test('leaves a test with no recorded issues unmigrated', () => {
        // Nothing to move. Inventing an empty run would misrepresent the test
        // as having been performed.
        expect(renew.runs).toEqual([]);
        expect(getTestComments(renew)).toEqual([]);
    });

    test('carries comments onto the migrated run', () => {
        expect(getTestComments(preferences)).toEqual(preferences.runs[0].comments);
        expect(getTestComments(preferences)).toHaveLength(2);
    });

    test('defaults the top-level comments array', () => {
        expect(Array.isArray(evaluation.comments)).toBe(true);
    });
});

describe('loading a file that already has runs', () => {
    const evaluation = normalizeEvaluation(loadFixture('evaluation-with-runs'));

    test('keeps every recorded run', () => {
        expect(evaluation.tests.map((t) => t.runs.length)).toEqual([2, 1, 1]);
    });

    test('renames run fields without disturbing their contents', () => {
        const [nvda, jaws] = evaluation.tests[0].runs;
        expect(nvda.assistiveTechnology).toBe('NVDA');
        expect(jaws.assistiveTechnology).toBe('JAWS');
        expect(nvda.steps.map((step) => step.issues.length)).toEqual([1, 0, 2, 2, 1, 2]);
        expect((nvda as unknown as Record<string, unknown>).ats).toBeUndefined();
    });

    test('does not add a second run to a test that already has one', () => {
        // migrateLegacyTestRun must not fire when runs are present, or every
        // load would append another copy.
        const reloaded = normalizeEvaluation(JSON.parse(JSON.stringify(evaluation)));
        expect(reloaded.tests.map((t) => t.runs.length)).toEqual([2, 1, 1]);
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
        expect(evaluation.assistiveTechnologySummaries).toEqual([
            { assistiveTechnology: 'JAWS', overallRating: 2, significantIssues: ['kept'] }
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
