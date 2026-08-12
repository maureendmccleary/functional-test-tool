/**
 * The evaluation data model, as it exists on disk and in memory.
 *
 * Two representations of a score coexist and must not be unified:
 * `Issue.score` is a string (it comes straight off a <select> and is compared
 * as a string against cell.innerHTML in updateIssueTable), while
 * `TestRun.score` is a number (parseInt). See ARCHITECTURE.md.
 */

export interface Issue {
    description: string;
    findingURL: string;
    /** "1".."4"; also "-1" ("Not Rated") until validateIssueInputs rejects it. */
    score: string;
}

/** An authoring step: the instructions a tester follows. */
export interface Step {
    instructions: string;
    /** Legacy files kept issues here, before runs existed. */
    issues: Issue[];
    results?: string;
}

/** A step as recorded during one performance of a functional test. */
export interface TestRunStep {
    issues: Issue[];
}

/** One run of a functional test against a specific AT and operating system. */
export interface TestRun {
    /** A single assistive technology, unlike FunctionalTest's list. */
    assistiveTechnology: string;
    operatingSystem: string;
    score: number;
    comments: string[];
    steps: TestRunStep[];
}

/** A script to be performed: the steps to follow, plus every recorded run of them. */
export interface FunctionalTest {
    name: string;
    goal: string;
    startLocation: string;
    /** Absent in files saved before these fields existed; always read with `|| ""`. */
    operator?: string;
    application?: string;
    /** Written by an older version and never read or updated since. */
    stepCount?: number;
    /** Normalized to a single string on load; older files store an array. */
    operatingSystem: string;
    /** Every assistive technology this test is meant to be run against. */
    assistiveTechnologies: string[];
    /** Absent in some legacy files, which migrateLegacyTestRun allows for. */
    score?: number;
    steps: Step[];
    comments: string[];
    runs: TestRun[];
}

/** A saved file: every functional test in one engagement, with evaluation-wide comments. */
export interface Evaluation {
    tests: FunctionalTest[];
    score: number;
    comments?: string[];
}

/**
 * The merge of a functional test with one of its performances: authoring text from the
 * functional test, results and scoring from the performed run. Built by buildTestReport
 * and consumed by every reporting path.
 */
export interface TestReport {
    name: string;
    goal: string;
    startLocation: string;
    operator?: string;
    application?: string;
    assistiveTechnology: string;
    operatingSystem: string;
    score: number;
    comments: string[];
    steps: Array<{ instructions: string; issues: Issue[] }>;
}

/**
 * Anything the scoring functions can total up. Both TestRun and TestReport
 * satisfy it, which is why issuesMap accepts either.
 */
export interface IssueBearing {
    steps: Array<{ issues: Issue[] }>;
}

/** An option in a <select>, as consumed by fillListbox. */
export interface ListboxOption {
    value: number | string;
    label: string;
}

/** An entry in the os-types / at-types catalogues. */
export interface TypeCatalogEntry {
    'friendly-name': string;
    version: string;
    'os-types'?: string[];
}

/** The catalogues and score lists that populate the menus. */
export interface Defaults {
    'os-types': Record<string, TypeCatalogEntry>;
    'at-types': Record<string, TypeCatalogEntry>;
    scores: ListboxOption[];
    'issue-scores': ListboxOption[];
}
