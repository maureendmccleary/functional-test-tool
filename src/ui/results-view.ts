import type { Issue, SummaryComment, TestReport } from '../types.js';
import { issuesMap, minimumScore } from '../domain/scoring.js';
import { buildTestReport, testDisplayName } from '../domain/functional-test.js';
import { groupSummaryComments } from '../domain/summary.js';
import { issueRows } from '../domain/test-run.js';
import { getCurrentRun, getCurrentTest } from '../state/store.js';
import { createGroupedList, createLabelValueTable, setLinkedText } from './controls.js';
import { requireEl } from './dom.js';
import { setSectionTitle } from './screens.js';

/** How many issues stand in for a summary nobody has written. */
const TOP_ISSUE_COUNT = 3;

/** There is no h7, so a table drawn deep enough stops nesting here. */
const MAX_HEADING_LEVEL = 6;

/**
 * What the problem summary says: what the tester wrote, or the worst of what
 * went wrong when they have written nothing yet.
 *
 * The fallback keeps each issue's severity, so an unwritten summary groups
 * exactly as a written one does rather than reading as a flat list until
 * somebody opens the dialog.
 */
export function problemSummaryComments(test: TestReport): SummaryComment[] {
    if (test.comments && test.comments.length > 0) {
        return test.comments;
    }
    return [...issuesMap(test).entries()]
        .sort((a, b) => a[0] - b[0])
        .flatMap(([severity, descriptions]) => (
            [...descriptions].map((text) => ({ text, severity }))
        ))
        .slice(0, TOP_ISSUE_COUNT);
}

/**
 * One numbered table of steps or extensions, under its own heading.
 *
 * Steps and extensions are shown the same way and differ only in their column
 * headings, so they share this.
 *
 * A step gets one row per issue, so each score sits in the same row as the
 * finding it belongs to and is read under the "Score" column heading. Stacking
 * both columns as lines inside single cells could not say which number went
 * with which finding, and lost the visual pairing too as soon as a description
 * wrapped.
 *
 * Each step's rows are grouped in their own tbody, headed by the step number as
 * a `rowgroup` header cell spanning them. That is what keeps the step
 * identifiable from any row of it: a reader on the third issue is still told
 * which step it belongs to, without the number being repeated on every line.
 *
 * The "•" prefix is deliberate output, not commentary: it is how the issue
 * column has always read in this table.
 */
function appendResultsSection(
    resultsDiv: HTMLElement, sectionLevel: number, title: string, columnHeadings: string[],
    entries: Array<{ instructions: string; issues: Issue[]; outOfScope?: boolean }>
): void {
    const sectionHeading = document.createElement(`h${sectionLevel}`);
    sectionHeading.textContent = title;
    resultsDiv.appendChild(sectionHeading);

    const table = document.createElement("table");
    const head = document.createElement("thead");
    const headingRow = head.insertRow(-1);
    columnHeadings.forEach((columnHeading) => {
        const heading = document.createElement("th");
        heading.setAttribute("scope", "col");
        heading.textContent = columnHeading;
        headingRow.appendChild(heading);
    });
    table.appendChild(head);

    entries.forEach((entry, index) => {
        const rows = issueRows(entry);
        const group = document.createElement("tbody");

        rows.forEach((issueRow, rowIndex) => {
            const row = group.insertRow(-1);
            // The step number and its instructions are written once and span
            // the step's rows, so they are not read out again for every issue.
            if (rowIndex === 0) {
                const number = document.createElement("th");
                number.setAttribute("scope", "rowgroup");
                number.textContent = String(index + 1);
                row.appendChild(number);

                const instructions = document.createElement("td");
                setLinkedText(instructions, entry.instructions);
                instructions.classList.add("cell-centered");
                row.appendChild(instructions);

                // Only where there is something to span. rowspan="1" is what
                // every cell does anyway, and saying so on a step with a single
                // issue is noise in the markup a tester may well be reading.
                if (rows.length > 1) {
                    number.setAttribute("rowspan", String(rows.length));
                    instructions.setAttribute("rowspan", String(rows.length));
                }
            }
            // textContent throughout: descriptions come out of a saved file and
            // must never be parsed as HTML.
            const scoreCell = document.createElement("td");
            scoreCell.textContent = issueRow.score;
            row.appendChild(scoreCell);

            const issueCell = document.createElement("td");
            issueCell.textContent = "•" + issueRow.description;
            issueCell.classList.add("cell-centered");
            row.appendChild(issueCell);
        });
        table.appendChild(group);
    });
    resultsDiv.appendChild(table);
}

