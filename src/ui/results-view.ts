import type { Issue, TestReport } from '../types.js';
import { stepScoreText } from '../domain/evaluation.js';
import { issuesMap, minimumScore } from '../domain/scoring.js';
import { buildTestReport, testDisplayName } from '../domain/functional-test.js';
import { issueLines } from '../domain/test-run.js';
import { getCurrentRun, getCurrentTest } from '../state/store.js';
import { createLabelValueTable } from './controls.js';
import { requireEl } from './dom.js';
import { setSectionTitle } from './screens.js';

/** The three most severe issue descriptions, or the recorded comments if any. */
export function addTopIssues(topIssues: HTMLElement, test: TestReport): void {
    if (test.comments && test.comments.length > 0) {
        test.comments.forEach(comment => {
            const topIssue = document.createElement("li");
            topIssue.textContent = comment;
            topIssues.appendChild(topIssue);
        });
        return;
    }

    const allIssues = issuesMap(test);
    const sortedIssues = [...allIssues.entries()].sort((a, b) => a[0] - b[0])
        .flatMap((entry) => [...entry[1]]);

    if (!sortedIssues || sortedIssues.length === 0) {
        const topIssue = document.createElement("li");
        topIssue.textContent = "No issues";
        topIssues.appendChild(topIssue);
        return;
    }
    for (let count = 0; count < 3 && count < sortedIssues.length; count++) {
        const topIssue = document.createElement("li");
        topIssue.textContent = sortedIssues[count];
        topIssues.appendChild(topIssue);
    }
}

/**
 * One numbered table of steps or extensions, under its own heading.
 *
 * Steps and extensions are shown the same way and differ only in their column
 * headings, so they share this. The "•" prefixes are deliberate output, not
 * commentary: they are how the issue list has always read in this table.
 */
function appendResultsSection(
    resultsDiv: HTMLElement, sectionLevel: number, title: string, columnHeadings: string[],
    entries: Array<{ instructions: string; issues: Issue[]; outOfScope?: boolean }>
): void {
    const sectionHeading = document.createElement(`h${sectionLevel}`);
    sectionHeading.textContent = title;
    resultsDiv.appendChild(sectionHeading);

    const table = document.createElement("table");
    const headingRow = table.insertRow(-1);
    columnHeadings.forEach((columnHeading) => {
        const heading = document.createElement("th");
        heading.setAttribute("scope", "col");
        heading.textContent = columnHeading;
        headingRow.appendChild(heading);
    });

    entries.forEach((entry, index) => {
        const issues = entry.issues || [];
        const row = table.insertRow(-1);
        row.insertCell(0).textContent = String(index + 1);
        const instructions = row.insertCell(1);
        instructions.textContent = entry.instructions;
        instructions.classList.add("cell-centered");
        row.insertCell(2).textContent = stepScoreText({ issues, outOfScope: entry.outOfScope });
        // One element per issue rather than a string of markup: descriptions
        // come out of a saved file and must never be parsed as HTML.
        const issueCell = row.insertCell(3);
        issueLines(entry).forEach((text) => {
            const line = document.createElement("div");
            line.textContent = "•" + text;
            issueCell.appendChild(line);
        });
        issueCell.classList.add("cell-centered");
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
    const topIssues = document.createElement("ul");
    addTopIssues(topIssues, test);
    resultsDiv.appendChild(topIssues);
    return resultsDiv;
}

/** Opens the results dialog for the run being performed. */
export function viewResultsButtonClicked(e: Event): void {
    e.preventDefault();
    const viewResultsDialog = requireEl<HTMLDialogElement>("view-results-dialog");
    const viewResultsDialogClose = requireEl("view-results-dialog-close");
    setSectionTitle('Functional Test Results');
    viewResultsDialog.showModal();
    requireEl('view-results-dialog-title').focus();
    viewResultsDialogClose.addEventListener("click", (e) => {
        e.preventDefault();
        viewResultsDialog.close();
    });
    const parentDiv = requireEl("test-results-issues");
    parentDiv.textContent = "";
    const test = getCurrentTest();
    const run = getCurrentRun();
    const resultsDiv = document.createElement("div");
    createResultsTable(buildTestReport(test, run), resultsDiv, {
        title: `Detailed Results: ${testDisplayName(test)}`
    });
    parentDiv.appendChild(resultsDiv);
}
