import { findEl } from './dom.js';

/**
 * Announces a message in an aria-live region, then clears it.
 *
 * Uses findEl, not requireEl: the original null-checks and returns silently
 * when the element is absent, and that path is live -- `test-editor-msg` did not
 * exist at all until the malformed <p> in index.html was fixed.
 */
export function showStatusMessage(elementId: string, message: string, clearAfterMs = 3000): void {
    // Commit message: Fixing OS and AT selection and providing save Functional Test status message.
    const statusElement = findEl(elementId);
    if (!statusElement) {
        return;
    }

    statusElement.textContent = message;
    statusElement.setAttribute('aria-live', 'polite');
    statusElement.setAttribute('aria-atomic', 'true');

    if (clearAfterMs > 0) {
        setTimeout(() => {
            if (statusElement.textContent === message) {
                statusElement.textContent = '';
            }
        }, clearAfterMs);
    }
}