/** How a results table is titled and what heading level it sits at. */
export interface ResultsTableOptions {
    /** Overrides the default "Detailed Results: <name>" heading text. */
    title?: string;
    /** Heading level for the title; the problem summary sits one level below. */
    headingLevel?: number;
}

/**
 * Renders the per-step results table into resultsDiv.
 *
 * The per-step score is the *mean* of that step's issue scores, floored, which
 * is a different calculation from the overall rating below it (the minimum).
 * Both are current behavior, and `domain/evaluation.ts` keeps the report on the
 * same two rules.
 */
export function createResultsTable(
    test: TestReport, resultsDiv: HTMLElement, options: ResultsTableOptions = {}
): HTMLElement {
    const headingLevel = options.headingLevel ?? 2;
    const sectionLevel = Math.min(headingLevel + 1, 6);
    const testName = document.createElement(`h${headingLevel}`);
    testName.textContent = options.title ?? `Detailed Results: ${test.name}`;
    resultsDiv.appendChild(testName);

    // A table with row headings, matching the report: read as a run of "Goal:
    // ..." lines in a paragraph, a screen reader user has to hold each label in
    // their head to know what the value after it belongs to. The use case's
    // name is the heading above, so it is not repeated as a row.
    const overallHeading = document.createElement(`h${sectionLevel}`);
    overallHeading.textContent = "Overall Information";
    resultsDiv.appendChild(overallHeading);
    resultsDiv.appendChild(createLabelValueTable([
        ["Assistive Technology", test.assistiveTechnology],
        ["Goal", test.goal],
        ["Operator", test.operator || ""],
        ["Start Location", test.startLocation],
        ["Operating System", test.operatingSystem],
        ["Application", test.application || ""]
    ]));

    appendResultsSection(
        resultsDiv, sectionLevel, "Main Success Case",
        ["Step #", "Main Success Case", "Score", "Issues Encountered"], test.steps
    );

    // Only when there are any: an empty Extensions heading and table would say
    // the use case has deviations it does not have.
    if (test.extensions && test.extensions.length > 0) {
        appendResultsSection(
            resultsDiv, sectionLevel, "Extensions",
            ["Extension #", "Extension", "Score", "Issues Encountered"], test.extensions
        );
    }
    const summaryHeading = document.createElement(`h${sectionLevel}`);
    summaryHeading.textContent = `Problem Summary (${test.assistiveTechnology})`;
    resultsDiv.appendChild(summaryHeading);
    const p1 = document.createElement("p");
    const score = minimumScore(issuesMap(test));
    p1.textContent = `${test.assistiveTechnology} Overall Rating: ${score}`;
    resultsDiv.appendChild(p1);
    // A heading per severity, one level under the "Problem Summary" heading
    // above them, so a reader moves between severities rather than walking the
    // list. Derived rather than fixed: this table is drawn at heading level 2
    // in the results dialog and at 4 inside the evaluation results screen.
    resultsDiv.appendChild(createGroupedList(
        groupSummaryComments(problemSummaryComments(test)), "No issues",
        Math.min(sectionLevel + 1, MAX_HEADING_LEVEL)
    ));
    return resultsDiv;
}

/** Opens the results dialog for the run being performed. */
export function viewResultsButtonClicked(e: Event): void {
    e.preventDefault();
    const viewResultsDialog = requireEl<HTMLDialogElement>("view-results-dialog");
    setSectionTitle('Functional Test Results');
    const parentDiv = requireEl("test-results-issues");
    parentDiv.textContent = "";
    const test = getCurrentTest();
    const run = getCurrentRun();
    const resultsDiv = document.createElement("div");
    createResultsTable(buildTestReport(test, run), resultsDiv, {
        title: `Detailed Results: ${testDisplayName(test)}`
    });
    parentDiv.appendChild(resultsDiv);
    viewResultsDialog.showModal();
    requireEl('view-results-dialog-title').focus();
}

/** Closes the per-test results dialog from its own control. */
function viewResultsDialogCloseClicked(e: Event): void {
    e.preventDefault();
    requireEl<HTMLDialogElement>("view-results-dialog").close();
}

/** Wires the per-test results dialog controls once at startup. */
export function addViewResultsDialogEvents(): void {
    requireEl("view-results-dialog-close").addEventListener("click", viewResultsDialogCloseClicked);
}
