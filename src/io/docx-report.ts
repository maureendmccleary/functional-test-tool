import type { Evaluation, FunctionalTest, TestRun } from '../types.js';
import {
    buildScorecard, effectiveSummaryFor, groupRunsByAssistiveTechnology, runScore, stepScore
} from '../domain/evaluation.js';
import { buildTestReport, testDisplayName } from '../domain/functional-test.js';
import {
    BAND_FILL, HEADER_FILL, HEADING_COLOR, REPORT_FONT, REPORT_TEXT_COLOR, SCORE_LABELS,
    SCORING_KEY_PARAGRAPHS, SIGNIFICANT_ISSUES_INTRO, buildCoverSubtitle,
    formatOverallRating, formatReportTimestamp, formatScore, scoreKeyRows
} from '../domain/report-format.js';
import { showStatusMessage } from '../ui/status.js';

/**
 * Builds the .docx document tree for an evaluation.
 *
 * Separated from the download so the structure can be asserted on directly.
 * `docx` is the UMD global loaded from unpkg by index.html.
 *
 * The layout follows the platform export this replaces: a cover, a table of
 * contents, a scorecard, the significant issues per assistive technology, the
 * scoring key, then the detailed results grouped by assistive technology
 * rather than by use case.
 */

/**
 * The part of a docx `Table` that `applyTableLook` writes to: the table
 * properties element, which is always the first entry of a Table's `root`.
 */
interface TableWithProperties {
    root: Array<{ root: unknown[] }>;
}

/** Bookmark names the contents list links to. Word requires no spaces here. */
function assistiveTechnologyBookmark(groupIndex: number): string {
    return `at${groupIndex}`;
}

function useCaseBookmark(groupIndex: number, pairingIndex: number): string {
    return `uc${groupIndex}_${pairingIndex}`;
}

