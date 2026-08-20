import type { TestReport } from '../types.js';
import { issuesMap, minimumScore } from '../domain/scoring.js';
import { buildTestReport, testDisplayName } from '../domain/functional-test.js';
import { getCurrentRun, getCurrentTest } from '../state/store.js';
import { requireEl } from './dom.js';

/** The three most severe issue descriptions, or the recorded comments if any. */
export function addTopIssues(topIssues: HTMLElement, test: TestReport): void {
    if (test.comments && test.comments.length > 0) {
        test.comments.forEach(comment => {
            const topIssue = document.createElement("li");
            topIssue.innerHTML = comment;
            topIssues.appendChild(topIssue);
        });
        return;
    }

    const allIssues = issuesMap(test);
    const sortedIssues = [...allIssues.entries()].sort((a, b) => a[0] - b[0])
        .flatMap((entry) => [...entry[1]]);

    if (!sortedIssues || sortedIssues.length === 0) {
        const topIssue = document.createElement("li");
        topIssue.innerHTML = "No issues";
        topIssues.appendChild(topIssue);
        return;
    }
    for (let count = 0; count < 3 && count < sortedIssues.length; count++) {
        const topIssue = document.createElement("li");
        topIssue.innerHTML = sortedIssues[count];
        topIssues.appendChild(topIssue);
    }
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
    const testName = document.createElement(`h${headingLevel}`);
    testName.textContent = options.title ?? `Detailed Results: ${test.name}`;
    resultsDiv.appendChild(testName);
    const p2 = document.createElement("p");
    p2.innerHTML = `Assistive Technology: ${test.assistiveTechnology}<br>`;
    p2.innerHTML += `Goal: ${test.goal}<br>`;
    p2.innerHTML += `Operator: ${test.operator || ""}<br>`;
    p2.innerHTML += `Start Location: ${test.startLocation}<br>`;
    p2.innerHTML += `Operating System: ${test.operatingSystem}<br>`;
    p2.innerHTML += `Application: ${test.application || ""}<br><br>`;
    resultsDiv.appendChild(p2);
    const resultsTable = document.createElement("table");
    const rowHeading = resultsTable.insertRow(-1);
    const stepNumberCol = document.createElement("th");
    stepNumberCol.setAttribute('scope', 'col');
    stepNumberCol.innerHTML = "#";
    rowHeading.appendChild(stepNumberCol);
    const stepCol = document.createElement("th");
    stepCol.setAttribute('scope', 'col');
    stepCol.innerHTML = "Main Success Case";
    rowHeading.appendChild(stepCol);
    const scoreCol = document.createElement("th");
    scoreCol.setAttribute('scope', 'col');
    scoreCol.innerHTML = "Score";
    rowHeading.appendChild(scoreCol);
    const issueCol = document.createElement("th");
    issueCol.setAttribute('scope', 'col');
    issueCol.innerHTML = "Issues Encountered";
    rowHeading.appendChild(issueCol);
    let descriptionCell = "";
    let scoreTotal = 0;
    test.steps.forEach((step, index) => {
        const row = resultsTable.insertRow(-1);
        const cell1 = row.insertCell(0);
        const cell2 = row.insertCell(1);
        const cell3 = row.insertCell(2);
        const cell4 = row.insertCell(3);
        cell1.innerHTML = String(index + 1);
        cell2.innerHTML = step.instructions;
        cell2.setAttribute("style", "text-align: center");
        step.issues.forEach((issue) => {
            scoreTotal += parseInt(issue.score);
            descriptionCell += "•" + issue.description + "<br>";
        });
        if (!step.issues || step.issues.length === 0) {
            cell3.innerHTML = "5";
            descriptionCell = "•No issues";
        }
        else {
            cell3.innerHTML = String(Math.floor(scoreTotal / step.issues.length));
        }
        cell4.innerHTML = descriptionCell;
        cell4.setAttribute("style", "text-align: center");
        scoreTotal = 0;
        descriptionCell = "";
    });
    resultsDiv.appendChild(resultsTable);
    const summaryHeading = document.createElement(`h${Math.min(headingLevel + 1, 6)}`);
    summaryHeading.textContent = `Problem Summary (${test.assistiveTechnology})`;
    resultsDiv.appendChild(summaryHeading);
    const p1 = document.createElement("p");
    const score = minimumScore(issuesMap(test));
    p1.innerHTML = `${test.assistiveTechnology} Overall Rating: ${score}`;
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
    viewResultsDialog.showModal();
    viewResultsDialogClose.addEventListener("click", (e) => {
        e.preventDefault();
        viewResultsDialog.close();
    });
    const parentDiv = requireEl("test-results-issues");
    parentDiv.innerHTML = "";
    const test = getCurrentTest();
    const run = getCurrentRun();
    const resultsDiv = document.createElement("div");
    createResultsTable(buildTestReport(test, run), resultsDiv, {
        title: `Detailed Results: ${testDisplayName(test)}`
    });
    parentDiv.appendChild(resultsDiv);
}
