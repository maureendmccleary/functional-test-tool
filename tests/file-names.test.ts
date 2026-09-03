import { describe, expect, test } from 'vitest';
import { evaluationFileName, reportFileName } from '../src/domain/file-names.js';

/**
 * The evaluation name reaches both of these out of a saved file, so what they
 * refuse matters as much as what they build.
 */

describe('reportFileName', () => {
    test('appends the evaluation name', () => {
        expect(reportFileName('Q3 2026 Accessibility Evaluation'))
            .toBe('evaluation-results - Q3 2026 Accessibility Evaluation.docx');
    });

    test('falls back to the stem alone when there is no name', () => {
        // A file written before the cover fields existed, or simply not filled
        // in. Neither should leave a dangling separator.
        expect(reportFileName('')).toBe('evaluation-results.docx');
        expect(reportFileName('   ')).toBe('evaluation-results.docx');
        expect(reportFileName(undefined)).toBe('evaluation-results.docx');
    });

    test('always ends in .docx', () => {
        ['plain', '', '...', '///'].forEach((name) => {
            expect(reportFileName(name).endsWith('.docx')).toBe(true);
        });
    });

    test('replaces the characters a file name cannot carry', () => {
        expect(reportFileName('Q3/2026: audit'))
            .toBe('evaluation-results - Q3 2026 audit.docx');
        expect(reportFileName('a<b>c"d|e?f*g'))
            .toBe('evaluation-results - a b c d e f g.docx');
    });

    test('cannot be steered out of the download folder', () => {
        // The name comes out of a saved file, so a separator in it must not
        // survive into the download name.
        const built = reportFileName('../../etc/passwd');
        expect(built).not.toContain('/');
        expect(built).not.toContain('\\');
        expect(built).toBe('evaluation-results - .. .. etc passwd.docx');
        expect(built.startsWith('evaluation-results - ')).toBe(true);
    });

    test('leaves a leading dot alone, since the stem is always in front of it', () => {
        expect(reportFileName('.hidden')).toBe('evaluation-results - .hidden.docx');
    });

    test('a name that is nothing but dots falls back to the stem', () => {
        expect(reportFileName('...')).toBe('evaluation-results.docx');
    });

    test('drops trailing dots and spaces, which Windows would strip anyway', () => {
        expect(reportFileName('Audit...')).toBe('evaluation-results - Audit.docx');
        expect(reportFileName('Audit .')).toBe('evaluation-results - Audit.docx');
    });

    test('collapses runs of whitespace, including newlines and tabs', () => {
        expect(reportFileName('Q3\n\t  2026')).toBe('evaluation-results - Q3 2026.docx');
    });

    test('cuts a very long name and still leaves a usable file name', () => {
        const built = reportFileName('x'.repeat(400));
        expect(built.length).toBeLessThan(160);
        expect(built.startsWith('evaluation-results - xxx')).toBe(true);
        expect(built.endsWith('.docx')).toBe(true);
    });

    test('does not end the cut name on a dot or a space', () => {
        expect(reportFileName(`${'x'.repeat(119)}. tail`))
            .toBe(`evaluation-results - ${'x'.repeat(119)}.docx`);
    });
});

describe('evaluationFileName', () => {
    test('offers the evaluation name, which is what the tester would type', () => {
        expect(evaluationFileName('Q3 2026 Accessibility Evaluation'))
            .toBe('Q3 2026 Accessibility Evaluation.json');
    });

    test('falls back to a stem when the evaluation has no name yet', () => {
        // A new evaluation is saved long before its cover fields are filled in.
        expect(evaluationFileName('')).toBe('evaluation.json');
        expect(evaluationFileName('   ')).toBe('evaluation.json');
        expect(evaluationFileName(undefined)).toBe('evaluation.json');
    });

    test('always ends in .json', () => {
        ['plain', '', '...', '///'].forEach((name) => {
            expect(evaluationFileName(name).endsWith('.json')).toBe(true);
        });
    });

    test('scrubs the name the same way the report name is scrubbed', () => {
        expect(evaluationFileName('Q3/2026: audit')).toBe('Q3 2026 audit.json');
        const built = evaluationFileName('../../etc/passwd');
        expect(built).not.toContain('/');
        expect(built).not.toContain('\\');
    });

    test('a name that is nothing but dots falls back to the stem', () => {
        expect(evaluationFileName('...')).toBe('evaluation.json');
    });

    test('cuts a very long name and still leaves a usable file name', () => {
        const built = evaluationFileName('x'.repeat(400));
        expect(built.length).toBeLessThan(140);
        expect(built.endsWith('.json')).toBe(true);
    });
});
