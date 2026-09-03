import type { Evaluation, FunctionalTest, Issue, SummaryComment, TestRun } from '../types.js';
import {
    buildScorecard, effectiveSummaryFor, groupRunsByAssistiveTechnology, runScore
} from '../domain/evaluation.js';
import { reportFileName } from '../domain/file-names.js';
import { groupSummaryComments } from '../domain/summary.js';
import { buildTestReport, testDisplayName } from '../domain/functional-test.js';
import { issueRows } from '../domain/test-run.js';
import {
    BAND_FILL, HEADER_FILL, HEADING_COLOR, REPORT_FONT, REPORT_TEXT_COLOR, SCORE_LABELS,
    SCORING_KEY_PARAGRAPHS, SIGNIFICANT_ISSUES_INTRO, buildCoverSubtitle,
    formatOverallRating, formatReportTimestamp, formatScore, scoreRowStyle, scorecardRows
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
            Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, VerticalAlign,
            VerticalMergeType, WidthType, XmlComponent } = docx;

    /*
     * The width of the text on a Letter page inside Word's default one inch
     * margins, in twentieths of a point. Every table is laid out against it, so
     * the columns of one line up with the columns of the next.
     */
    const CONTENT_WIDTH = 9360;

    /*
     * Room inside every cell, so the text is not pressed against the rules.
     * More at the sides than above and below, which is how a cell reads as
     * padded rather than as merely tall.
     */
    const CELL_MARGINS = { top: 80, bottom: 80, left: 120, right: 120 };

    /*
     * The step and extension tables hold the same four kinds of thing, so they
     * are given the same four columns and line up with each other down the page.
     */
    const STEP_COLUMNS = [800, 3600, 900, 4060];

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
        return new TableCell({
            children: paragraphs,
            verticalAlign: VerticalAlign.TOP,
            ...(options.shading ? { shading: options.shading } : {}),
            ...(options.verticalMerge ? { verticalMerge: options.verticalMerge } : {})
        });
    }

    /**
     * A table of steps or extensions, with one row per issue recorded.
     *
     * Each score shares a row with the finding it belongs to, so Word reads it
     * under the "Score" heading and beside the right description. The step's
     * number and instructions are written on its first row and merged down the
     * rest, which is the report's equivalent of the rowspan the results dialog
     * uses: the step stays identifiable from any of its rows without being
     * repeated on each.
     *
     * Banding follows the step rather than the row, so one step's issues read
     * as one block rather than striping within it.
     */
    function makeIssueTable(
        headers: string[],
        entries: Array<{ instructions: string; issues: Issue[]; outOfScope?: boolean }>
    ) {
        const rows = entries.flatMap((entry, index) => {
            const issues = issueRows(entry);
            const shaded = index % 2 === 1;
            const shading = shaded
                ? { color: REPORT_TEXT_COLOR, shading: bandShading }
                : {};
            // A merged run of cells: the first carries the content, the rest
            // continue it. Word wants a cell in every row either way.
            const spanning = (content: unknown, first: boolean) => cell(first ? content : [], {
                ...shading,
                verticalMerge: first ? VerticalMergeType.RESTART : VerticalMergeType.CONTINUE
            });
            return issues.map((issueRow, rowIndex) => new TableRow({
                children: [
                    spanning(String(index + 1), rowIndex === 0),
                    spanning(String(entry.instructions || ''), rowIndex === 0),
                    cell(issueRow.score, shading),
                    cell(issueRow.description, shading)
                ]
            }));
        });
        return new Table({
            rows: [
                new TableRow({
                    tableHeader: true,
                    children: headers.map((header) => headerCell(header))
                }),
                ...rows
            ],
            width: { size: 100, type: WidthType.PERCENTAGE },
            columnWidths: STEP_COLUMNS
        });
    }

    // The text color is set because the fill is: see REPORT_TEXT_COLOR.
    function headerCell(content: unknown) {
        return new TableCell({
            children: [text(content, { bold: true, color: REPORT_TEXT_COLOR })],
            verticalAlign: VerticalAlign.TOP,
            shading: { type: ShadingType.CLEAR, fill: HEADER_FILL, color: 'auto' }
        });
    }

    /** The shading a banded row's cells carry, and the text color that goes with it. */
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
     * every other row, so a wide row can be followed across its columns, and
     * `columns` fixes the column widths so tables of the same shape line up
     * with each other rather than each being measured from its own contents.
     * `emphasiseLastRow` bolds the last row's values, for a table whose closing
     * row is its headline rather than one more entry.
     *
     * A banded cell is given REPORT_TEXT_COLOR for the same reason a heading
     * cell is: it has a fill of its own, and Word's "auto" can turn the text
     * pale in a dark theme and leave pale on pale.
     */
    function makeTable(
        headers: unknown[],
        dataRows: unknown[][],
        rowHeadings = false,
        { banded = false, columns, emphasiseLastRow = false }: {
            banded?: boolean; columns?: number[]; emphasiseLastRow?: boolean;
        } = {}
    ) {
        const rows = dataRows.map((row, rowIndex) => {
            const shaded = banded && rowIndex % 2 === 1;
            const bold = emphasiseLastRow && rowIndex === dataRows.length - 1;
            return new TableRow({
                children: row.map((c, index) => (
                    rowHeadings && index === 0
                        ? headerCell(c)
                        : cell(c, {
                            ...(bold ? { bold: true } : {}),
                            ...(shaded ? { color: REPORT_TEXT_COLOR, shading: bandShading } : {})
                        })
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
            width: { size: 100, type: WidthType.PERCENTAGE },
            margins: CELL_MARGINS,
            ...(columns ? { columnWidths: columns } : {})
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

    /**
     * A written summary in its severity groups: the banner, then its bullets.
     *
     * The banner is a bold paragraph rather than a heading, so it does not
     * appear in the contents or shift the heading levels around it. Unclassified
     * lines lead, under no banner at all.
     */
    function summaryParagraphs(comments: SummaryComment[] | undefined) {
        const groups = groupSummaryComments(Array.isArray(comments) ? comments : []);
        if (groups.length === 0) {
            return [new Paragraph({ text: 'No issues.' })];
        }
        return groups.flatMap((group) => [
            ...(group.banner === undefined ? [] : [text(group.banner, { bold: true })]),
            ...bullets(group.comments.map((comment) => comment.text))
        ]);
    }

    const children: unknown[] = [];

    /*
     * Cover.
     *
     * Three steps down in size rather than two lines at the same one, so the
     * client's name reads first and the evaluation and "Use Case Results" read
     * as its subtitle. The date and the credit line sit together at the foot,
     * smaller and to the right, as a metadata block rather than more title.
     *
     * All of the spacing is paragraph spacing. An empty paragraph is a blank
     * line a screen reader stops on and reads out, and this is the front page of
     * an accessibility deliverable.
     */
    const subtitle = buildCoverSubtitle(evaluation.asset, evaluation.name);
    const titles = [
        { line: String(evaluation.workspace || ''), bold: true, size: 52, before: 2400 },
        { line: subtitle, bold: false, size: 32, before: 240 },
        { line: 'Use Case Results', bold: false, size: 26, before: 120 }
    ];
    titles.forEach(({ line, bold, size, before }) => {
        if (line === '') {
            return;
        }
        children.push(new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before },
            children: [new TextRun({ text: line, bold, size })]
        }));
    });
    // Both footing lines share a size, so they are set from one constant rather
    // than from two that can drift.
    const footingSize = 20;
    children.push(new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { before: 1440 },
        children: [new TextRun({ text: formatReportTimestamp(now), size: footingSize })]
    }));
    children.push(new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [new TextRun({
            text: 'Produced by Functional Test Tool, Level Access Inc.', size: footingSize
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
    // Overall Rating is the last row and the one a reader looks for first, so it
    // is the row that carries the weight.
    children.push(makeTable(
        [], scorecardRows(scorecard), true,
        { columns: [6000, 3360], emphasiseLastRow: true }
    ));

    children.push(heading('Assistive Technologies Used', HeadingLevel.HEADING_2));
    if (groups.length > 0) {
        // No versions: testing is always done with the current release.
        children.push(makeTable(
            ['Assistive Technologies'],
            groups.map((group) => [group.assistiveTechnology]),
            false, { columns: [CONTENT_WIDTH] }
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
        // A real Heading 2, as everywhere else an assistive technology opens a
        // section. It was a bold paragraph, which looked like a heading to a
        // sighted reader and like nothing at all to anyone navigating by them.
        children.push(heading(group.assistiveTechnology, HeadingLevel.HEADING_2));
        children.push(text(
            `Overall Rating: ${formatOverallRating(summary.overallRating)}`,
            { bold: true }
        ));
        summaryParagraphs(summary.significantIssues)
            .forEach((paragraph) => children.push(paragraph));
    });

    // Scoring key.
    children.push(heading('Testing and Scoring Key', HeadingLevel.HEADING_1));
    SCORING_KEY_PARAGRAPHS.forEach((paragraph) => children.push(new Paragraph({ text: paragraph })));
    /*
     * The one full legend in the report, and so the one place the colors are
     * given their meaning. Each score's own fill sits behind its number here and
     * behind the score row of every use case, and the label is written out
     * beside it in both places, so the color is a second cue and never the
     * only one.
     */
    const scoringKey = new Table({
        rows: [
            new TableRow({
                tableHeader: true,
                children: ['Score', 'Meaning', 'Explanation'].map((h) => headerCell(h))
            }),
            ...SCORE_LABELS.map((entry) => new TableRow({
                children: [
                    new TableCell({
                        children: [text(String(entry.score), {
                            bold: true, color: REPORT_TEXT_COLOR
                        })],
                        verticalAlign: VerticalAlign.TOP,
                        shading: {
                            type: ShadingType.CLEAR,
                            fill: scoreRowStyle(entry.score, true).fill,
                            color: 'auto'
                        }
                    }),
                    cell(entry.label),
                    cell(entry.definition)
                ]
            }))
        ],
        width: { size: 100, type: WidthType.PERCENTAGE },
        margins: CELL_MARGINS,
        columnWidths: [900, 3000, 5460]
    });
    // Built by hand for the shading, so it needs the heading row marking that
    // makeTable would have given it.
    applyTableLook(scoringKey, true, false);
    children.push(scoringKey);

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
        ], true, { columns: [2600, 6760] }));

        children.push(heading('Main Success Case', HeadingLevel.HEADING_4));
        children.push(makeIssueTable(
            ['Step #', 'Main Success Case', 'Score', 'Issues Encountered'], report.steps
        ));

        // Numbered from 1 within the use case, which is how a step refers to
        // one: "Login credentials are located in extension 1".
        const extensions = report.extensions || [];
        if (extensions.length > 0) {
            children.push(heading('Extensions', HeadingLevel.HEADING_4));
            children.push(makeIssueTable(
                ['Extension #', 'Extension', 'Score', 'Issues Encountered'], extensions
            ));
        }

        children.push(scoreRow(score));

        children.push(heading(`Problem Summary (${assistiveTechnology})`, HeadingLevel.HEADING_4));
        summaryParagraphs(report.comments).forEach((paragraph) => children.push(paragraph));
    }

    /*
     * The score this use case reached, as one labelled row.
     *
     * This replaces the full five score legend that used to follow every use
     * case. Printed once per use case it was the bulk of the detailed section
     * and said the same thing each time; the reader who wants it has it in full,
     * once, under Testing and Scoring Key. What belongs here is which score this
     * use case got, and that is a row: the heading cell names it, the value
     * spells the score out in words and figures, and the fill is the same one
     * the key gave that score.
     *
     * An unperformed run scores -1, which formatScore renders "Not rated" and
     * scoreRowStyle has no fill for, so it is left unshaded rather than being
     * colored as though somebody had judged it.
     */
    function scoreRow(score: number) {
        const style = SCORE_LABELS.some((entry) => entry.score === score)
            ? scoreRowStyle(score, true)
            : null;
        const valueCell = new TableCell({
            children: [text(formatScore(score), {
                bold: true, ...(style ? { color: REPORT_TEXT_COLOR } : {})
            })],
            verticalAlign: VerticalAlign.TOP,
            ...(style
                ? { shading: { type: ShadingType.CLEAR, fill: style.fill, color: 'auto' } }
                : {})
        });
        const table = new Table({
            rows: [new TableRow({ children: [headerCell('Score'), valueCell] })],
            width: { size: 60, type: WidthType.PERCENTAGE },
            margins: CELL_MARGINS,
            columnWidths: [1400, 4216]
        });
        applyTableLook(table, false, true);
        return table;
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
    function headingStyle(size: number | undefined, before: number, italics = false) {
        return {
            run: { font: REPORT_FONT, color: HEADING_COLOR, ...(size ? { size } : {}), italics },
            paragraph: { spacing: { before, after: 160 } }
        };
    }

    return new Document({
        styles: {
            default: {
                document: { run: { font: REPORT_FONT } },
                heading1: headingStyle(32, 640),
                heading2: headingStyle(26, 480),
                heading3: headingStyle(24, 400),
                heading4: headingStyle(undefined, 280, true)
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
        a.download = reportFileName(evaluation.name);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showStatusMessage('generate-pdf-status', 'Report download complete.', 0);
    }).catch(() => {
        showStatusMessage('generate-pdf-status', 'The report could not be generated.', 0);
    });
}
