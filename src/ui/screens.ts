import { requireEl } from './dom.js';

/**
 * Which of the application's screens is on show.
 *
 * The screens are all present in index.html at once and are hidden with the
 * `inactive` class, the way the test editor always has been. Only one is
 * visible at a time, so the tester is never looking at the evaluation's
 * details and a half-written script at the same time.
 */

/** Every top-level element a screen owns, and the heading that names it. */
const SCREENS = {
    landing: { elementIds: ['evaluation-form'], headingId: 'landing-heading' },
    evaluation: { elementIds: ['evaluation-editor-form'], headingId: 'evaluation-editor-heading' },
    test: {
        // New Step sits outside the form in the markup, so it has to be listed.
        elementIds: ['test-editor-form', 'new-step-btn'],
        headingId: 'test-editor-heading'
    }
} as const;

export type ScreenName = keyof typeof SCREENS;

/**
 * Shows one screen and hides the others, moving focus to its heading.
 *
 * Focus has to move: hiding the element it was on drops focus to the document,
 * which leaves a screen reader user with no idea the screen changed. The
 * headings carry tabindex="-1" so they can take it.
 */
export function showScreen(name: ScreenName): void {
    for (const [screenName, screen] of Object.entries(SCREENS)) {
        for (const elementId of screen.elementIds) {
            requireEl(elementId).classList.toggle('inactive', screenName !== name);
        }
    }
    requireEl(SCREENS[name].headingId).focus();
}
