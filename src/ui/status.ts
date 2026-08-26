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

/** The one element that announces. Never hidden, never moved. */
const LIVE_REGION_ID = 'app-status';

/**
 * How long the region is left empty before the message goes in.
 *
 * A live region announces a *change*. Setting the same message twice in a row
 * is no change at all, so saving two issues used to announce only the first.
 * Clearing and setting in one go does not help, because the browser reports the
 * net result of a task rather than each step; the message has to land in a
 * later one.
 */
const ANNOUNCE_DELAY_MS = 50;

/** How long a message stays on screen when the caller does not say. */
const DEFAULT_CLEAR_MS = 3000;

/** Announces a message, whichever screen the reader is on. */
export function announce(message: string): void {
    const region = findEl(LIVE_REGION_ID);
    if (!region) {
        return;
    }

    region.textContent = '';
    setTimeout(() => {
        region.textContent = message;
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
