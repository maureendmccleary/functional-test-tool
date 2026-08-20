import { describe, expect, test } from 'vitest';
import {
    SCORE_LABELS, buildCoverSubtitle, formatAssistiveTechnology, formatOverallRating,
    formatReportTimestamp, formatScore, formatUseCaseName, scoreLabel
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

describe('formatAssistiveTechnology', () => {
    test('appends a known version', () => {
        expect(formatAssistiveTechnology('JAWS', '2024')).toBe('JAWS 2024');
    });

    test('leaves the name alone when no version is known', () => {
        expect(formatAssistiveTechnology('JAWS', undefined)).toBe('JAWS');
        expect(formatAssistiveTechnology('JAWS', '   ')).toBe('JAWS');
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
