import { buildOverallCommentsText } from '../domain/summary.js';
import { buildTestReport } from '../domain/functional-test.js';
import { renderEvalResultsDocx } from '../io/docx-report.js';
import { getEvaluation } from '../state/store.js';
import { createUnorderedList } from './controls.js';
import { requireEl } from './dom.js';
import { createResultsTable } from './results-view.js';

/** Redraws the evaluation-wide results: overall comments plus one table per performance. */
export function renderEvalResults(): void {
    const evaluation = getEvaluation();
    const overallCommentsDiv = requireEl("eval-results-summary");
    overallCommentsDiv.innerHTML = "";
    const unorderedList = createUnorderedList(evaluation.comments, "No issues.");
    overallCommentsDiv.appendChild(unorderedList);
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
