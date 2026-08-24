import { describe, expect, test } from 'vitest';
import {
    collectSelectedValues, findTypeAheadIndex, normalizeSelectionValues, stepIndex
} from '../src/domain/selection-utils.js';

describe('normalizeSelectionValues', () => {
    test('removes duplicates', () => {
        expect(normalizeSelectionValues(['Windows', 'Windows', 'Android']))
            .toEqual(['Windows', 'Android']);
    });

    test('trims and drops empty values', () => {
        expect(normalizeSelectionValues(['  VoiceOver ', 'Android', '']))
            .toEqual(['VoiceOver', 'Android']);
    });

    test('applies the alias map case-insensitively', () => {
        expect(normalizeSelectionValues(['Android', 'TalkBack', 'android'], {
            android: 'TalkBack',
            talkback: 'TalkBack'
        })).toEqual(['TalkBack']);
    });

    test('coerces non-array input', () => {
        expect(normalizeSelectionValues(undefined)).toEqual([]);
        expect(normalizeSelectionValues(null)).toEqual([]);
        expect(normalizeSelectionValues('NVDA')).toEqual(['NVDA']);
    });
});

describe('collectSelectedValues', () => {
    test('keeps only checked boxes, in order', () => {
        expect(collectSelectedValues([
            { checked: true, value: 'Windows' },
            { checked: false, value: 'Android' },
            { checked: true, value: 'VoiceOver' },
            { checked: true, value: 'Windows' }
        ])).toEqual(['Windows', 'VoiceOver']);
    });

    test('tolerates null-ish input', () => {
        expect(collectSelectedValues(undefined)).toEqual([]);
        expect(collectSelectedValues([null, { checked: true, value: 'JAWS' }])).toEqual(['JAWS']);
    });
});

describe('findTypeAheadIndex', () => {
    const labels = [
        'AssistiveTouch', 'JAWS', 'NVDA', 'Switch Control',
        'Voice Control', 'VoiceOver', 'VoiceView', 'Zoom'
    ];

    test('one letter moves to the first entry starting with it', () => {
        expect(findTypeAheadIndex(labels, 'j', 0)).toBe(1);
    });

    test('repeating the letter cycles through the entries sharing it', () => {
        expect(findTypeAheadIndex(labels, 'v', 0)).toBe(4);
        expect(findTypeAheadIndex(labels, 'vv', 4)).toBe(5);
        expect(findTypeAheadIndex(labels, 'vvv', 5)).toBe(6);
    });

    test('cycling wraps round to the start', () => {
        expect(findTypeAheadIndex(labels, 'vv', 6)).toBe(4);
    });

    test('a longer query narrows without skipping the current entry', () => {
        // Already on VoiceOver, typing the whole word should stay put rather
        // than jump to VoiceView.
        expect(findTypeAheadIndex(labels, 'voiceo', 5)).toBe(5);
        expect(findTypeAheadIndex(labels, 'voicev', 5)).toBe(6);
    });

    test('it ignores case', () => {
        expect(findTypeAheadIndex(labels, 'ZO', 0)).toBe(7);
    });

    test('no match reports -1', () => {
        expect(findTypeAheadIndex(labels, 'q', 0)).toBe(-1);
        expect(findTypeAheadIndex(labels, '', 0)).toBe(-1);
    });

    test('it copes with an empty list', () => {
        expect(findTypeAheadIndex([], 'a', 0)).toBe(-1);
    });
});

describe('stepIndex', () => {
    test('moves forward and back', () => {
        expect(stepIndex(5, 1, 1)).toBe(2);
        expect(stepIndex(5, 1, -1)).toBe(0);
    });

    test('wraps at the end and at the start', () => {
        expect(stepIndex(5, 4, 1)).toBe(0);
        expect(stepIndex(5, 0, -1)).toBe(4);
    });

    test('copes with nothing focused yet', () => {
        // -1 means focus is not on a checkbox; Down should reach the first.
        expect(stepIndex(5, -1, 1)).toBe(0);
    });

    test('an empty list has nowhere to go', () => {
        expect(stepIndex(0, 0, 1)).toBe(-1);
    });
});
