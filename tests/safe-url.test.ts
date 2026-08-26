import { describe, expect, test } from 'vitest';
import { safeLinkUrl } from '../src/domain/safe-url.js';

describe('safeLinkUrl', () => {
    test('allows the web schemes', () => {
        expect(safeLinkUrl('https://catalogue.example.org/holds')).toBe('https://catalogue.example.org/holds');
        expect(safeLinkUrl('http://example.org')).toBe('http://example.org');
    });

    test('refuses a javascript URL', () => {
        // The whole point: a saved file must not be able to run code on a click.
        expect(safeLinkUrl('javascript:alert(document.cookie)')).toBe('');
        expect(safeLinkUrl('JavaScript:alert(1)')).toBe('');
        expect(safeLinkUrl('  javascript:alert(1)  ')).toBe('');
    });

    test('refuses a data URL', () => {
        expect(safeLinkUrl('data:text/html,<script>alert(1)</script>')).toBe('');
    });

    test('refuses other schemes', () => {
        expect(safeLinkUrl('file:///etc/passwd')).toBe('');
        expect(safeLinkUrl('vbscript:msgbox(1)')).toBe('');
    });

    test('refuses an address with no scheme rather than guessing one', () => {
        expect(safeLinkUrl('example.org/page')).toBe('');
        expect(safeLinkUrl('/holds')).toBe('');
    });

    test('treats missing and blank values as no link', () => {
        expect(safeLinkUrl('')).toBe('');
        expect(safeLinkUrl('   ')).toBe('');
        expect(safeLinkUrl(undefined)).toBe('');
        expect(safeLinkUrl(null)).toBe('');
    });
});
