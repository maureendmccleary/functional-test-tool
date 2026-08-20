import { defaults } from '../config/defaults.js';
import {
    buildScorecard, findSummary, groupRunsByAssistiveTechnology
} from '../domain/evaluation.js';
import { buildOverallCommentsText } from '../domain/summary.js';
import { buildTestReport, testDisplayName } from '../domain/functional-test.js';
import {
    SCORE_LABELS, SCORING_KEY_PARAGRAPHS, SIGNIFICANT_ISSUES_INTRO, formatAssistiveTechnology,
    formatOverallRating
} from '../domain/report-format.js';
import { catalogueVersion, renderEvalResultsDocx } from '../io/docx-report.js';
import { getEvaluation } from '../state/store.js';
import {
    appendNewlines, createDataTable, createLabelValueTable, createUnorderedList, fillListbox
} from './controls.js';
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

/** Replaces an element's contents with the given nodes. */
function replaceContents(elementId: string, nodes: Node[]): void {
    const parent = requireEl(elementId);
    parent.innerHTML = "";
    nodes.forEach((node) => parent.appendChild(node));
}

/** The Scorecard: how many use cases landed on each score. */
function renderScorecard(): void {
    const scorecard = buildScorecard(getEvaluation());
    replaceContents("eval-results-scorecard", [createLabelValueTable([
        ["Total Number of Use Cases", String(scorecard.totalRuns)],
        ["1 (worst)", String(scorecard.countsByScore.get(1) || 0)],
        ["2", String(scorecard.countsByScore.get(2) || 0)],
        ["3", String(scorecard.countsByScore.get(3) || 0)],
        ["4", String(scorecard.countsByScore.get(4) || 0)],
        ["Use Cases that Scored a 5 (best)", String(scorecard.countsByScore.get(5) || 0)],
        ["Overall Rating", formatOverallRating(scorecard.overallRating)]
    ])]);
}

/** The assistive technologies with recorded runs, and their catalogue versions. */
function renderAssistiveTechnologiesUsed(): void {
    const groups = groupRunsByAssistiveTechnology(getEvaluation());
    if (groups.length === 0) {
        replaceContents("eval-results-at-used",
            [createUnorderedList([], "No use cases have been performed yet.")]);
        return;
    }
    replaceContents("eval-results-at-used", [createDataTable(
        ["Assistive Technologies & Versions"],
        groups.map((group) => [formatAssistiveTechnology(
            group.assistiveTechnology, catalogueVersion(group.assistiveTechnology)
        )])
    )]);
}

/** Significant Issues: each assistive technology's rating, then its issues. */
function renderSignificantIssues(): void {
    const evaluation = getEvaluation();
    requireEl("eval-results-issues-intro").textContent = SIGNIFICANT_ISSUES_INTRO;

    const groups = groupRunsByAssistiveTechnology(evaluation);
    if (groups.length === 0) {
        replaceContents("eval-results-summary", [createUnorderedList([], "No issues.")]);
        return;
    }

    const nodes: Node[] = [];
    groups.forEach((group) => {
        const summary = findSummary(evaluation, group.assistiveTechnology);
        const rating = document.createElement("p");
        rating.textContent = `${group.assistiveTechnology} Overall Rating: `
            + formatOverallRating(summary?.overallRating ?? -1);
        nodes.push(rating);
        nodes.push(createUnorderedList(summary?.significantIssues, "No issues."));
    });
    replaceContents("eval-results-summary", nodes);
}

/** The scoring key, from the same wording the report uses. */
function renderScoringKey(): void {
    const nodes: Node[] = SCORING_KEY_PARAGRAPHS.map((paragraph) => {
        const p = document.createElement("p");
        p.textContent = paragraph;
        return p;
    });
    nodes.push(createDataTable(
        ["Score", "Meaning", "Explanation"],
        SCORE_LABELS.map((entry) => [String(entry.score), entry.label, entry.definition])
    ));
    replaceContents("eval-results-scoring-key", nodes);
}

/** The detailed results, grouped by assistive technology as the report groups them. */
function renderDetailedResults(): void {
    const parentDiv = requireEl("eval-results-tests");
    parentDiv.innerHTML = "";

    groupRunsByAssistiveTechnology(getEvaluation()).forEach((group) => {
        const atHeading = document.createElement("h3");
        atHeading.textContent = group.assistiveTechnology;
        parentDiv.appendChild(atHeading);

        group.pairings.forEach(({ test, run }) => {
            const resultsDiv = document.createElement("div");
            createResultsTable(buildTestReport(test, run), resultsDiv, {
                title: testDisplayName(test),
                headingLevel: 4
            });
            parentDiv.appendChild(resultsDiv);
        });
    });
}

/**
 * Redraws the evaluation results dialog.
 *
 * Deliberately mirrors `io/docx-report.ts` section for section, so what is on
 * screen and what is exported cannot drift apart. Both read the same wording
 * from `domain/report-format.ts` and group runs with the same
 * `groupRunsByAssistiveTechnology`.
 */
export function renderEvalResults(): void {
    renderScorecard();
    renderAssistiveTechnologiesUsed();
    renderSignificantIssues();
    renderAssistiveTechnologySummaries();
    renderScoringKey();
    renderDetailedResults();
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
