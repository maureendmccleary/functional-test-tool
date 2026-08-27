import { findEl } from './dom.js';

/**
 * Announcing a status message, and showing it.
 *
 * Those are two jobs, done by two elements, because they have opposite needs.
 * The visible paragraph belongs beside the control it reports on, which means
 * it lives inside a screen or a dialog and is hidden whenever that is. A live
 * region cannot live there: inside a `display: none` subtree it announces
 * nothing, and a screen reader drops it rather than picking it up again when
 * the screen returns. So the announcement comes from one permanent region in
 * `index.html` that is never hidden, and the paragraph is plain text.
 */

/**
 * The live regions, one on the page and one inside every dialog.
 *
 * A modal dialog puts itself in the browser's top layer and makes everything
 * outside it inert, which takes the page's region out of the accessibility tree
 * for as long as the dialog is open. So each dialog carries its own, and the
 * announcement goes to whichever is reachable.
 */
const LIVE_REGION_SELECTOR = '.app-status';

/**
 * How long the region is left empty before the message goes in.
 *
 * Two jobs. A live region announces a *change*, and setting the same message
 * twice in a row is no change at all, so saving two issues used to announce
 * only the first; clearing and setting in one go does not help, because the
 * browser reports the net result of a task rather than each step, so the
 * message has to land in a later one.
 *
 * The length is the second job. These handlers move focus, and a reader
 * speaking a focus change will drop a live region update that arrives while it
 * is busy. This is long enough for it to finish and pick the message up, and
 * short enough that nobody waits for it.
 */
const ANNOUNCE_DELAY_MS = 250;

/** How long a message stays on screen when the caller does not say. */
const DEFAULT_CLEAR_MS = 3000;

/**
 * How long the announcement is left in the region before it is emptied.
 *
 * A live region keeps whatever it last said, and the text stays in the
 * accessibility tree as ordinary content: a message announced on the perform
 * screen was still there to be read on returning to the landing screen, long
 * after it stopped being true. Long enough for a reader to have spoken it,
 * since emptying a region does not stop speech already under way.
 */
const ANNOUNCE_CLEAR_MS = 5000;

/**
 * The region a screen reader can actually reach right now.
 *
 * Found through whatever holds focus, not by looking for an open dialog. The
 * issue dialog opens on top of the Perform dialog, so two are open at once, and
 * asking the document for `dialog[open]` answers with the first one in the
 * markup -- the Perform dialog, which the modal on top of it has made inert.
 * Messages went into a region no reader could see.
 *
 * A modal traps focus, so the dialog containing the focused element is the one
 * on top. Where focus has escaped to the body, or there is no dialog at all,
 * the page's region is right.
 */
function reachableLiveRegion(): HTMLElement | null {
    const active = document.activeElement as Element | null;
    const dialog = typeof active?.closest === 'function'
        ? active.closest('dialog[open]')
        : null;
    const inDialog = dialog && dialog.querySelector<HTMLElement>(LIVE_REGION_SELECTOR);
    return inDialog || document.querySelector<HTMLElement>('#app-status');
}

/** Announces a message, whichever screen or dialog the reader is in. */
export function announce(message: string): void {
    const region = reachableLiveRegion();
    if (!region) {
        return;
    }

    region.textContent = '';
    setTimeout(() => {
        region.textContent = message;

        // Emptied again so it cannot be read later as though it still applied.
        setTimeout(() => {
            if (region.textContent === message) {
                region.textContent = '';
            }
        }, ANNOUNCE_CLEAR_MS);
    }, ANNOUNCE_DELAY_MS);
}

/**
 * Shows a message in the given paragraph and announces it.
 *
 * Uses findEl, not requireEl: the original null-checks and returns silently
 * when the element is absent, and that path is live -- `test-editor-msg` did not
 * exist at all until the malformed <p> in index.html was fixed.
 *
 * @param clearAfterMs 0 leaves the message on screen until something replaces it
 */
export function showStatusMessage(
    elementId: string, message: string, clearAfterMs = DEFAULT_CLEAR_MS
): void {
    const statusElement = findEl(elementId);
    if (statusElement) {
        statusElement.textContent = message;

        if (clearAfterMs > 0) {
            setTimeout(() => {
                if (statusElement.textContent === message) {
                    statusElement.textContent = '';
                }
            }, clearAfterMs);
        }
    }

    // Announced even when the paragraph is missing: the reader still needs it.
    announce(message);
}
