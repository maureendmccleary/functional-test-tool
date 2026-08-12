import type { Evaluation, FunctionalTest, Issue, Step, TestRun } from '../types.js';
import { normalizeSelectionValues } from './selection-utils.js';

/**
 * Reads saved evaluation files into the current in-memory shape.
 *
 * This is the only module that knows about historical field names. Everything
 * downstream can assume a fully normalized `Evaluation`.
 */

/** Assistive technology names that older files spelled differently. */
export const AT_ALIAS_MAP: Record<string, string> = { android: 'TalkBack', talkback: 'TalkBack' };

/**
 * Field names as they appeared in files written by earlier versions, mapped to
 * what they are called now. Reading still accepts the old names; saving always
 * writes the new ones.
 */
const LEGACY_FIELDS = {
    evaluationTests: 'evalUCs',
    testRuns: 'performedUCs',
    assistiveTechnologies: 'ats',
    operatingSystem: 'oses',
    startLocation: 'startlocation'
} as const;

/** A parsed file, before any normalization. Every field is suspect. */
type RawRecord = Record<string, unknown>;

/** Returns the first of `names` that is present, else `fallback`. */
function pick(source: RawRecord, names: string[], fallback: unknown = undefined): unknown {
    for (const name of names) {
        if (source[name] !== undefined) {
            return source[name];
        }
    }
    return fallback;
}

/** Removes a key only when it is not the one being kept. */
function dropLegacy(source: RawRecord, legacyName: string, currentName: string): void {
    if (legacyName !== currentName) {
        delete source[legacyName];
    }
}

/**
 * Flattens the operating system to a single trimmed string.
 *
 * Older files stored an array here; only the first entry was ever used.
 */
export function normalizeOperatingSystem(value: unknown): string {
    if (Array.isArray(value)) {
        value = value[0];
    }
    return value === undefined || value === null ? '' : String(value).trim();
}

/**
 * Moves issues recorded directly on a test's steps into a single run.
 *
 * Files saved before runs existed kept issues on the authoring steps, with the
 * assistive technology and operating system recorded once for the whole test.
 * A test with no recorded issues is left alone -- there is nothing to move, and
 * inventing an empty run would misrepresent it as having been performed.
 */
export function migrateLegacyTestRun(test: FunctionalTest): void {
    if (!Array.isArray(test.runs)) {
        test.runs = [];
    }
    if (test.runs.length > 0) {
        return;
    }
    const hasLegacyIssues = Array.isArray(test.steps)
        && test.steps.some((step) => Array.isArray(step.issues) && step.issues.length > 0);
    if (!hasLegacyIssues) {
        return;
    }

    const technologies = test.assistiveTechnologies;
    const run: TestRun = {
        assistiveTechnology: (Array.isArray(technologies) ? technologies[0] : technologies) || '',
        operatingSystem: test.operatingSystem || '',
        score: typeof test.score === 'number' ? test.score : -1,
        comments: Array.isArray(test.comments) ? test.comments.slice() : [],
        steps: test.steps.map((step) => ({
            issues: Array.isArray(step.issues) ? step.issues.slice() : []
        }))
    };
    test.runs.push(run);
}

/** Normalizes one test in place, accepting either the old or new field names. */
function normalizeTest(raw: RawRecord): FunctionalTest {
    raw.startLocation = pick(raw, ['startLocation', LEGACY_FIELDS.startLocation], '');
    dropLegacy(raw, LEGACY_FIELDS.startLocation, 'startLocation');

    raw.operatingSystem = normalizeOperatingSystem(
        pick(raw, ['operatingSystem', LEGACY_FIELDS.operatingSystem])
    );
    dropLegacy(raw, LEGACY_FIELDS.operatingSystem, 'operatingSystem');

    raw.assistiveTechnologies = normalizeSelectionValues(
        pick(raw, ['assistiveTechnologies', LEGACY_FIELDS.assistiveTechnologies], []),
        AT_ALIAS_MAP
    );
    dropLegacy(raw, LEGACY_FIELDS.assistiveTechnologies, 'assistiveTechnologies');

    const rawRuns = pick(raw, ['runs', LEGACY_FIELDS.testRuns], []);
    raw.runs = (Array.isArray(rawRuns) ? rawRuns : []).map((entry) => normalizeRun(entry as RawRecord));
    dropLegacy(raw, LEGACY_FIELDS.testRuns, 'runs');

    if (!Array.isArray(raw.comments)) {
        raw.comments = [];
    }
    if (!Array.isArray(raw.steps)) {
        raw.steps = [];
    }
    (raw.steps as Step[]).forEach((step) => {
        if (!Array.isArray(step.issues)) {
            step.issues = [] as Issue[];
        }
    });

    const test = raw as unknown as FunctionalTest;
    migrateLegacyTestRun(test);
    return test;
}

/** Normalizes one recorded run in place, accepting either field naming. */
function normalizeRun(raw: RawRecord): TestRun {
    raw.assistiveTechnology = pick(
        raw, ['assistiveTechnology', LEGACY_FIELDS.assistiveTechnologies], ''
    );
    dropLegacy(raw, LEGACY_FIELDS.assistiveTechnologies, 'assistiveTechnology');

    raw.operatingSystem = pick(raw, ['operatingSystem', LEGACY_FIELDS.operatingSystem], '');
    dropLegacy(raw, LEGACY_FIELDS.operatingSystem, 'operatingSystem');

    if (!Array.isArray(raw.comments)) {
        raw.comments = [];
    }
    if (!Array.isArray(raw.steps)) {
        raw.steps = [];
    }
    return raw as unknown as TestRun;
}

/**
 * Turns the contents of a saved file into an `Evaluation`.
 *
 * Mutates and returns the parsed object rather than rebuilding it, so fields
 * written by other versions survive a load/save round trip untouched.
 *
 * @param raw the result of `JSON.parse` on a saved evaluation file
 */
export function normalizeEvaluation(raw: unknown): Evaluation {
    const source = (raw ?? {}) as RawRecord;

    const rawTests = pick(source, ['tests', LEGACY_FIELDS.evaluationTests], []);
    source.tests = (Array.isArray(rawTests) ? rawTests : [])
        .map((entry) => normalizeTest(entry as RawRecord));
    dropLegacy(source, LEGACY_FIELDS.evaluationTests, 'tests');

    if (typeof source.score !== 'number') {
        source.score = 0;
    }
    if (!Array.isArray(source.comments)) {
        source.comments = [];
    }
    return source as unknown as Evaluation;
}
