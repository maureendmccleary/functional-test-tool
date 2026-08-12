import type { Evaluation } from '../types.js';
import { buildTestReport } from '../domain/functional-test.js';
import { issuesMap, minimumScore } from '../domain/scoring.js';
import { requireEl } from '../ui/dom.js';

/**
 * Builds the .docx document tree for an evaluation.
 *
 * Separated from the download so the structure can be asserted on directly.
 * `docx` is the UMD global loaded from unpkg by index.html.
 */
export function buildEvalResultsDocument(evaluation: Evaluation): unknown {
    const { Document, Paragraph, TextRun, Table, TableRow, TableCell,
            HeadingLevel, WidthType, ShadingType } = docx;

    function headerCell(text: unknown) {
        return new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: String(text), bold: true })] })],
            shading: { type: ShadingType.CLEAR, fill: 'EEEEEE', color: 'auto' }
        });
    }

    function dataCell(content: unknown) {
        let paragraphs;
        if (Array.isArray(content)) {
            paragraphs = content.map((t: unknown) => new Paragraph({ children: [new TextRun(String(t || ''))] }));
            if (paragraphs.length === 0) {
                paragraphs = [new Paragraph({ text: '' })];
            }
        } else {
            paragraphs = [new Paragraph({ children: [new TextRun(String(content || ''))] })];
        }
        return new TableCell({ children: paragraphs });
    }

    function makeTable(headers: unknown[], dataRows: unknown[][]) {
        const headerRow = new TableRow({
            tableHeader: true,
            children: headers.map(h => headerCell(h))
        });
        const rows = dataRows.map(row => new TableRow({
            children: row.map(c => dataCell(c))
        }));
        return new Table({
            rows: [headerRow, ...rows],
            width: { size: 100, type: WidthType.PERCENTAGE }
        });
    }

    const children: unknown[] = [];

    children.push(new Paragraph({ text: 'Evaluation Results', heading: HeadingLevel.HEADING_1 }));
    children.push(new Paragraph({ text: 'Executive Summary', heading: HeadingLevel.HEADING_2 }));
    children.push(new Paragraph({ text: 'Significant Issues', heading: HeadingLevel.HEADING_2 }));

    if (Array.isArray(evaluation.comments) && evaluation.comments.length > 0) {
        evaluation.comments.forEach(c => {
            children.push(new Paragraph({ text: String(c || ''), bullet: { level: 0 } }));
        });
    } else {
        children.push(new Paragraph({ text: 'No issues.' }));
    }

    children.push(new Paragraph({ text: 'Testing and Scoring Key', heading: HeadingLevel.HEADING_2 }));
    children.push(makeTable(
        ['Score', 'Title', 'Definition'],
        [
            ['5', 'Pass with no accessibility problems', 'The functional test is a complete success. No accessibility problems are found to hinder its completion.'],
            ['4', 'Pass with recommended optimizations', 'The functional test is readily completed, but a slight modification would make it easier or more reliably accessible.'],
            ['3', 'Pass with minor accessibility problems', 'One or more minor accessibility problems makes completion of the functional test more challenging than it should be.'],
            ['2', 'Fail with major accessibility problems', "One or more major accessibility problems that would hinder people with disabilities' ability to complete the functional test."],
            ['1', 'Fail with severe accessibility problems', 'The functional test cannot be completed due to one or more major accessibility problems.'],
        ]
    ));

    evaluation.tests.forEach(test => {
        (test.runs || []).forEach(run => {
            const report = buildTestReport(test, run);
            const testName = String(report.name || '');
            const reportAt = String(report.assistiveTechnology || '');
            const reportOperatingSystem = String(report.operatingSystem || '');
            const reportOperator = String(report.operator || '');
            const reportApplication = String(report.application || '');

            children.push(new Paragraph({ text: `Detailed Results: ${testName}`, heading: HeadingLevel.HEADING_2 }));
            children.push(new Paragraph({ children: [new TextRun({ text: 'Assistive Technology: ', bold: true }), new TextRun(reportAt)] }));
            children.push(new Paragraph({ children: [new TextRun({ text: 'Goal: ', bold: true }), new TextRun(String(report.goal || ''))] }));
            children.push(new Paragraph({ children: [new TextRun({ text: 'Operator: ', bold: true }), new TextRun(reportOperator)] }));
            children.push(new Paragraph({ children: [new TextRun({ text: 'Start Location: ', bold: true }), new TextRun(String(report.startLocation || ''))] }));
            children.push(new Paragraph({ children: [new TextRun({ text: 'Operating System: ', bold: true }), new TextRun(reportOperatingSystem)] }));
            children.push(new Paragraph({ children: [new TextRun({ text: 'Application: ', bold: true }), new TextRun(reportApplication)] }));

            const stepRows = report.steps.map((step, index) => {
                let scoreTotal = 0;
                const issueLines: string[] = [];
                if (step.issues && step.issues.length > 0) {
                    step.issues.forEach(issue => {
                        scoreTotal += parseInt(issue.score) || 0;
                        issueLines.push(String(issue.description || ''));
                    });
                }
                const score = (!step.issues || step.issues.length === 0)
                    ? '5'
                    : String(Math.floor(scoreTotal / step.issues.length));
                return [String(index + 1), String(step.instructions || ''), score, issueLines.length > 0 ? issueLines : ['No issues']];
            });

            children.push(makeTable(['#', 'Main Success Case', 'Score', 'Issues Encountered'], stepRows));

            children.push(new Paragraph({ text: 'Problem Summary', heading: HeadingLevel.HEADING_3 }));
            const score = minimumScore(issuesMap(report));
            children.push(new Paragraph({ children: [
                new TextRun({ text: `${reportAt} Overall Rating: `, bold: true }),
                new TextRun(String(score))
            ]}));

            if (report.comments && report.comments.length > 0) {
                report.comments.forEach(c => {
                    children.push(new Paragraph({ text: String(c || ''), bullet: { level: 0 } }));
                });
            } else {
                children.push(new Paragraph({ text: 'No issues.' }));
            }
        });
    });

    return new Document({ sections: [{ children }] });
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
