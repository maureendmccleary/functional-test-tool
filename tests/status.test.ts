import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { announce, showStatusMessage } from '../src/ui/status.js';
import { clearDocumentStub, installDocumentStub, type DocumentStub } from './helpers/dom-stub.js';

/**
 * Showing a message and announcing it are two jobs done by two elements. These
 * cover the announcing half, which is the one with no visible evidence when it
 * goes wrong.
 */

const ELEMENT_IDS = ['app-status', 'test-editor-msg'];

let documentStub: DocumentStub;

beforeEach(() => {
    documentStub = installDocumentStub(ELEMENT_IDS);
    vi.useFakeTimers();
});

afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    clearDocumentStub();
});

const liveRegion = () => documentStub.getElementById('app-status')!;
const paragraph = () => documentStub.getElementById('test-editor-msg')!;

describe('announce', () => {
    test('puts the message in the live region', () => {
        announce('Saved as 01 Place a hold - NVDA.');
        vi.runAllTimers();
        expect(liveRegion().textContent).toBe('Saved as 01 Place a hold - NVDA.');
    });

    test('empties the region before the message lands', () => {
        // A live region announces a change. Without the gap, setting the same
        // message twice is no change at all and the second is never heard.
        announce('Issue successfully saved!');
        vi.runAllTimers();
        announce('Issue successfully saved!');
        expect(liveRegion().textContent).toBe('');

        vi.runAllTimers();
        expect(liveRegion().textContent).toBe('Issue successfully saved!');
    });

    test('says nothing when the region is missing rather than throwing', () => {
        clearDocumentStub();
        installDocumentStub([]);
        expect(() => announce('x')).not.toThrow();
    });
});

describe('showStatusMessage', () => {
    test('shows the message and announces it', () => {
        showStatusMessage('test-editor-msg', 'Extension 1 was deleted.', 0);
        expect(paragraph().textContent).toBe('Extension 1 was deleted.');

        vi.runAllTimers();
        expect(liveRegion().textContent).toBe('Extension 1 was deleted.');
    });

    test('announces even when the paragraph is missing', () => {
        // The paragraph is optional; the reader hearing it is not.
        showStatusMessage('no-such-element', 'Evaluation ready to perform.', 0);
        vi.runAllTimers();
        expect(liveRegion().textContent).toBe('Evaluation ready to perform.');
    });

    test('clears the paragraph after the given delay', () => {
        showStatusMessage('test-editor-msg', 'Step 2 was successfully deleted!', 3000);
        vi.advanceTimersByTime(3000);
        expect(paragraph().textContent).toBe('');
    });

    test('leaves the paragraph alone when told not to clear it', () => {
        showStatusMessage('test-editor-msg', 'Q3 2026 loaded successfully.', 0);
        vi.advanceTimersByTime(10000);
        expect(paragraph().textContent).toBe('Q3 2026 loaded successfully.');
    });

    test('does not wipe a message that something else has replaced', () => {
        showStatusMessage('test-editor-msg', 'first', 3000);
        showStatusMessage('test-editor-msg', 'second', 0);
        vi.advanceTimersByTime(3000);
        expect(paragraph().textContent).toBe('second');
    });
});
