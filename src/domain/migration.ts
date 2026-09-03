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

/** Raised when parsed JSON cannot safely be treated as an evaluation. */
export class EvaluationFormatError extends Error {
    constructor(detail: string) {
        super(`That file is not a supported evaluation: ${detail}.`);
        this.name = 'EvaluationFormatError';
    }
}

/** True only for JSON objects, excluding arrays and null. */
function isRawRecord(value: unknown): value is RawRecord {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Requires a JSON object at a position that downstream code mutates. */
function requireRecord(value: unknown, path: string): RawRecord {
    if (!isRawRecord(value)) {
        throw new EvaluationFormatError(`${path} must be an object`);
    }
    return value;
}

/**
 * Reads an optional array without silently discarding a present value of the
 * wrong type. Missing arrays are normal in legacy files and become empty.
 */
function optionalArray(value: unknown, path: string): unknown[] {
    if (value === undefined) {
        return [];
    }
    if (!Array.isArray(value)) {
        throw new EvaluationFormatError(`${path} must be a list`);
    }
    return value;
}

/** Normalizes one issue while preserving fields written by other versions. */
function normalizeIssue(value: unknown, path: string): Issue {
    const issue = requireRecord(value, path);
    if (typeof issue.description !== 'string') {
        throw new EvaluationFormatError(`${path}.description must be text`);
    }
    if (issue.findingURL === undefined || issue.findingURL === null) {
        issue.findingURL = '';
    } else if (typeof issue.findingURL !== 'string') {
        issue.findingURL = String(issue.findingURL);
    }

    const score = typeof issue.score === 'number'
        ? String(issue.score)
        : typeof issue.score === 'string'
            ? issue.score.trim()
            : issue.score;
    if (typeof score !== 'string' || !['1', '2', '3', '4'].includes(score)) {
        throw new EvaluationFormatError(`${path}.score must be 1, 2, 3, or 4`);
    }
    issue.score = score;
    return issue as unknown as Issue;
}

/** Normalizes an optional issue list and rejects entries that would later crash scoring. */
function normalizeIssues(value: unknown, path: string): Issue[] {
    return optionalArray(value, path)
        .map((issue, index) => normalizeIssue(issue, `${path}[${index}]`));
}

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
function normalizeTest(raw: RawRecord, path: string): FunctionalTest {
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
    raw.runs = optionalArray(rawRuns, `${path}.runs`).map((entry, index) =>
        normalizeRun(requireRecord(entry, `${path}.runs[${index}]`), `${path}.runs[${index}]`)
    );
    dropLegacy(raw, LEGACY_FIELDS.testRuns, 'runs');

    if (!Array.isArray(raw.comments)) {
        raw.comments = [];
    }
    raw.steps = optionalArray(raw.steps, `${path}.steps`).map((entry, index) => {
        const step = requireRecord(entry, `${path}.steps[${index}]`);
        step.issues = normalizeIssues(step.issues, `${path}.steps[${index}].issues`);
        return step as unknown as Step;
    });

    raw.extensions = optionalArray(raw.extensions, `${path}.extensions`).map((entry, index) => {
        const extension = requireRecord(entry, `${path}.extensions[${index}]`);
        // Coerced rather than blanked: whatever a hand-edited file put here was
        // meant to be read by the tester.
        if (typeof extension.instructions !== 'string') {
            extension.instructions = extension.instructions === undefined
                || extension.instructions === null
                ? ''
                : String(extension.instructions);
        }
        return extension as unknown as Extension;
    });

    const test = raw as unknown as FunctionalTest;
    migrateLegacyTestRun(test);
    return test;
}

/** Normalizes one recorded run in place, accepting either field naming. */
function normalizeRun(raw: RawRecord, path: string): TestRun {
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
        raw[field] = optionalArray(raw[field], `${path}.${field}`);
        // issuesMap walks these directly, so a record missing its list would
        // throw rather than read as "nothing recorded here".
        raw[field] = (raw[field] as unknown[]).map((entry, index) => {
            const record = requireRecord(entry, `${path}.${field}[${index}]`);
            record.issues = normalizeIssues(
                record.issues, `${path}.${field}[${index}].issues`
            );
            // Only the flag actually set to true is kept, so a record nobody
            // marked saves back the way files written before the flag existed
            // look: without the field at all.
            if (record.outOfScope !== true) {
                delete record.outOfScope;
            }
            return record as unknown as TestRunStep;
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
    const source = requireRecord(raw, 'The top level');

    const rawTests = pick(source, ['tests', LEGACY_FIELDS.evaluationTests], []);
    const groups = optionalArray(rawTests, 'tests')
        .map((entry, index) => splitByAssistiveTechnology(normalizeTest(
            requireRecord(entry, `tests[${index}]`), `tests[${index}]`
        )));
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
