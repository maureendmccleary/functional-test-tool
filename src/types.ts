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

/**
 * A deviation from the main success path.
 *
 * Not a step: extensions are not walked in order. They hold what a step needs
 * to refer to -- credentials to sign in with, an error condition to trigger --
 * and the step's own wording points at one by number, as in "Login credentials
 * are located in extension 1". So they are numbered per functional test and
 * carry no link back to the step that mentions them; renumbering or deleting a
 * step cannot leave one dangling.
 */
export interface Extension {
    instructions: string;
}

/**
 * A step, or an extension, as recorded during one performance.
 *
 * Extensions record issues exactly as steps do, so they share this shape and
 * the same positional pairing: `run.steps[i]` belongs to `test.steps[i]`, and
 * `run.extensions[i]` to `test.extensions[i]`.
 */
export interface TestRunStep {
    issues: Issue[];
}

/** One run of a functional test against a specific AT and operating system. */
export interface TestRun {
    /** A single assistive technology, unlike FunctionalTest's list. */
    assistiveTechnology: string;
    operatingSystem: string;
    /**
     * -1 until the tester picks a score, which is what marks the run performed.
     *
     * Every script carries a run from the moment it is created, so "no issues
     * recorded" cannot tell a clean pass from work not yet started. The tester
     * choosing a score is the signal; see isPerformed in domain/test-run.ts.
     */
    score: number;
    comments: string[];
    steps: TestRunStep[];
    /** One record per extension of the test, paired by position. */
    extensions: TestRunStep[];
}

/** A script to be performed: the steps to follow, plus every recorded run of them. */
export interface FunctionalTest {
    /** The plain script name, without the number or assistive technology. */
    name: string;
    /**
     * The script's number in the evaluation, printed as "01" in names and reports.
     *
     * Assigned once and then left alone: the copies of one script made for each
     * assistive technology share a number, and deleting a copy does not
     * renumber the rest. So it cannot be derived from the position in
     * Evaluation.tests. formatUseCaseName composes the displayed name from it.
     */
    testNumber: number;
    goal: string;
    startLocation: string;
    /** Absent in files saved before these fields existed; always read with `|| ""`. */
    operator?: string;
    application?: string;
    /** Written by an older version and never read or updated since. */
    stepCount?: number;
    /** Normalized to a single string on load; older files store an array. */
    operatingSystem: string;
    /**
     * The assistive technologies this test is meant to be run against.
     *
     * A saved script holds exactly one: the editor duplicates a script into one
     * copy per checked assistive technology on save. The array survives because
     * it is the editor's working surface -- while the checkbox group is open it
     * holds every technology checked -- and because it is the saved file's
     * spelling.
     */
    assistiveTechnologies: string[];
    /** Absent in some legacy files, which migrateLegacyTestRun allows for. */
    score?: number;
    steps: Step[];
    /** Deviations from the main success path, numbered from 1 as authored. */
    extensions: Extension[];
    comments: string[];
    /** Exactly one, paired with the single entry in assistiveTechnologies. */
    runs: TestRun[];
}

/**
 * A tester's verdict on one assistive technology across every test in the evaluation.
 *
 * Deliberately not derived from the runs. The report's per-AT "Overall Rating"
 * is assigned by the tester after performing every test with that AT, and does
 * not have to agree with the average or the minimum of those runs' scores.
 */
export interface AssistiveTechnologySummary {
    assistiveTechnology: string;
    /** Assigned by the tester; -1 until they set one, matching TestRun.score. */
    overallRating: number;
    significantIssues: string[];
}

/** A saved file: every functional test in one engagement, with evaluation-wide comments. */
export interface Evaluation {
    /**
     * Cover page identity: the company the work is for, the thing being
     * evaluated, and the name of this evaluation. Absent in files saved before
     * these fields existed; normalizeEvaluation fills them with "".
     */
    workspace?: string;
    asset?: string;
    name?: string;
    tests: FunctionalTest[];
    score: number;
    comments?: string[];
    /** One entry per assistive technology used; filled in by normalizeEvaluation. */
    assistiveTechnologySummaries?: AssistiveTechnologySummary[];
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
    extensions: Array<{ instructions: string; issues: Issue[] }>;
}

/**
 * Anything the scoring functions can total up. Both TestRun and TestReport
 * satisfy it, which is why issuesMap accepts either.
 *
 * Extensions are optional here only because the hand-built objects in the tests
 * predate them; anything the app produces has the array.
 */
export interface IssueBearing {
    steps: Array<{ issues: Issue[] }>;
    extensions?: Array<{ issues: Issue[] }>;
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
