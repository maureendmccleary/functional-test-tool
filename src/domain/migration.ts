import type {
    AssistiveTechnologySummary, Evaluation, Extension, FunctionalTest, Issue, Step, TestRun,
    TestRunStep
} from '../types.js';
import { collectAssistiveTechnologies } from './evaluation.js';
import { splitByAssistiveTechnology } from './functional-test.js';
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
        })),
        // Files this old predate extensions, so there is nothing to carry over.
        extensions: []
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

    if (!Array.isArray(raw.extensions)) {
        raw.extensions = [];
    }
    (raw.extensions as Extension[]).forEach((extension) => {
        if (typeof extension.instructions !== 'string') {
            extension.instructions = '';
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
    for (const field of ['steps', 'extensions'] as const) {
        if (!Array.isArray(raw[field])) {
            raw[field] = [];
        }
        // issuesMap walks these directly, so a record missing its list would
        // throw rather than read as "nothing recorded here".
        (raw[field] as TestRunStep[]).forEach((record) => {
            if (!Array.isArray(record.issues)) {
                record.issues = [];
            }
        });
    }
    return raw as unknown as TestRun;
}

/** A number that can serve as a script number. */
function isTestNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

/**
 * Numbers each group of scripts, one group per original test.
 *
 * The copies of one script share a number, and a number already in the file is
 * kept: it is part of the name the tester sees, so renumbering would rename
 * scripts that have already been reported on. Only groups without one are
 * given the lowest numbers still free.
 */
function assignTestNumbers(groups: FunctionalTest[][]): void {
    const numbers = groups.map((group) => {
        const existing = group.map((script) => script.testNumber).find(isTestNumber);
        return existing === undefined ? 0 : existing;
    });

    const taken = new Set(numbers.filter((testNumber) => testNumber > 0));
    let next = 1;
    numbers.forEach((testNumber, index) => {
        if (testNumber > 0) {
            return;
        }
        while (taken.has(next)) {
            next++;
        }
        numbers[index] = next;
        taken.add(next);
    });

    groups.forEach((group, index) => {
        group.forEach((script) => {
            script.testNumber = numbers[index];
        });
    });
}

/**
 * Builds the per-assistive-technology summary list.
 *
 * Stored summaries are kept whatever their assistive technology, even when no
 * test refers to it any more: unassigning an AT for a moment must not throw
 * away the significant issues someone wrote against it. Summaries missing for
 * an AT the evaluation does use are added empty, so the report and the entry
 * form always have a row to work with.
 */
function normalizeSummaries(raw: unknown, tests: FunctionalTest[]): AssistiveTechnologySummary[] {
    const summaries: AssistiveTechnologySummary[] = [];

    (Array.isArray(raw) ? raw : []).forEach((entry) => {
        const record = (entry ?? {}) as RawRecord;
        const assistiveTechnology = record.assistiveTechnology === undefined
            ? '' : String(record.assistiveTechnology).trim();
        if (assistiveTechnology === '') {
            return;
        }
        summaries.push({
            assistiveTechnology,
            overallRating: typeof record.overallRating === 'number' ? record.overallRating : -1,
            significantIssues: Array.isArray(record.significantIssues)
                ? record.significantIssues.map((issue) => String(issue ?? ''))
                : []
        });
    });

    collectAssistiveTechnologies(tests).forEach((assistiveTechnology) => {
        if (!summaries.some((summary) => summary.assistiveTechnology === assistiveTechnology)) {
            summaries.push({ assistiveTechnology, overallRating: -1, significantIssues: [] });
        }
    });

    return summaries;
}

/**
 * Turns the contents of a saved file into an `Evaluation`.
 *
 * Mutates and returns the parsed object rather than rebuilding it, so fields
 * written by other versions survive a load/save round trip untouched. Tests are
 * the exception: each is split into one script per assistive technology, which
 * cannot be done in place. The copies are deep, and unknown fields survive.
 *
 * @param raw the result of `JSON.parse` on a saved evaluation file
 */
export function normalizeEvaluation(raw: unknown): Evaluation {
    const source = (raw ?? {}) as RawRecord;

    const rawTests = pick(source, ['tests', LEGACY_FIELDS.evaluationTests], []);
    const groups = (Array.isArray(rawTests) ? rawTests : [])
        .map((entry) => splitByAssistiveTechnology(normalizeTest(entry as RawRecord)));
    assignTestNumbers(groups);
    source.tests = groups.flat();
    dropLegacy(source, LEGACY_FIELDS.evaluationTests, 'tests');

    if (typeof source.score !== 'number') {
        source.score = 0;
    }
    if (!Array.isArray(source.comments)) {
        source.comments = [];
    }

    for (const field of ['workspace', 'asset', 'name'] as const) {
        source[field] = source[field] === undefined || source[field] === null
            ? ''
            : String(source[field]).trim();
    }
    source.assistiveTechnologySummaries = normalizeSummaries(
        source.assistiveTechnologySummaries,
        source.tests as FunctionalTest[]
    );

    return source as unknown as Evaluation;
}
