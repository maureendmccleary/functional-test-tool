import { describe, expect, test, vi } from 'vitest';
import { trapModalDialogFocus } from '../src/ui/dialogs.js';

interface DialogFixture {
    dialog: HTMLDialogElement;
    heading: HTMLElement;
    ownerDocument: { activeElement: Element | null };
    setCandidates(elements: HTMLElement[]): void;
}

/** A focusable element with the visibility surface the dialog utility reads. */
function focusable(
    ownerDocument: { activeElement: Element | null },
    options: { unavailable?: boolean; tabIndex?: number } = {}
): HTMLElement {
    const element = {
        tabIndex: options.tabIndex ?? 0,
        closest: vi.fn(() => options.unavailable ? {} : null),
        focus: vi.fn(() => {
            ownerDocument.activeElement = element as unknown as Element;
        })
    };
    return element as unknown as HTMLElement;
}

/** A dialog whose candidate list can change between key presses. */
function dialogFixture(initialCandidates: HTMLElement[]): DialogFixture {
    const ownerDocument = { activeElement: null as Element | null };
    const heading = focusable(ownerDocument, { tabIndex: -1 });
    let candidates = initialCandidates;
    const dialog = {
        ownerDocument,
        querySelectorAll: vi.fn(() => candidates),
        querySelector: vi.fn(() => heading),
        focus: vi.fn(() => {
            ownerDocument.activeElement = dialog as unknown as Element;
        })
    } as unknown as HTMLDialogElement;
    return {
        dialog,
        heading,
        ownerDocument,
        setCandidates(elements) {
            candidates = elements;
        }
    };
}

/** The parts of KeyboardEvent the focus trap uses. */
function tabEvent(dialog: HTMLDialogElement, shiftKey = false): KeyboardEvent {
    return {
        key: 'Tab',
        shiftKey,
        currentTarget: dialog,
        preventDefault: vi.fn()
    } as unknown as KeyboardEvent;
}

describe('modal dialog focus trap', () => {
    test('enters at the first or last control from the initial heading', () => {
        const ownerDocument = { activeElement: null as Element | null };
        const first = focusable(ownerDocument);
        const last = focusable(ownerDocument);
        const fixture = dialogFixture([first, last]);

        fixture.ownerDocument.activeElement = fixture.heading;
        trapModalDialogFocus(tabEvent(fixture.dialog));
        expect(first.focus).toHaveBeenCalledOnce();

        fixture.ownerDocument.activeElement = fixture.heading;
        trapModalDialogFocus(tabEvent(fixture.dialog, true));
        expect(last.focus).toHaveBeenCalledOnce();
    });

    test('wraps forward from the last control and backward from the first', () => {
        const fixture = dialogFixture([]);
        const first = focusable(fixture.ownerDocument);
        const last = focusable(fixture.ownerDocument);
        fixture.setCandidates([first, last]);

        fixture.ownerDocument.activeElement = last;
        const forward = tabEvent(fixture.dialog);
        trapModalDialogFocus(forward);
        expect(first.focus).toHaveBeenCalledOnce();
        expect(forward.preventDefault).toHaveBeenCalledOnce();

        fixture.ownerDocument.activeElement = first;
        const backward = tabEvent(fixture.dialog, true);
        trapModalDialogFocus(backward);
        expect(last.focus).toHaveBeenCalledOnce();
        expect(backward.preventDefault).toHaveBeenCalledOnce();
    });

    test('ignores hidden and disabled controls and recalculates dynamic controls', () => {
        const fixture = dialogFixture([]);
        const first = focusable(fixture.ownerDocument);
        const hidden = focusable(fixture.ownerDocument, { unavailable: true });
        const disabled = focusable(fixture.ownerDocument, { tabIndex: -1 });
        const close = focusable(fixture.ownerDocument);
        fixture.setCandidates([first, hidden, disabled, close]);

        fixture.ownerDocument.activeElement = close;
        trapModalDialogFocus(tabEvent(fixture.dialog));
        expect(first.focus).toHaveBeenCalledOnce();

        const save = focusable(fixture.ownerDocument);
        fixture.setCandidates([first, save, close]);
        fixture.ownerDocument.activeElement = save;
        const fromDynamicControl = tabEvent(fixture.dialog);
        trapModalDialogFocus(fromDynamicControl);
        expect(fromDynamicControl.preventDefault).not.toHaveBeenCalled();
    });

    test('keeps a single available control focused in either direction', () => {
        const fixture = dialogFixture([]);
        const only = focusable(fixture.ownerDocument);
        fixture.setCandidates([only]);
        fixture.ownerDocument.activeElement = only;

        trapModalDialogFocus(tabEvent(fixture.dialog));
        trapModalDialogFocus(tabEvent(fixture.dialog, true));

        expect(only.focus).toHaveBeenCalledTimes(2);
    });

    test('falls back to the heading when a dialog has no controls', () => {
        const fixture = dialogFixture([]);
        const event = tabEvent(fixture.dialog);

        trapModalDialogFocus(event);

        expect(fixture.heading.focus).toHaveBeenCalledOnce();
        expect(event.preventDefault).toHaveBeenCalledOnce();
    });

    test('leaves keys other than Tab alone', () => {
        const fixture = dialogFixture([]);
        const event = {
            key: 'Escape',
            currentTarget: fixture.dialog,
            preventDefault: vi.fn()
        } as unknown as KeyboardEvent;

        trapModalDialogFocus(event);

        expect(event.preventDefault).not.toHaveBeenCalled();
    });
});
