import {
    buildScorecard, effectiveSummaryFor, groupRunsByAssistiveTechnology
} from '../domain/evaluation.js';
import { buildTestReport, testDisplayName } from '../domain/functional-test.js';
import {
    SCORE_LABELS, SCORING_KEY_PARAGRAPHS, SIGNIFICANT_ISSUES_INTRO, formatOverallRating,
    scorecardRows
} from '../domain/report-format.js';
import { renderEvalResultsDocx } from '../io/docx-report.js';
import { getEvaluation } from '../state/store.js';
import { createDataTable, createLabelValueTable, createUnorderedList } from './controls.js';
import { requireEl } from './dom.js';
import { setSectionTitle } from './screens.js';
import { createResultsTable } from './results-view.js';

/**
 * Shows each assistive technology's rating and overall comments, as text.
 *
 * Read only, like the rest of this dialog. Both values are written on the
 * perform screen, from the last functional test assigned to that technology,
 * where the tester has just finished with it and knows what to say.
 */
export function renderAssistiveTechnologySummaries(): void {
    const evaluation = getEvaluation();
    const parentDiv = requireEl("at-summaries");
    parentDiv.textContent = "";

    const summaries = evaluation.assistiveTechnologySummaries || [];
    if (summaries.length === 0) {
        parentDiv.appendChild(createUnorderedList([], "No assistive technologies have been assigned yet."));
        return;
    }

    summaries.forEach((stored) => {
        const summary = effectiveSummaryFor(evaluation, stored.assistiveTechnology);
        const block = document.createElement("div");

        const atHeading = document.createElement("h3");
        atHeading.textContent = stored.assistiveTechnology;
        block.appendChild(atHeading);

        const rating = document.createElement("p");
        rating.textContent = `Overall Rating: ${formatOverallRating(summary.overallRating)}`;
        block.appendChild(rating);

        block.appendChild(createUnorderedList(summary.significantIssues, "No issues."));
        parentDiv.appendChild(block);
    });
}

/** Replaces an element's contents with the given nodes. */
function replaceContents(elementId: string, nodes: Node[]): void {
    const parent = requireEl(elementId);
    parent.textContent = "";
    nodes.forEach((node) => parent.appendChild(node));
}

/** The Scorecard: how many use cases landed on each score. */
function renderScorecard(): void {
    const scorecard = buildScorecard(getEvaluation());
    // Rows from report-format, so the dialog and the report cannot disagree
    // about what the scorecard says or what it calls each line.
    replaceContents("eval-results-scorecard", [createLabelValueTable(scorecardRows(scorecard))]);
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
        ["Assistive Technologies"],
        groups.map((group) => [group.assistiveTechnology])
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
        const summary = effectiveSummaryFor(evaluation, group.assistiveTechnology);
        const rating = document.createElement("p");
        rating.textContent = `${group.assistiveTechnology} Overall Rating: `
            + formatOverallRating(summary.overallRating);
        nodes.push(rating);
        nodes.push(createUnorderedList(summary.significantIssues, "No issues."));
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
    const fragment = document.createDocumentFragment();

    groupRunsByAssistiveTechnology(getEvaluation()).forEach((group) => {
        const atHeading = document.createElement("h3");
        atHeading.textContent = group.assistiveTechnology;
        fragment.appendChild(atHeading);

        group.pairings.forEach(({ test, run }) => {
            const resultsDiv = document.createElement("div");
            createResultsTable(buildTestReport(test, run), resultsDiv, {
                title: testDisplayName(test),
                headingLevel: 4
            });
            fragment.appendChild(resultsDiv);
        });
    });
    parentDiv.replaceChildren(fragment);
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

/** Opens the evaluation results dialog and renders it. */
export function evalViewResultsButtonClicked(e: Event): void {
    e.preventDefault();
    const evalViewResultsDialog = requireEl<HTMLDialogElement>("eval-view-results-dialog");
    setSectionTitle('Evaluation Results');
    // Build while the dialog is closed, so thousands of result rows do not
    // trigger repeated layout and paint work as they are appended.
    renderEvalResults();
    evalViewResultsDialog.showModal();
    requireEl('eval-view-results-dialog-title').focus();
}

/** Closes the evaluation results dialog from its own control. */
function evalResultsDialogCloseClicked(e: Event): void {
    e.preventDefault();
    requireEl<HTMLDialogElement>("eval-view-results-dialog").close();
}

/** Generates exactly one report for one activation. */
function generateReportButtonClicked(): void {
    renderEvalResultsDocx(getEvaluation());
}

/** Wires the evaluation results dialog controls once at startup. */
export function addEvalResultsDialogEvents(): void {
    requireEl("eval-view-results-dialog-close")
        .addEventListener("click", evalResultsDialogCloseClicked);
    requireEl("generate-pdf").addEventListener("click", generateReportButtonClicked);
}
