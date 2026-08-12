import type { TestReport, TestRun, FunctionalTest } from '../types.js';

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
export function emptyFunctionalTest(stepCount = 0): FunctionalTest {
    return {
        steps: Array.from({ length: stepCount }, () => ({ instructions: "", issues: [] })),
        comments: [],
        operatingSystem: "",
        assistiveTechnologies: [],
        name: "",
        startLocation: "",
        goal: "",
        operator: "",
        application: "",
        score: -1,
        runs: []
    };
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
 * Step count comes from the functional test, not the performance, so steps added in
 * the editor after a run still appear -- with an empty issue list.
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
        }))
    };
}
