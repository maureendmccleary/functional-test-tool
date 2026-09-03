/**
 * Shared keyboard behavior for the application's modal dialogs.
 *
 * Native modal dialogs make the page behind them inert, but their sequential
 * focus behavior is not consistent enough across supported browser and screen
 * reader combinations. Wrapping focus here gives every dialog the same
 * predictable Tab and Shift+Tab loop.
 */

const FOCUSABLE_SELECTOR = [
    'a[href]',
    'button:not(:disabled)',
    'input:not(:disabled):not([type="hidden"])',
    'select:not(:disabled)',
    'textarea:not(:disabled)',
    '[tabindex]:not([tabindex="-1"])'
].join(',');

/** True when a candidate is currently available to keyboard users. */
function isAvailable(element: HTMLElement): boolean {
    return element.tabIndex >= 0
        && element.closest('[hidden], .inactive, [inert], [aria-hidden="true"]') === null;
}

/** The dialog's current tab stops, recalculated because Add Issue changes them. */
function focusableElements(dialog: HTMLDialogElement): HTMLElement[] {
    return Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
        .filter(isAvailable);
}

/** Keeps Tab navigation inside one open modal dialog. */
export function trapModalDialogFocus(e: KeyboardEvent): void {
    if (e.key !== 'Tab') {
        return;
    }

    const dialog = e.currentTarget as HTMLDialogElement;
    const focusable = focusableElements(dialog);
    if (focusable.length === 0) {
        e.preventDefault();
        const heading = dialog.querySelector<HTMLElement>('[tabindex="-1"]');
        (heading || dialog).focus();
        return;
    }

    const active = dialog.ownerDocument.activeElement;
    const currentIndex = focusable.indexOf(active as HTMLElement);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    // Dialogs open on a tabindex=-1 heading. It is deliberately not a regular
    // stop, so the first Tab enters at the start and Shift+Tab enters at the end.
    if (currentIndex === -1) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
        return;
    }

    if (e.shiftKey && currentIndex === 0) {
        e.preventDefault();
        last.focus();
    } else if (!e.shiftKey && currentIndex === focusable.length - 1) {
        e.preventDefault();
        first.focus();
    }
}

/** Wires every static dialog once; the named listener is deduplicated by the DOM. */
export function addModalDialogEvents(): void {
    document.querySelectorAll<HTMLDialogElement>('dialog').forEach((dialog) => {
        dialog.addEventListener('keydown', trapModalDialogFocus);
    });
}
