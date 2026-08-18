import { defaults } from '../config/defaults.js';
import { buildOverallCommentsText } from '../domain/summary.js';
import { buildTestReport } from '../domain/functional-test.js';
import { renderEvalResultsDocx } from '../io/docx-report.js';
import { getEvaluation } from '../state/store.js';
import { appendNewlines, createUnorderedList, fillListbox } from './controls.js';
import { requireEl } from './dom.js';
import { createResultsTable } from './results-view.js';

/**
 * Element ids for one assistive technology's summary controls.
 *
 * Generated from the summary's position, the way step ids are. They are read
 * back by the change handlers only, so nothing outside this module matches on
 * them.
 */
function summaryRatingId(index: number): string {
    return `at-summary-rating[${index}]`;
}

function summaryIssuesId(index: number): string {
    return `at-summary-issues[${index}]`;
}

/**
 * Draws a rating select and an issues textarea for each assistive technology.
 *
 * Reads the stored summaries rather than the runs: normalizeEvaluation already
 * guarantees one entry per assistive technology the evaluation uses, and it
 * keeps entries whose AT is no longer assigned so their text is not lost.
 */
export function renderAssistiveTechnologySummaries(): void {
    const evaluation = getEvaluation();
    const parentDiv = requireEl("at-summaries");
    parentDiv.innerHTML = "";

    const summaries = evaluation.assistiveTechnologySummaries || [];
    if (summaries.length === 0) {
        parentDiv.appendChild(createUnorderedList([], "No assistive technologies have been assigned yet."));
        return;
    }

    summaries.forEach((summary, index) => {
        const block = document.createElement("div");

        const atHeading = document.createElement("h3");
        atHeading.textContent = summary.assistiveTechnology;
        block.appendChild(atHeading);

        const ratingId = summaryRatingId(index);
        const ratingLabel = document.createElement("label");
        ratingLabel.htmlFor = ratingId;
        ratingLabel.textContent = "Overall Rating: ";
        const rating = document.createElement("select");
        rating.id = ratingId;
        block.appendChild(ratingLabel);
        block.appendChild(rating);
        appendNewlines(block);

        const issuesId = summaryIssuesId(index);
        const issuesLabel = document.createElement("label");
        issuesLabel.htmlFor = issuesId;
        issuesLabel.textContent = "Significant Issues (one per paragraph): ";
        const issues = document.createElement("textarea");
        issues.id = issuesId;
        issues.className = "large-textarea";
        issues.value = summary.significantIssues.join("\n\n");
        block.appendChild(issuesLabel);
        block.appendChild(document.createElement("br"));
        block.appendChild(issues);
        appendNewlines(block);

        parentDiv.appendChild(block);

        // Filled after the select is in the document: fillListbox looks it up by id.
        fillListbox(defaults["scores"], ratingId);
        rating.value = String(summary.overallRating);
        rating.addEventListener("change", () => {
            summary.overallRating = parseInt(rating.value, 10);
        });
        issues.addEventListener("blur", () => {
            summary.significantIssues = issues.value.split("\n\n")
                .map((issue) => issue.trim())
                .filter((issue) => issue !== "");
        });
    });
}

/** Redraws the evaluation-wide results: overall comments plus one table per performance. */
export function renderEvalResults(): void {
    const evaluation = getEvaluation();
    const overallCommentsDiv = requireEl("eval-results-summary");
    overallCommentsDiv.innerHTML = "";
    const unorderedList = createUnorderedList(evaluation.comments, "No issues.");
    overallCommentsDiv.appendChild(unorderedList);
    renderAssistiveTechnologySummaries();

    const parentDiv = requireEl("eval-results-tests");
    parentDiv.innerHTML = "";

    evaluation.tests.forEach(test => {
        (test.runs || []).forEach(run => {
            let resultsDiv = document.createElement("div");
            resultsDiv = createResultsTable(buildTestReport(test, run), resultsDiv) as HTMLDivElement;
            parentDiv.appendChild(resultsDiv);
        });
    });
}

/** Replaces the overall comments with text assembled from every test. */
export function generateOverallComments(e: Event): void {
    e.preventDefault();
    const overallCommentsTextarea = requireEl<HTMLTextAreaElement>("overall-comments");
    overallCommentsTextarea.value = buildOverallCommentsText(getEvaluation());
    overallCommentsTextarea.focus();
}

/** Stores the edited overall comments and redraws the results. */
export function overallCommentsSaveClicked(e: Event): void {
    e.preventDefault();
    const overallCommentsTextarea = requireEl<HTMLTextAreaElement>("overall-comments");
    getEvaluation().comments = overallCommentsTextarea.value.split("\n\n")
        .map(comment => comment.trim())
        .filter(comment => comment !== "");

    renderEvalResults();
}

/** Opens the overall comments dialog, seeding it from saved comments when there are any. */
export function overallCommentsClicked(e: Event): void {
    e.preventDefault();
    const evaluation = getEvaluation();
    const overallCommentsDialog = requireEl<HTMLDialogElement>("view-overall-comments-dialog");
    const overallCommentsDialogClose = requireEl("view-overall-comments-dialog-close");
    const generateOverallCommentsBtn = requireEl("generate-overall-comments");
    const overallCommentsSaveBtn = requireEl("overall-comments-save");
    generateOverallCommentsBtn.addEventListener("click", generateOverallComments);
    overallCommentsSaveBtn.addEventListener("click", overallCommentsSaveClicked);
    overallCommentsDialogClose.addEventListener("click", (e) => {
        e.preventDefault();
        overallCommentsDialog.close();
    });
    overallCommentsDialog.showModal();
    const overallCommentsTextarea = requireEl<HTMLTextAreaElement>("overall-comments");
    let commentsText = "";
    if (evaluation.comments) {
        commentsText = evaluation.comments.join("\n\n");
    }
    else {
        commentsText = buildOverallCommentsText(evaluation);
    }
    overallCommentsTextarea.value = commentsText;
}

/** Opens the evaluation results dialog and renders it. */
export function evalViewResultsButtonClicked(e: Event): void {
    e.preventDefault();
    const evalViewResultsDialog = requireEl<HTMLDialogElement>("eval-view-results-dialog");
    const evalViewResultsDialogClose = requireEl("eval-view-results-dialog-close");
    evalViewResultsDialog.showModal();
    evalViewResultsDialogClose.addEventListener("click", (e) => {
        e.preventDefault();
        evalViewResultsDialog.close();
    });
    renderEvalResults();
    const overallCommentsBtn = requireEl("view-overall-comments");
    overallCommentsBtn.addEventListener("click", overallCommentsClicked);
    const generatePDFBtn = requireEl("generate-pdf");
    generatePDFBtn.addEventListener("click", () => renderEvalResultsDocx(getEvaluation()));
}
