import { issuesMap, minimumScore } from '../domain/scoring.js';
import {
    buildSummaryText, buildSummaryTextFromComments, mergeSummaryComments, parseSummaryComments
} from '../domain/summary.js';
import { getCurrentRun, markEvaluationChanged } from '../state/store.js';
import { requireEl } from './dom.js';
/*
 * perform-view draws the Summary list this dialog writes to, the same way it
 * draws the issue lists the issue dialog writes to. The resulting cycle is the
 * documented safe one: both sides only call hoisted declarations at event time.
 */
import { populateSummaryList } from './perform-view.js';
import { setSectionTitle } from './screens.js';

/**
 * Fills in the run's issues around whatever is already written, and updates the
 * score.
 *
 * Merged rather than replaced, as Generate Overall Comments is: the box may
 * hold the tester's own wording, and it holds it with no banners at all in an
 * evaluation saved before severities were stored. Replacing was that tester's
 * only route to a grouped summary, and it cost them everything they had
 * written. Now pressing it groups what is there and adds what is missing, a
 * line already written picks up the severity of the issue it matches, and
 * pressing it twice does nothing the second time.
 *
 * The score is still written outright. That is this button's other job and the
 * one deliberate exception to the score control owning the score.
 */
export function generateSummary(): void {
    const run = getCurrentRun();
    const allIssues = issuesMap(run);
    const box = requireEl<HTMLTextAreaElement>("general-comments");
    box.value = buildSummaryTextFromComments(mergeSummaryComments(
        parseSummaryComments(box.value), parseSummaryComments(buildSummaryText(allIssues))
    ));
    run.score = minimumScore(allIssues);
    requireEl<HTMLSelectElement>("perform-score").value = String(run.score);
    box.focus();
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
    const commentSummary = requireEl<HTMLTextAreaElement>("general-comments").value;
    run.comments = parseSummaryComments(commentSummary);
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
    // Rebuilt with its banners, so the tester reads the block back the way they
    // wrote it and every line is still sitting under its own severity.
    const run = getCurrentRun();
    requireEl<HTMLTextAreaElement>("general-comments").value =
        buildSummaryTextFromComments(run.comments);
}
