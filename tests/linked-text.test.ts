import { describe, expect, test } from 'vitest';
import { hasLink, linkedParts } from '../src/domain/linked-text.js';

/**
 * The second place a saved file becomes a link, after the start location. What
 * it refuses matters as much as what it finds.
 */

/** The parts rejoined, which must always be the text that went in. */
function rejoined(text: string): string {
    return linkedParts(text).map((part) => part.text).join('');
}

/** Just the addresses found, in order. */
function links(text: string): string[] {
    return linkedParts(text).filter((part) => part.href !== undefined).map((part) => part.text);
}

describe('linkedParts', () => {
    test('finds an address written into a sentence', () => {
        expect(linkedParts('Sign in at https://example.org/account and continue.')).toEqual([
            { text: 'Sign in at ' },
            { text: 'https://example.org/account', href: 'https://example.org/account' },
            { text: ' and continue.' }
        ]);
    });

    test('text with no address comes back whole', () => {
        expect(linkedParts('Search the catalogue.')).toEqual([{ text: 'Search the catalogue.' }]);
    });

    test('finds several addresses in one step', () => {
        expect(links('Open https://example.org/a then https://example.org/b'))
            .toEqual(['https://example.org/a', 'https://example.org/b']);
    });

    test('handles an address at the very start and the very end', () => {
        expect(links('https://example.org/a')).toEqual(['https://example.org/a']);
        expect(linkedParts('https://example.org/a')).toHaveLength(1);
    });

    test('never loses or changes a character of the text', () => {
        [
            'Sign in at https://example.org/account and continue.',
            'no address here at all',
            'https://example.org/a and https://example.org/b.',
            '(see https://example.org/holds) then stop',
            ''
        ].forEach((text) => expect(rejoined(text)).toBe(text));
    });
});

describe('punctuation around an address', () => {
    test('a full stop ends the sentence, not the address', () => {
        expect(links('Go to https://example.org/holds.')).toEqual(['https://example.org/holds']);
    });

    test('so do the other sentence endings', () => {
        [',', ';', ':', '!', '?'].forEach((mark) => {
            expect(links(`Go to https://example.org/holds${mark}`))
                .toEqual(['https://example.org/holds']);
        });
    });

    test('a bracket that the address did not open is not part of it', () => {
        expect(links('(see https://example.org/holds)')).toEqual(['https://example.org/holds']);
        expect(links('[see https://example.org/holds]')).toEqual(['https://example.org/holds']);
    });

    test('a bracket the address did open is kept', () => {
        // Plenty of real addresses carry balanced brackets.
        expect(links('See https://example.org/wiki/Hold_(library)'))
            .toEqual(['https://example.org/wiki/Hold_(library)']);
    });

    test('quotes around an address are not part of it', () => {
        expect(links('Open "https://example.org/holds"')).toEqual(['https://example.org/holds']);
    });

    test('several trailing marks all come off', () => {
        expect(links('Go to https://example.org/holds).')).toEqual(['https://example.org/holds']);
    });
});

describe('what is refused', () => {
    test('an address with no scheme is left as prose', () => {
        // Guessing a scheme is how a link ends up somewhere nobody meant.
        expect(links('Go to catalogue.example.org/holds')).toEqual([]);
        expect(links('Go to www.example.org/holds')).toEqual([]);
    });

    test('a scheme that runs as script is left as prose', () => {
        const dangerous = 'javascript:alert(1)';
        expect(links(`Go to ${dangerous}`)).toEqual([]);
        expect(rejoined(`Go to ${dangerous}`)).toBe(`Go to ${dangerous}`);
    });

    test('a data URL is left as prose', () => {
        expect(links('Go to data:text/html,<script>alert(1)</script>')).toEqual([]);
    });

    test('the scheme is matched whatever its case', () => {
        expect(links('Go to HTTPS://example.org/holds')).toEqual(['HTTPS://example.org/holds']);
    });
});

describe('hasLink', () => {
    test('is true only when something would be linked', () => {
        expect(hasLink('Go to https://example.org/holds')).toBe(true);
        expect(hasLink('Go to catalogue.example.org/holds')).toBe(false);
        expect(hasLink('')).toBe(false);
    });
});