export function buildEvalResultsDocument(evaluation: Evaluation, now: Date = new Date()): unknown {
    const { AlignmentType, Bookmark, Document, HeadingLevel, InternalHyperlink, PageBreak,
            Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, WidthType,
            XmlComponent } = docx;

    function text(content: unknown, options: Record<string, unknown> = {}) {
        return new Paragraph({ children: [new TextRun({ text: String(content ?? ''), ...options })] });
    }

    function heading(content: string, level: unknown) {
        return new Paragraph({ text: content, heading: level });
    }

    /** A heading the contents list can link to. */
    function bookmarkedHeading(content: string, level: unknown, anchor: string) {
        return new Paragraph({
            heading: level,
            children: [new Bookmark({ id: anchor, children: [new TextRun(content)] })]
        });
    }

    /** One line of the contents list, linking to a bookmarked heading. */
    function contentsEntry(content: string, anchor: string, indented: boolean) {
        return new Paragraph({
            indent: indented ? { left: 360 } : undefined,
            children: [new InternalHyperlink({
                anchor,
                children: [new TextRun({ text: content, style: 'Hyperlink' })]
            })]
        });
    }

    function cell(content: unknown, options: Record<string, unknown> = {}) {
        const lines = Array.isArray(content) ? content : [content];
        const paragraphs = lines.length > 0
            ? lines.map((line: unknown) => text(line, options))
            : [new Paragraph({ text: '' })];
        return new TableCell({ children: paragraphs, ...(options.shading ? { shading: options.shading } : {}) });
    }

    // The text colour is set because the fill is: see REPORT_TEXT_COLOR.
    function headerCell(content: unknown) {
        return new TableCell({
            children: [text(content, { bold: true, color: REPORT_TEXT_COLOR })],
            shading: { type: ShadingType.CLEAR, fill: HEADER_FILL, color: 'auto' }
        });
    }

    /** The shading a banded row's cells carry, and the text colour that goes with it. */
    const bandShading = { type: ShadingType.CLEAR, fill: BAND_FILL, color: 'auto' };

    /**
     * Records which of a table's first row and first column are headings.
     *
     * OOXML has no per-cell equivalent of `<th>`. Word stores the choice as
     * `w:tblLook` -- the "Header Row" and "First Column" checkboxes in Table
     * Design -- and that is what a screen reader reads to work out which
     * headings belong to a cell. `docx@8.5.0` exposes no API for it, so the
     * element is pushed straight into the table properties.
     *
     * Reaching into the library like this is safe only because the version is
     * pinned by the subresource integrity hash in index.html: the internals
     * cannot shift without a deliberate version bump, which is already a
     * documented, deliberate change. See ARCHITECTURE.md.
     */
    function applyTableLook(table: TableWithProperties, firstRow: boolean, firstColumn: boolean): void {
        const look = new XmlComponent('w:tblLook');
        look.root.push({
            _attr: {
                'w:firstRow': firstRow ? '1' : '0',
                'w:firstColumn': firstColumn ? '1' : '0',
                'w:lastRow': '0',
                'w:lastColumn': '0',
                'w:noHBand': '0',
                'w:noVBand': '1'
            }
        });
        table.root[0].root.push(look);
    }

    /**
     * A table, optionally with column headings and row headings.
     *
     * `rowHeadings` turns each row's first cell into a heading, which is what
     * a label and value table like the scorecard needs: without it a screen
     * reader reads the value with nothing to say what it is. `banded` shades
     * every other row, so a wide row can be followed across its columns.
     *
     * A banded cell is given REPORT_TEXT_COLOR for the same reason a heading
     * cell is: it has a fill of its own, and Word's "auto" can turn the text
     * pale in a dark theme and leave pale on pale.
     */
    function makeTable(
        headers: unknown[],
        dataRows: unknown[][],
        rowHeadings = false,
        { banded = false } = {}
    ) {
        const rows = dataRows.map((row, rowIndex) => {
            const shaded = banded && rowIndex % 2 === 1;
            return new TableRow({
                children: row.map((c, index) => (
                    rowHeadings && index === 0
                        ? headerCell(c)
                        : cell(c, shaded
                            ? { color: REPORT_TEXT_COLOR, shading: bandShading }
                            : {})
                ))
            });
        });
        const table = new Table({
            rows: headers.length > 0
                ? [
                    new TableRow({
                        tableHeader: true,
                        children: headers.map((header) => headerCell(header))
                    }),
                    ...rows
                ]
                : rows,
            width: { size: 100, type: WidthType.PERCENTAGE }
        });
        applyTableLook(table, headers.length > 0, rowHeadings);
        return table;
    }

    /** Bullets, or a single "No issues." line when the list is empty. */
    function bullets(items: string[] | undefined) {
        if (!Array.isArray(items) || items.length === 0) {
            return [new Paragraph({ text: 'No issues.' })];
        }
        return items.map((item) => new Paragraph({ text: String(item || ''), bullet: { level: 0 } }));
    }

    const children: unknown[] = [];

    // Cover. The titles are centred; the timestamp follows them smaller, and it
    // and the credit line below it are both set to the right, so the two read as
    // a footing to the titles rather than as more of them.
    const subtitle = buildCoverSubtitle(evaluation.asset, evaluation.name);
    const titles = [
        { line: String(evaluation.workspace || ''), bold: true, size: 40 },
        { line: subtitle, bold: false, size: 28 },
        { line: 'Use Case Results', bold: false, size: 28 }
    ];
    titles.forEach(({ line, bold, size }) => {
        if (line === '') {
            return;
        }
        children.push(new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: line, bold, size })]
        }));
    });
    children.push(new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [new TextRun({ text: formatReportTimestamp(now), size: 20 })]
    }));
    children.push(new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [new TextRun({
            text: 'Produced by Functional Test Tool, Level Access Inc.', size: 28
        })]
    }));
    children.push(new Paragraph({ children: [new PageBreak()] }));

    const scorecard = buildScorecard(evaluation);
    const groups = groupRunsByAssistiveTechnology(evaluation);

    // Table of contents, written out from the evaluation rather than left to a
    // Word field. A field would carry page numbers, but Word cannot fill them
    // in without being asked to update fields when the document opens, and
    // that prompt is worse than the missing page numbers. These entries are
    // ordinary internal hyperlinks, so they work the moment the file opens.
    children.push(heading('Table of Contents', HeadingLevel.HEADING_1));
    groups.forEach((group, groupIndex) => {
        children.push(contentsEntry(
            group.assistiveTechnology, assistiveTechnologyBookmark(groupIndex), false
        ));
        group.pairings.forEach(({ test }, pairingIndex) => {
            children.push(contentsEntry(
                testDisplayName(test),
                useCaseBookmark(groupIndex, pairingIndex),
                true
            ));
        });
    });
    if (groups.length === 0) {
        children.push(new Paragraph({ text: 'No use cases have been performed yet.' }));
    }
    children.push(new Paragraph({ children: [new PageBreak()] }));

    // Summary: the scorecard, then the assistive technologies used.

    children.push(heading('Use Case Results Summary', HeadingLevel.HEADING_1));
    children.push(heading('Scorecard', HeadingLevel.HEADING_2));
    children.push(makeTable([], [
        ['Total Number of Use Cases', String(scorecard.totalRuns)],
        ['1 (worst)', String(scorecard.countsByScore.get(1) || 0)],
        ['2', String(scorecard.countsByScore.get(2) || 0)],
        ['3', String(scorecard.countsByScore.get(3) || 0)],
        ['4', String(scorecard.countsByScore.get(4) || 0)],
        ['Use Cases that Scored a 5 (best)', String(scorecard.countsByScore.get(5) || 0)],
        ['Overall Rating', formatOverallRating(scorecard.overallRating)]
    ], true));

    children.push(heading('Assistive Technologies Used', HeadingLevel.HEADING_2));
    if (groups.length > 0) {
        // No versions: testing is always done with the current release.
        children.push(makeTable(
            ['Assistive Technologies'],
            groups.map((group) => [group.assistiveTechnology])
        ));
    } else {
        children.push(new Paragraph({ text: 'No use cases have been performed yet.' }));
    }

    // Significant issues, per assistive technology.
    children.push(heading('Significant Issues', HeadingLevel.HEADING_1));
    children.push(new Paragraph({ text: SIGNIFICANT_ISSUES_INTRO }));
    if (groups.length === 0) {
        children.push(new Paragraph({ text: 'No issues.' }));
    }
    groups.forEach((group) => {
        const summary = effectiveSummaryFor(evaluation, group.assistiveTechnology);
        children.push(text(
            `${group.assistiveTechnology} Overall Rating: ${formatOverallRating(summary.overallRating)}`,
            { bold: true }
        ));
        bullets(summary.significantIssues).forEach((paragraph) => children.push(paragraph));
    });

    // Scoring key.
    children.push(heading('Testing and Scoring Key', HeadingLevel.HEADING_1));
    SCORING_KEY_PARAGRAPHS.forEach((paragraph) => children.push(new Paragraph({ text: paragraph })));
    children.push(makeTable(
        ['Score', 'Meaning', 'Explanation'],
        SCORE_LABELS.map((entry) => [String(entry.score), entry.label, entry.definition])
    ));

    // Detailed results, grouped by assistive technology.
    children.push(heading('Detailed Use Case Results', HeadingLevel.HEADING_1));
    groups.forEach((group, groupIndex) => {
        children.push(bookmarkedHeading(
            group.assistiveTechnology, HeadingLevel.HEADING_2, assistiveTechnologyBookmark(groupIndex)
        ));
        group.pairings.forEach(({ test, run }, pairingIndex) => {
            appendFunctionalTest(
                test, run, group.assistiveTechnology,
                useCaseBookmark(groupIndex, pairingIndex)
            );
        });
    });

    function appendFunctionalTest(
        test: FunctionalTest, run: TestRun, assistiveTechnology: string, anchor: string
    ): void {
        const report = buildTestReport(test, run);
        const score = runScore(run);
        const useCaseName = testDisplayName(test);

        children.push(bookmarkedHeading(useCaseName, HeadingLevel.HEADING_3, anchor));

        // The heading between the two tables is load bearing, not decoration.
        // Word renders two <w:tbl> elements with no block-level content between
        // them as a single table, which merged the use case's details into its
        // steps and left a screen reader reading the details with the step
        // table's column headings attached to them.
        children.push(heading('Overall Information', HeadingLevel.HEADING_4));
        children.push(makeTable([], [
            ['Name', useCaseName],
            ['Goal', String(report.goal || '')],
            ['Operator', String(report.operator || '')],
            ['Start Location', String(report.startLocation || '')],
            ['Operating System', String(report.operatingSystem || '')],
            ['Application', String(report.application || '')]
        ], true));

        children.push(heading('Main Success Case', HeadingLevel.HEADING_4));
        const stepRows = report.steps.map((step, stepIndex) => {
            const issueLines = (step.issues || []).map((issue) => String(issue.description || ''));
            return [
                String(stepIndex + 1),
                String(step.instructions || ''),
                String(stepScore({ issues: step.issues || [] })),
                issueLines.length > 0 ? issueLines : ['No issues']
            ];
        });
        children.push(makeTable(
            ['Step #', 'Main Success Case', 'Score', 'Issues Encountered'], stepRows,
            false, { banded: true }
        ));

        // Numbered from 1 within the use case, which is how a step refers to
        // one: "Login credentials are located in extension 1".
        const extensions = report.extensions || [];
        if (extensions.length > 0) {
            children.push(heading('Extensions', HeadingLevel.HEADING_4));
            children.push(makeTable(
                ['Extension #', 'Extension', 'Score', 'Issues Encountered'],
                extensions.map((extension, extensionIndex) => {
                    const issueLines = (extension.issues || [])
                        .map((issue) => String(issue.description || ''));
                    return [
                        String(extensionIndex + 1),
                        String(extension.instructions || ''),
                        String(stepScore({ issues: extension.issues || [] })),
                        issueLines.length > 0 ? issueLines : ['No issues']
                    ];
                }),
                false, { banded: true }
            ));
        }

        children.push(text(`Score: ${formatScore(score)}`, { bold: true }));

        children.push(heading(`Problem Summary (${assistiveTechnology})`, HeadingLevel.HEADING_4));
        bullets(report.comments).forEach((paragraph) => children.push(paragraph));

        // The five scores, with the one this use case reached filled in.
        children.push(new Table({
            rows: scoreKeyRows(score).map((row) => new TableRow({
                children: [new TableCell({
                    children: [text(row.label, { bold: row.bold, color: REPORT_TEXT_COLOR })],
                    shading: { type: ShadingType.CLEAR, fill: row.fill, color: 'auto' }
                })]
            })),
            width: { size: 100, type: WidthType.PERCENTAGE }
        }));
    }

    /*
     * Arial everywhere and black headings, with room above and below each one.
     *
     * The space is set on the heading styles rather than written in as empty
     * paragraphs: an empty paragraph is a blank line a screen reader stops on
     * and announces, and this report is a deliverable of an accessibility
     * evaluation. Spacing puts the same gap on the page with nothing in it to
     * read.
     *
     * Naming a heading level here replaces the library's own style for it
     * outright rather than adding to it, so each level repeats the size docx
     * gave it and level four its italic. Leaving those out flattens every
     * heading to body size, which is how the hierarchy goes missing. Only the
     * four levels the report actually uses are named.
     */
    function headingStyle(size?: number, italics = false) {
        return {
            run: { font: REPORT_FONT, color: HEADING_COLOR, ...(size ? { size } : {}), italics },
            paragraph: { spacing: { before: 240, after: 240 } }
        };
    }

    return new Document({
        styles: {
            default: {
                document: { run: { font: REPORT_FONT } },
                heading1: headingStyle(32),
                heading2: headingStyle(26),
                heading3: headingStyle(24),
                heading4: headingStyle(undefined, true)
            }
        },
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
    if (!isReportLibraryAvailable()) {
        showStatusMessage(
            'generate-pdf-status',
            'The report library could not be loaded. Check your network connection and reload the page.',
            0
        );
        return;
    }

    showStatusMessage('generate-pdf-status', 'Generating report, please wait...', 0);

    let doc: unknown;
    try {
        doc = buildEvalResultsDocument(evaluation);
    } catch {
        showStatusMessage('generate-pdf-status', 'The report could not be generated.', 0);
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
        showStatusMessage('generate-pdf-status', 'Report download complete.', 0);
    }).catch(() => {
        showStatusMessage('generate-pdf-status', 'The report could not be generated.', 0);
    });
}
