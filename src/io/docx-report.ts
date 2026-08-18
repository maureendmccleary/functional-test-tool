import type { Evaluation, FunctionalTest, TestRun } from '../types.js';
import { defaults } from '../config/defaults.js';
import {
    buildScorecard, findSummary, groupRunsByAssistiveTechnology, runScore
} from '../domain/evaluation.js';
import { buildTestReport } from '../domain/functional-test.js';
import {
    SCORE_LABELS, SCORING_KEY_PARAGRAPHS, buildCoverSubtitle, formatAssistiveTechnology,
    formatOverallRating, formatReportTimestamp, formatScore
} from '../domain/report-format.js';
import { requireEl } from '../ui/dom.js';

/**
 * Builds the .docx document tree for an evaluation.
 *
 * Separated from the download so the structure can be asserted on directly.
 * `docx` is the UMD global loaded from unpkg by index.html.
 *
 * The layout follows the platform export this replaces: a cover, a table of
 * contents, a scorecard, the significant issues per assistive technology, the
 * scoring key, then the detailed results grouped by assistive technology
 * rather than by functional test.
 */

/** Shading behind each score in the key, palest for the scores not achieved. */
const SCORE_FILLS: Record<number, { plain: string; achieved: string }> = {
    5: { plain: 'EAF4EA', achieved: '92D050' },
    4: { plain: 'EFF6E7', achieved: 'C6E0B4' },
    3: { plain: 'FFF8E5', achieved: 'FFD966' },
    2: { plain: 'FDEEE3', achieved: 'F4B183' },
    1: { plain: 'FBE9E9', achieved: 'E06666' }
};

/** Heading levels the table of contents picks up: assistive technologies and functional tests. */
const CONTENTS_HEADING_RANGE = '2-3';

/** The version recorded in the catalogue for an assistive technology, if it is listed. */
function catalogueVersion(assistiveTechnology: string): string | undefined {
    const entry = Object.values(defaults['at-types'])
        .find((candidate) => candidate['friendly-name'] === assistiveTechnology);
    return entry?.version;
}

