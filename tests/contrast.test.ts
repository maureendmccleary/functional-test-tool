import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import {
    BAND_FILL, HEADER_FILL, REPORT_TEXT_COLOR, SCORE_LABELS, scoreRowStyle, scorecardRows
} from '../src/domain/report-format.js';

/**
 * Contrast of the report's own colors, checked by arithmetic.
 *
 * The report gives some cells a fixed pale fill, and text on a fixed fill has
 * to be legible whatever theme the reader opens the document in. That is a
 * calculation, not a judgement, so it belongs in the test suite rather than in
 * the manual checklist where it can only be done by eye and only by someone
 * who has Word open.
 *
 * The formula is WCAG 2.2's, unchanged since 2.0.
 */

/** WCAG relative luminance of a six digit hex color. */
function relativeLuminance(hex: string): number {
    const value = hex.replace('#', '');
    const channels = [0, 2, 4]
        .map((offset) => parseInt(value.slice(offset, offset + 2), 16) / 255)
        .map((channel) => channel <= 0.04045
            ? channel / 12.92
            : Math.pow((channel + 0.055) / 1.055, 2.4));
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

/** WCAG contrast ratio between two colors, from 1:1 to 21:1. */
function contrastRatio(foreground: string, background: string): number {
    const a = relativeLuminance(foreground);
    const b = relativeLuminance(background);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** 1.4.3 Contrast (Minimum), for text below 18pt and not bold. */
const NORMAL_TEXT = 4.5;

/** 1.4.11 Non-text Contrast, for a focus ring and other meaningful shapes. */
const NON_TEXT = 3;

describe('contrastRatio', () => {
    test('black on white is the maximum of 21 to 1', () => {
        expect(contrastRatio('000000', 'FFFFFF')).toBeCloseTo(21, 2);
    });

    test('a color against itself is the minimum of 1 to 1', () => {
        expect(contrastRatio('92D050', '92D050')).toBeCloseTo(1, 2);
    });

    test('it does not care which way round the pair is given', () => {
        expect(contrastRatio('000000', 'E06666')).toBeCloseTo(contrastRatio('E06666', '000000'), 5);
    });

    test('it accepts a leading hash', () => {
        expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 2);
    });
});

describe('the score key', () => {
    for (const { score, label } of SCORE_LABELS) {
        for (const achieved of [false, true]) {
            const state = achieved ? 'achieved' : 'not achieved';
            test(`${label} (${score}), ${state}, is legible on its fill`, () => {
                const { fill } = scoreRowStyle(score, achieved);
                expect(contrastRatio(REPORT_TEXT_COLOR, fill)).toBeGreaterThanOrEqual(NORMAL_TEXT);
            });
        }
    }

    test('the achieved row is bold, so color is not the only cue', () => {
        // The pale and strong fills of one score differ by as little as
        // 1.29:1, far below the 3:1 that would let the fill carry the meaning
        // on its own. The bold is what makes the row findable.
        for (const { score } of SCORE_LABELS) {
            expect(scoreRowStyle(score, true).bold).toBe(true);
            expect(scoreRowStyle(score, false).bold).toBe(false);
        }
    });

    test('every score has a fill of its own in each state', () => {
        const fills = SCORE_LABELS.flatMap(({ score }) => [
            scoreRowStyle(score, false).fill, scoreRowStyle(score, true).fill
        ]);
        expect(new Set(fills).size).toBe(fills.length);
    });
});

describe('the scorecard rows', () => {
    const scorecard = {
        totalRuns: 7,
        countsByScore: new Map([[1, 1], [2, 0], [3, 2], [4, 3], [5, 1]]),
        overallRating: 3.5
    };

    test('every score gets a row, between the total and the rating', () => {
        expect(scorecardRows(scorecard).map(([label]) => label)).toEqual([
            'Total Number of Use Cases',
            'Use Cases that Scored a 1 (worst)',
            'Use Cases that Scored a 2',
            'Use Cases that Scored a 3',
            'Use Cases that Scored a 4',
            'Use Cases that Scored a 5 (best)',
            'Overall Rating'
        ]);
    });

    test('it reports the count held for each score', () => {
        const rows = scorecardRows(scorecard);
        expect(rows[1][1]).toBe('1');
        expect(rows[3][1]).toBe('2');
        expect(rows[5][1]).toBe('1');
    });

    test('a score nobody reached reads as zero rather than as blank', () => {
        expect(scorecardRows(scorecard)[2][1]).toBe('0');
    });

    test('the rating is formatted, not printed raw', () => {
        expect(scorecardRows(scorecard)[6][1]).toBe('3.5');
        expect(scorecardRows({ ...scorecard, overallRating: -1 })[6][1]).toBe('Not rated');
    });
});

describe('table headings', () => {
    test('heading text is legible on the heading fill', () => {
        expect(contrastRatio(REPORT_TEXT_COLOR, HEADER_FILL)).toBeGreaterThanOrEqual(NORMAL_TEXT);
    });
});

describe('banded rows', () => {
    test('text is legible on the band', () => {
        expect(contrastRatio(REPORT_TEXT_COLOR, BAND_FILL)).toBeGreaterThanOrEqual(NORMAL_TEXT);
    });

    test('the band is not so dark that it reads as a heading fill', () => {
        // Banding is an aid to the eye and nothing more. If it ever grew darker
        // than the fill behind a heading cell it would start to look like one.
        expect(relativeLuminance(BAND_FILL)).toBeGreaterThan(relativeLuminance('808080'));
    });
});

/*
 * The same arithmetic pointed at the stylesheet.
 *
 * styles.css names its palette once in :root and then only ever refers to those
 * tokens, so the pairs the sheet actually puts together are a short list and
 * checking them is the same calculation the report's colors already get. The
 * alternative is a comment claiming a ratio, which is exactly the kind of claim
 * that goes stale the first time somebody nudges a color.
 */
describe('the stylesheet palette', () => {
    const stylesheet = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

    /** The value of a custom property declared in the sheet's :root block. */
    function token(name: string): string {
        const match = new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6});`).exec(stylesheet);
        if (match === null) {
            throw new Error(`styles.css no longer declares --${name}`);
        }
        return match[1];
    }

    const WHITE = '#ffffff';

    describe('text on a fill', () => {
        const pairs: [string, string, string][] = [
            ['a button label', WHITE, token('brand')],
            ['a hovered button label', WHITE, token('brand-hover')],
            ['a delete button icon', WHITE, token('danger')],
            ['a hovered delete button icon', WHITE, token('danger-hover')],
            ['body text', token('text'), token('surface')],
            ['a table heading', token('text'), token('surface-muted')],
            ['a status line', token('text-muted'), token('surface')],
            ['a link', token('brand'), token('surface')]
        ];

        for (const [what, foreground, background] of pairs) {
            test(`${what} is legible`, () => {
                expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(NORMAL_TEXT);
            });
        }
    });

    /*
     * The ring is two tones, so both edges of it are checked: the dark ring
     * against the page it is drawn on, and the white spacer against each fill
     * it can hug. One of the two carries the indicator whichever side a given
     * edge falls on, which is what lets one rule serve every control.
     */
    describe('the focus ring', () => {
        const pairs: [string, string, string][] = [
            ['the ring against the page', token('focus-ring'), token('surface')],
            ['the ring against a card', token('focus-ring'), token('surface-muted')],
            ['the spacer against a button', WHITE, token('brand')],
            ['the spacer against a delete button', WHITE, token('danger')]
        ];

        for (const [what, foreground, background] of pairs) {
            test(`${what} clears 3 to 1`, () => {
                expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(NON_TEXT);
            });
        }
    });
});
