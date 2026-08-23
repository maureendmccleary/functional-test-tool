import type { TestReport, TestRun, FunctionalTest } from '../types.js';
import { collectAssistiveTechnologies } from './evaluation.js';
import { formatUseCaseName } from './report-format.js';
import { emptyTestRun, isPerformed } from './test-run.js';

/**
 * How many blank steps a functional test created from the editor starts with.
 *
 * Scripters were having to press "New Step" five times before writing anything.
 */
export const DEFAULT_NEW_TEST_STEPS = 5;

/**
 * Creates a functional test with every field the editor form writes to.
 *
 * Each blank step is built separately. A shared step object would make typing
 * into one instruction field change every other step at the same time.
 *
 * @param stepCount blank steps to start with; defaults to none
 */
export function emptyFunctionalTest(stepCount = 0, testNumber = 1): FunctionalTest {
    return {
        steps: Array.from({ length: stepCount }, () => ({ instructions: "", issues: [] })),
        extensions: [],
        comments: [],
        operatingSystem: "",
        assistiveTechnologies: [],
        name: "",
        testNumber,
        startLocation: "",
        goal: "",
        operator: "",
        application: "",
        score: -1,
        runs: []
    };
}

/** The lowest script number no test in the evaluation is using. */
export function nextTestNumber(tests: FunctionalTest[]): number {
    const used = (Array.isArray(tests) ? tests : [])
        .map((test) => test.testNumber)
        .filter((testNumber) => typeof testNumber === 'number' && testNumber > 0);
    return used.length > 0 ? Math.max(...used) + 1 : 1;
}

/**
 * Every assistive technology one test needs a script of its own for.
 *
 * A test that names none still yields one entry, the empty string, so a script
 * with no assistive technology assigned survives the split rather than
 * vanishing from the evaluation.
 */
function testTechnologies(test: FunctionalTest): string[] {
    const technologies = collectAssistiveTechnologies([test]);
    return technologies.length > 0 ? technologies : [''];
}

/**
 * A deep copy of a value that came out of JSON.parse or of the editor.
 *
 * The copies must not share step or issue objects: editing one script's steps
 * would otherwise edit its siblings'. Round-tripping through JSON also keeps
 * unknown fields and key order, which is what the migration needs.
 */
function clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Splits a test into one script per assistive technology assigned to it.
 *
 * This is the whole of the one-script-per-technology rule, used both when the
 * editor saves a newly written script and when an older file is loaded. Each
 * script keeps a single technology and the single run recorded against it; a
 * technology with no run yet gets an empty, unperformed one, so every script
 * has somewhere to record results from the moment it exists. That is what
 * stops an assigned technology from being quietly skipped.
 *
 * The copies share the test's number, which identifies the script rather than
 * the copy.
 */
export function splitByAssistiveTechnology(test: FunctionalTest): FunctionalTest[] {
    const recordedRuns = Array.isArray(test.runs) ? test.runs : [];
    return testTechnologies(test).map((assistiveTechnology) => {
        const script = clone(test);
        script.assistiveTechnologies = assistiveTechnology === '' ? [] : [assistiveTechnology];
        const recorded = recordedRuns.find(
            (run) => String(run.assistiveTechnology ?? '').trim() === assistiveTechnology
        );
        script.runs = [recorded
            ? clone(recorded)
            : emptyTestRun(script, assistiveTechnology, script.operatingSystem)];
        return script;
    });
}

/**
 * The single assistive technology a saved script is for, or an empty string.
 *
 * Scripts hold their technology in a list because that is the editor's working
 * surface and the saved file's spelling; everything downstream wants the one
 * value.
 */
export function testAssistiveTechnology(test: FunctionalTest): string {
    const technologies = Array.isArray(test.assistiveTechnologies) ? test.assistiveTechnologies : [];
    return technologies.length > 0 ? String(technologies[0] ?? '').trim() : '';
}

/** The script's name as the tester sees it: "01 Place a hold - NVDA". */
export function testDisplayName(test: FunctionalTest): string {
    return formatUseCaseName(test.testNumber, test.name, testAssistiveTechnology(test));
}

/**
 * Makes sure the evaluation holds a script for every assistive technology
 * assigned to the one at `index`, and returns the scripts that had to be added.
 *
 * The script at `index` is replaced by the copy for the technology it already
 * represents, keeping its recorded run; the copies for the technologies it does
 * not yet have are inserted straight after it, so the copies of one script stay
 * together in the list. A newly drafted script has no technology of its own
 * yet, and becomes the copy for the first one assigned to it.
 *
 * Copies are only ever added. Unchecking a technology leaves the script already
 * written for it alone, results and all: throwing away recorded work is what
 * Delete is for, and it asks first.
 *
 * Each run's operating system is brought into line with its script's, so that
 * editing the field reaches the report. A run that has already been performed
 * keeps the operating system it was performed under: that is a record of the
 * conditions of the test, and editing the script afterwards must not rewrite
 * it.
 */
export function addAssistiveTechnologyCopies(
    tests: FunctionalTest[], index: number
): FunctionalTest[] {
    const test = tests[index];
    // The technology the script already stands for is the one on its run, not
    // the one ticked in the editor: unticking it must not hand the script's
    // recorded results to a different technology.
    const runs = Array.isArray(test.runs) ? test.runs : [];
    const own = runs.length > 0 ? String(runs[0].assistiveTechnology ?? '').trim() : '';
    const copies = splitByAssistiveTechnology(test);

    copies.forEach((copy) => {
        const run = copy.runs[0];
        if (!isPerformed(run)) {
            run.operatingSystem = copy.operatingSystem;
        }
    });

    const kept = copies.find((copy) => testAssistiveTechnology(copy) === own) || copies[0];
    tests[index] = kept;

    const alreadyWritten = new Set(tests
        .filter((other) => other.testNumber === kept.testNumber)
        .map(testAssistiveTechnology));
    const added = copies.filter((copy) => !alreadyWritten.has(testAssistiveTechnology(copy)));
    tests.splice(index + 1, 0, ...added);
    return added;
}

/** Every comment recorded across all performances of this functional test. */
export function getTestComments(test: FunctionalTest): string[] {
    if (!Array.isArray(test.runs)) {
        return [];
    }
    return test.runs.flatMap((p) => Array.isArray(p.comments) ? p.comments : []);
}

/**
 * Merges authoring text from the functional test with results from one performance.
 *
 * Step and extension counts come from the functional test, not the performance,
 * so either one added in the editor after a run still appears -- with an empty
 * issue list.
 */
export function buildTestReport(test: FunctionalTest, run: TestRun): TestReport {
    return {
        name: test.name,
        goal: test.goal,
        operator: test.operator,
        application: test.application,
        startLocation: test.startLocation,
        assistiveTechnology: run.assistiveTechnology,
        operatingSystem: run.operatingSystem,
        score: run.score,
        comments: run.comments,
        steps: test.steps.map((step, i) => ({
            instructions: step.instructions,
            issues: (run.steps[i] && run.steps[i].issues) || []
        })),
        extensions: (Array.isArray(test.extensions) ? test.extensions : []).map((extension, i) => ({
            instructions: extension.instructions,
            issues: (run.extensions && run.extensions[i] && run.extensions[i].issues) || []
        }))
    };
}
