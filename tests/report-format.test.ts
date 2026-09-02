import { describe, expect, test } from 'vitest';
import {
    SCORE_LABELS, buildCoverSubtitle, formatOverallRating,
    formatReportTimestamp, formatScore, formatUseCaseName, reportFileName, scoreLabel
} from '../src/domain/report-format.js';

describe('scoreLabel', () => {
    test('names each of the five scores', () => {
        expect(SCORE_LABELS.map((entry) => entry.score)).toEqual([5, 4, 3, 2, 1]);
        expect(scoreLabel(5)).toBe('Pass - No Accessibility Problem(s)');
        expect(scoreLabel(1)).toBe('Fail - Severe Accessibility Problem(s)');
    });

    test('is empty for a score outside the scale', () => {
        expect(scoreLabel(-1)).toBe('');
        expect(scoreLabel(0)).toBe('');
    });
});

describe('formatScore', () => {
    test('appends the numeric score to its label', () => {
        expect(formatScore(2)).toBe('Fail - Major Accessibility Problem(s) (2)');
    });

    test('reports an unscored run as not rated', () => {
        expect(formatScore(-1)).toBe('Not rated');
    });
});

describe('formatOverallRating', () => {
    test('prints one decimal place', () => {
        expect(formatOverallRating(1)).toBe('1.0');
        expect(formatOverallRating(1.5)).toBe('1.5');
        expect(formatOverallRating(2.3333333)).toBe('2.3');
    });

    test('reports an unset rating as not rated', () => {
        expect(formatOverallRating(-1)).toBe('Not rated');
    });
});

describe('formatUseCaseName', () => {
    test('prepends the number, padded to two digits', () => {
        expect(formatUseCaseName(1, 'Review exit polls')).toBe('01 Review exit polls');
        expect(formatUseCaseName(12, 'Review exit polls')).toBe('12 Review exit polls');
    });

    test('does not truncate past ninety nine', () => {
        expect(formatUseCaseName(100, 'Review exit polls')).toBe('100 Review exit polls');
    });

    test('leaves just the number when the name is blank', () => {
        expect(formatUseCaseName(3, '   ')).toBe('03');
    });

    test('appends the assistive technology', () => {
        expect(formatUseCaseName(1, 'Review exit polls', 'NVDA'))
            .toBe('01 Review exit polls - NVDA');
    });

    test('omits the technology when the script has none', () => {
        expect(formatUseCaseName(1, 'Review exit polls', '   ')).toBe('01 Review exit polls');
    });

    test('omits a number that is not a positive whole one', () => {
        expect(formatUseCaseName(0, 'Review exit polls', 'JAWS')).toBe('Review exit polls - JAWS');
        expect(formatUseCaseName(undefined as unknown as number, 'Review exit polls'))
            .toBe('Review exit polls');
    });
});

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

describe('buildCoverSubtitle', () => {
    test('joins the asset and evaluation name', () => {
        expect(buildCoverSubtitle('Election 2024', 'Q3 2024')).toBe('Election 2024 - Q3 2024');
    });

    test('skips whichever part is missing', () => {
        expect(buildCoverSubtitle('', 'Q3 2024')).toBe('Q3 2024');
        expect(buildCoverSubtitle('Election 2024', '   ')).toBe('Election 2024');
        expect(buildCoverSubtitle(undefined, undefined)).toBe('');
    });
});

describe('formatReportTimestamp', () => {
    test('matches the wording used by the platform export', () => {
        // Local time fields, so the expectation holds in any time zone.
        expect(formatReportTimestamp(new Date(2026, 7, 13, 10, 22)))
            .toBe('Thursday 13th of August 2026 at 10:22 AM');
    });

    test('uses the right ordinal suffix, including the teens', () => {
        const dayOf = (day: number) => formatReportTimestamp(new Date(2026, 0, day, 9, 0)).split(' ')[1];
        expect(dayOf(1)).toBe('1st');
        expect(dayOf(2)).toBe('2nd');
        expect(dayOf(3)).toBe('3rd');
        expect(dayOf(4)).toBe('4th');
        expect(dayOf(11)).toBe('11th');
        expect(dayOf(12)).toBe('12th');
        expect(dayOf(13)).toBe('13th');
        expect(dayOf(21)).toBe('21st');
        expect(dayOf(22)).toBe('22nd');
        expect(dayOf(23)).toBe('23rd');
        expect(dayOf(31)).toBe('31st');
    });
});
