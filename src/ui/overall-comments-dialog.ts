import type { AssistiveTechnologySummary, Evaluation } from '../types.js';
import { defaults } from '../config/defaults.js';
import { findSummary, topIssuesFor, worstScoreFor } from '../domain/evaluation.js';
import { testAssistiveTechnology } from '../domain/functional-test.js';
import {
    buildOverallCommentsTextFor, buildSummaryTextFromComments, mergeSummaryComments,
    parseSummaryComments
} from '../domain/summary.js';
import { getCurrentTest, getEvaluation, markEvaluationChanged } from '../state/store.js';
import { fillListbox } from './controls.js';
import { requireEl } from './dom.js';
import { setSectionTitle } from './screens.js';
import { showStatusMessage } from './status.js';

/**
 * One assistive technology's verdict on the whole evaluation: the rating it is
 * given, and the problems worth reporting.
 *
 * Reached from the last functional test assigned to that technology, which is
 * where the tester has just finished with it, rather than from the results
 * dialog. The results are read only; this is where the two values they show are
 * written.
 */

/** How many issues fill the comments the first time they are opened. */
const TOP_ISSUE_COUNT = 3;

/** The summary for one technology, created if the evaluation has none yet. */
function summaryFor(evaluation: Evaluation, assistiveTechnology: string): AssistiveTechnologySummary {
    const existing = findSummary(evaluation, assistiveTechnology);
    if (existing) {
        return existing;
    }
    const created = { assistiveTechnology, overallRating: -1, significantIssues: [] };
    evaluation.assistiveTechnologySummaries = [
        ...(evaluation.assistiveTechnologySummaries || []), created
    ];
    return created;
}

/** The technology the tester is currently performing against. */
function currentAssistiveTechnology(): string {
    return testAssistiveTechnology(getCurrentTest());
}

/**
 * Fills in this technology's issues around whatever is already written.
 *
 * Merged rather than appended: the box may hold the tester's own wording by
 * now, and generating should neither throw that away nor stack a second copy of
 * every line under a second set of banners. Pressing it twice is a no-op, and a
 * line the tester had typed unclassified picks up the severity the issue it
 * matches was found at.
 */
export function generateOverallComments(): void {
    const box = requireEl<HTMLTextAreaElement>("overall-comments");
    const generated = buildOverallCommentsTextFor(getEvaluation(), currentAssistiveTechnology());
    box.value = buildSummaryTextFromComments(mergeSummaryComments(
        parseSummaryComments(box.value), parseSummaryComments(generated)
    ));
    box.focus();
}

/** Stores the rating and the comments against this technology's summary. */
export function overallCommentsSaveClicked(e: Event): void {
    e.preventDefault();
    const evaluation = getEvaluation();
    const summary = summaryFor(evaluation, currentAssistiveTechnology());

    summary.overallRating = parseInt(requireEl<HTMLSelectElement>("overall-score").value, 10);
    summary.significantIssues = parseSummaryComments(
        requireEl<HTMLTextAreaElement>("overall-comments").value
    );

    markEvaluationChanged();
    showStatusMessage("overall-comments-msg", "Overall comments saved.", 0);
}

/**
 * Opens the dialog on the technology being performed against.
 *
 * Filled before it opens, so its name is right the first time: the heading is
 * written by script and the dialog is named by it.
 */
export function viewOverallCommentsButtonClicked(e: Event): void {
    e.preventDefault();
    const evaluation = getEvaluation();
    const assistiveTechnology = currentAssistiveTechnology();
    const summary = summaryFor(evaluation, assistiveTechnology);

    const heading = requireEl("view-overall-comments-dialog-title");
    heading.textContent =
        `${assistiveTechnology} Overall comments - ${evaluation.name || "Evaluation"}`;
    setSectionTitle(heading.textContent);
    requireEl("overall-comments-msg").textContent = "";

    // The worst result is where the rating starts, until the tester sets one.
    fillListbox(defaults["scores"], "overall-score");
    const rating = summary.overallRating >= 1
        ? summary.overallRating
        : worstScoreFor(evaluation, assistiveTechnology);
    requireEl<HTMLSelectElement>("overall-score").value = String(rating);

    // What the tester wrote, or the worst of what went wrong to start from,
    // either way grouped under the banners that carry each line's severity.
    const box = requireEl<HTMLTextAreaElement>("overall-comments");
    box.value = buildSummaryTextFromComments(summary.significantIssues.length > 0
        ? summary.significantIssues
        : topIssuesFor(evaluation, assistiveTechnology, TOP_ISSUE_COUNT));

    requireEl<HTMLDialogElement>("view-overall-comments-dialog").showModal();
    heading.focus();
}

/** Wires the dialog's own controls. Called once at startup. */
export function addOverallCommentsDialogEvents(): void {
    requireEl("view-overall-comments").addEventListener("click", viewOverallCommentsButtonClicked);
    requireEl("generate-overall-comments").addEventListener("click", generateOverallComments);
    requireEl("overall-comments-save").addEventListener("click", overallCommentsSaveClicked);
    requireEl("view-overall-comments-dialog-close").addEventListener("click", (e) => {
        e.preventDefault();
        requireEl<HTMLDialogElement>("view-overall-comments-dialog").close();
    });
}
