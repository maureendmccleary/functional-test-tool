import { describe, expect, test } from 'vitest';
import { collectSelectedValues, normalizeSelectionValues } from '../src/domain/selection-utils.js';

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
