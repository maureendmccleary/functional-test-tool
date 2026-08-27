import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { announce, showStatusMessage } from '../src/ui/status.js';
import {
    clearDocumentStub, createElementStub, installDocumentStub, type DocumentStub
} from './helpers/dom-stub.js';

/**
 * Showing a message and announcing it are two jobs done by two elements. These
 * cover the announcing half, which is the one with no visible evidence when it
 * goes wrong.
 */

const ELEMENT_IDS = ['app-status', 'test-editor-msg'];

/** Long enough for the message to land, short of the delay that empties it. */
const SPOKEN_MS = 400;

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
        vi.advanceTimersByTime(SPOKEN_MS);
        expect(liveRegion().textContent).toBe('Saved as 01 Place a hold - NVDA.');
    });

    test('empties the region before the message lands', () => {
        // A live region announces a change. Without the gap, setting the same
        // message twice is no change at all and the second is never heard.
        announce('Issue successfully saved!');
        vi.advanceTimersByTime(SPOKEN_MS);
        announce('Issue successfully saved!');
        expect(liveRegion().textContent).toBe('');

        vi.advanceTimersByTime(SPOKEN_MS);
        expect(liveRegion().textContent).toBe('Issue successfully saved!');
    });

    test('empties the region once it has been spoken', () => {
        // A live region keeps its last message, and it reads as ordinary page
        // content afterwards: a save announced on one screen was still there to
        // be found on the next.
        announce('Functional Test data saved!');
        vi.advanceTimersByTime(SPOKEN_MS);
        expect(liveRegion().textContent).toBe('Functional Test data saved!');

        vi.runAllTimers();
        expect(liveRegion().textContent).toBe('');
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

        vi.advanceTimersByTime(SPOKEN_MS);
        expect(liveRegion().textContent).toBe('Extension 1 was deleted.');
    });

    test('announces even when the paragraph is missing', () => {
        // The paragraph is optional; the reader hearing it is not.
        showStatusMessage('no-such-element', 'Evaluation ready to perform.', 0);
        vi.advanceTimersByTime(SPOKEN_MS);
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

describe('choosing which region to announce from', () => {
    /**
     * Two regions and a focused element, which is all reachableLiveRegion
     * looks at. The shared stub does not model dialogs or focus, so this
     * builds just enough document to ask the question.
     */
    function withDialog(focusInsideDialog: boolean) {
        const pageRegion = createElementStub();
        const dialogRegion = createElementStub();
        const dialog = {
            querySelector: (selector: string) => selector === '.app-status' ? dialogRegion : null
        };
        const active = {
            closest: (selector: string) =>
                selector === 'dialog[open]' && focusInsideDialog ? dialog : null
        };
        (globalThis as unknown as { document: unknown }).document = {
            activeElement: active,
            querySelector: (selector: string) => selector === '#app-status' ? pageRegion : null
        };
        return { pageRegion, dialogRegion };
    }

    test('announces from the dialog focus is in, not the first one in the markup', () => {
        // The issue dialog opens on top of the Perform dialog, so two are open.
        // Asking the document for dialog[open] answers with the Perform dialog,
        // which the modal above it has made inert, and the message is lost.
        const { pageRegion, dialogRegion } = withDialog(true);

        announce('Issue successfully saved!');
        vi.advanceTimersByTime(SPOKEN_MS);

        expect(dialogRegion.textContent).toBe('Issue successfully saved!');
        expect(pageRegion.textContent).toBe('');
    });

    test('announces from the page when focus is not in a dialog', () => {
        const { pageRegion, dialogRegion } = withDialog(false);

        announce('Evaluation loaded successfully.');
        vi.advanceTimersByTime(SPOKEN_MS);

        expect(pageRegion.textContent).toBe('Evaluation loaded successfully.');
        expect(dialogRegion.textContent).toBe('');
    });
});
