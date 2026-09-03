import { issuesMap, minimumScore } from '../domain/scoring.js';
import { buildSummaryText, splitSummaryComments } from '../domain/summary.js';
import { getCurrentRun, markEvaluationChanged } from '../state/store.js';
import { requireEl } from './dom.js';
/*
 * perform-view draws the Summary list this dialog writes to, the same way it
 * draws the issue lists the issue dialog writes to. The resulting cycle is the
 * documented safe one: both sides only call hoisted declarations at event time.
 */
import { populateSummaryList } from './perform-view.js';
import { setSectionTitle } from './screens.js';

/** Fills the comment box with the run's issues grouped by severity, and updates its score. */
export function generateSummary(): void {
    const run = getCurrentRun();
    const allIssues = issuesMap(run);
    requireEl<HTMLTextAreaElement>("general-comments").value = buildSummaryText(allIssues);
    run.score = minimumScore(allIssues);
    requireEl<HTMLSelectElement>("perform-score").value = String(run.score);
    requireEl("general-comments").focus();
}

/** Click handler for Generate Summary. */
export function generateSummaryClicked(): void {
    generateSummary();
}

/** Stores the edited comment block on the run and mirrors it into the summary list. */
export function saveGeneralComments(e: Event): void {
    e.preventDefault();
    const run = getCurrentRun();
    markEvaluationChanged();
    const commentSummary = requireEl<HTMLTextAreaElement>("general-comments").value.trim();
    if (commentSummary === "") {
        run.comments.length = 0;
    }
    else {
        run.comments = splitSummaryComments(commentSummary);
    }
    populateSummaryList();
}

/** Opens the summary dialog, seeding it from the comments already recorded. */
export function viewSummaryButtonClicked(e: Event): void {
    e.preventDefault();
    const viewSummaryDialog = requireEl<HTMLDialogElement>("view-summary-dialog");
    setSectionTitle('View Summary');
    viewSummaryDialog.showModal();
    requireEl('view-summary-dialog-title').focus();
    const viewSummaryDialogClose = requireEl("view-summary-dialog-close");
    viewSummaryDialogClose.addEventListener("click", (e) => {
        e.preventDefault();
        viewSummaryDialog.close();
    });

    const generateSummaryBtn = requireEl("generate-summary");
    generateSummaryBtn.addEventListener("click", generateSummaryClicked);
    const saveSummaryBtn = requireEl("general-comments-save");
    saveSummaryBtn.addEventListener("click", saveGeneralComments);
    const run = getCurrentRun();
    if (run.comments.length > 0) {
        requireEl<HTMLTextAreaElement>("general-comments").value = run.comments.join("\n\n");
    }
    else {
        requireEl<HTMLTextAreaElement>("general-comments").value = "";
    }
}
