import { describe, expect, test } from 'vitest';
import {
    HEADER_FILL, REPORT_TEXT_COLOR, SCORE_LABELS, scoreRowStyle
} from '../src/domain/report-format.js';

/**
 * Contrast of the report's own colours, checked by arithmetic.
 *
 * The report gives some cells a fixed pale fill, and text on a fixed fill has
 * to be legible whatever theme the reader opens the document in. That is a
 * calculation, not a judgement, so it belongs in the test suite rather than in
 * the manual checklist where it can only be done by eye and only by someone
 * who has Word open.
 *
 * The formula is WCAG 2.2's, unchanged since 2.0.
 */

/** WCAG relative luminance of a six digit hex colour. */
function relativeLuminance(hex: string): number {
    const value = hex.replace('#', '');
    const channels = [0, 2, 4]
        .map((offset) => parseInt(value.slice(offset, offset + 2), 16) / 255)
        .map((channel) => channel <= 0.04045
            ? channel / 12.92
            : Math.pow((channel + 0.055) / 1.055, 2.4));
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

/** WCAG contrast ratio between two colours, from 1:1 to 21:1. */
function contrastRatio(foreground: string, background: string): number {
    const a = relativeLuminance(foreground);
    const b = relativeLuminance(background);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** 1.4.3 Contrast (Minimum), for text below 18pt and not bold. */
const NORMAL_TEXT = 4.5;

describe('contrastRatio', () => {
    test('black on white is the maximum of 21 to 1', () => {
        expect(contrastRatio('000000', 'FFFFFF')).toBeCloseTo(21, 2);
    });

    test('a colour against itself is the minimum of 1 to 1', () => {
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

    test('the achieved row is bold, so colour is not the only cue', () => {
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

describe('table headings', () => {
    test('heading text is legible on the heading fill', () => {
        expect(contrastRatio(REPORT_TEXT_COLOR, HEADER_FILL)).toBeGreaterThanOrEqual(NORMAL_TEXT);
    });
});