export function buildEvalResultsDocument(evaluation: Evaluation, now: Date = new Date()): unknown {
    const { AlignmentType, Document, HeadingLevel, PageBreak, Paragraph, ShadingType,
            Table, TableCell, TableOfContents, TableRow, TextRun, WidthType } = docx;

    function text(content: unknown, options: Record<string, unknown> = {}) {
        return new Paragraph({ children: [new TextRun({ text: String(content ?? ''), ...options })] });
    }

    function heading(content: string, level: unknown) {
        return new Paragraph({ text: content, heading: level });
    }

    function cell(content: unknown, options: Record<string, unknown> = {}) {
        const lines = Array.isArray(content) ? content : [content];
        const paragraphs = lines.length > 0
            ? lines.map((line: unknown) => text(line, options))
            : [new Paragraph({ text: '' })];
        return new TableCell({ children: paragraphs, ...(options.shading ? { shading: options.shading } : {}) });
    }

    function headerCell(content: unknown) {
        return new TableCell({
            children: [text(content, { bold: true })],
            shading: { type: ShadingType.CLEAR, fill: 'EEEEEE', color: 'auto' }
        });
    }

    function makeTable(headers: unknown[], dataRows: unknown[][]) {
        const rows = dataRows.map((row) => new TableRow({ children: row.map((c) => cell(c)) }));
        return new Table({
            rows: headers.length > 0
                ? [new TableRow({ tableHeader: true, children: headers.map(headerCell) }), ...rows]
                : rows,
            width: { size: 100, type: WidthType.PERCENTAGE }
        });
    }

    /** Bullets, or a single "No issues." line when the list is empty. */
    function bullets(items: string[] | undefined) {
        if (!Array.isArray(items) || items.length === 0) {
            return [new Paragraph({ text: 'No issues.' })];
        }
        return items.map((item) => new Paragraph({ text: String(item || ''), bullet: { level: 0 } }));
    }

    const children: unknown[] = [];

    // Cover.
    const subtitle = buildCoverSubtitle(evaluation.asset, evaluation.name);
    const cover = [
        String(evaluation.workspace || ''),
        subtitle,
        'Functional Test Results',
        formatReportTimestamp(now),
        'Produced by the Functional Accessibility Testing Tool'
    ];
    cover.forEach((line, index) => {
        if (line === '') {
            return;
        }
        children.push(new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: line, bold: index === 0, size: index === 0 ? 40 : 28 })]
        }));
    });
    children.push(new Paragraph({ children: [new PageBreak()] }));

    // Table of contents. Word leaves the page numbers blank until fields are
    // updated, which `updateFields` below asks it to do when the file opens.
    children.push(heading('Table of Contents', HeadingLevel.HEADING_1));
    children.push(new TableOfContents('Table of Contents', {
        hyperlink: true,
        headingStyleRange: CONTENTS_HEADING_RANGE
    }));
    children.push(new Paragraph({ children: [new PageBreak()] }));

    // Summary: the scorecard, then the assistive technologies used.
    const scorecard = buildScorecard(evaluation);
    const groups = groupRunsByAssistiveTechnology(evaluation);

    children.push(heading('Functional Test Results Summary', HeadingLevel.HEADING_1));
    children.push(heading('Scorecard', HeadingLevel.HEADING_2));
    children.push(makeTable([], [
        ['Total Number of Functional Tests', String(scorecard.totalRuns)],
        ['1 (worst)', String(scorecard.countsByScore.get(1) || 0)],
        ['2', String(scorecard.countsByScore.get(2) || 0)],
        ['3', String(scorecard.countsByScore.get(3) || 0)],
        ['4', String(scorecard.countsByScore.get(4) || 0)],
        ['Functional Tests that Scored a 5 (best)', String(scorecard.countsByScore.get(5) || 0)],
        ['Overall Rating', formatOverallRating(scorecard.overallRating)]
    ]));

    children.push(heading('Assistive Technologies Used', HeadingLevel.HEADING_2));
    if (groups.length > 0) {
        children.push(makeTable(
            ['Assistive Technologies & Versions'],
            groups.map((group) => [formatAssistiveTechnology(
                group.assistiveTechnology, catalogueVersion(group.assistiveTechnology)
            )])
        ));
    } else {
        children.push(new Paragraph({ text: 'No functional tests have been performed yet.' }));
    }

    // Significant issues, per assistive technology.
    children.push(heading('Significant Issues', HeadingLevel.HEADING_1));
    children.push(new Paragraph({
        text: 'The following problems are the most significant, widespread and high severity problems encountered during testing. A problem may have occurred in some, most or all of the functional tests, or in a single one that was severe enough to note here.'
    }));
    if (groups.length === 0) {
        children.push(new Paragraph({ text: 'No issues.' }));
    }
    groups.forEach((group) => {
        const summary = findSummary(evaluation, group.assistiveTechnology);
        children.push(text(
            `${group.assistiveTechnology} Overall Rating: ${formatOverallRating(summary?.overallRating ?? -1)}`,
            { bold: true }
        ));
        bullets(summary?.significantIssues).forEach((paragraph) => children.push(paragraph));
    });

    // Scoring key.
    children.push(heading('Testing and Scoring Key', HeadingLevel.HEADING_1));
    SCORING_KEY_PARAGRAPHS.forEach((paragraph) => children.push(new Paragraph({ text: paragraph })));
    children.push(makeTable(
        ['Score', 'Meaning', 'Explanation'],
        SCORE_LABELS.map((entry) => [String(entry.score), entry.label, entry.definition])
    ));

    // Detailed results, grouped by assistive technology.
    children.push(heading('Detailed Functional Test Results', HeadingLevel.HEADING_1));
    groups.forEach((group) => {
        children.push(heading(group.assistiveTechnology, HeadingLevel.HEADING_2));
        group.pairings.forEach(({ test, run }) => {
            appendFunctionalTest(test, run, group.assistiveTechnology);
        });
    });

    function appendFunctionalTest(test: FunctionalTest, run: TestRun, assistiveTechnology: string): void {
        const report = buildTestReport(test, run);
        const score = runScore(run);

        children.push(heading(String(report.name || ''), HeadingLevel.HEADING_3));
        children.push(makeTable([], [
            ['Name', String(report.name || '')],
            ['Goal', String(report.goal || '')],
            ['Operator', String(report.operator || '')],
            ['Start Location', String(report.startLocation || '')],
            ['Operating System', String(report.operatingSystem || '')],
            ['Application', String(report.application || '')]
        ]));

        const stepRows = report.steps.map((step) => {
            const issueLines = (step.issues || []).map((issue) => String(issue.description || ''));
            return [
                String(step.instructions || ''),
                issueLines.length > 0 ? issueLines : ['No issues']
            ];
        });
        children.push(makeTable(['Main Success Case', 'Issues Encountered'], stepRows));

        children.push(text(`Score: ${formatScore(score)}`, { bold: true }));

        children.push(heading(`Problem Summary (${assistiveTechnology})`, HeadingLevel.HEADING_4));
        bullets(report.comments).forEach((paragraph) => children.push(paragraph));

        // The five scores, with the one this functional test reached filled in.
        children.push(new Table({
            rows: SCORE_LABELS.map((entry) => {
                const achieved = entry.score === score;
                const fill = SCORE_FILLS[entry.score];
                return new TableRow({
                    children: [new TableCell({
                        children: [text(entry.label, { bold: achieved })],
                        shading: {
                            type: ShadingType.CLEAR,
                            fill: achieved ? fill.achieved : fill.plain,
                            color: 'auto'
                        }
                    })]
                });
            }),
            width: { size: 100, type: WidthType.PERCENTAGE }
        }));
    }

    return new Document({
        features: { updateFields: true },
        sections: [{ children }]
    });
}

/**
 * Whether the docx library finished loading.
 *
 * It comes from a CDN via a <script> tag, so it is absent whenever the network
 * is unavailable or the request was blocked.
 */
export function isReportLibraryAvailable(): boolean {
    return typeof docx !== 'undefined' && docx !== null;
}

/**
 * Builds the report and triggers a browser download.
 *
 * Every outcome is reported in the status region: leaving "Generating report"
 * on screen after a failure would read as a hang.
 */
export function renderEvalResultsDocx(evaluation: Evaluation): void {
    const statusEl = requireEl('generate-pdf-status');

    if (!isReportLibraryAvailable()) {
        statusEl.textContent =
            'The report library could not be loaded. Check your network connection and reload the page.';
        return;
    }

    statusEl.textContent = 'Generating report, please wait...';

    let doc: unknown;
    try {
        doc = buildEvalResultsDocument(evaluation);
    } catch {
        statusEl.textContent = 'The report could not be generated.';
        return;
    }

    docx.Packer.toBlob(doc).then((blob: Blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'evaluation-results.docx';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        statusEl.textContent = 'Report download complete.';
    }).catch(() => {
        statusEl.textContent = 'The report could not be generated.';
    });
}
