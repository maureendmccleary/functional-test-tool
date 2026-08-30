import { requireEl } from './dom.js';

/**
 * Which of the application's screens is on show, and what the page is called
 * while it is.
 *
 * The screens are all present in index.html at once and are hidden with the
 * `inactive` class, the way the test editor always has been. Only one is
 * visible at a time, so the tester is never looking at the evaluation's
 * details and a half-written script at the same time.
 */

/** The application's name, and what the page is called with nothing open. */
const APP_TITLE = 'Functional Accessibility Testing Tool';

/**
 * Every top-level element a screen owns, the heading that names it, and what
 * the page is titled while it is showing.
 */
const SCREENS = {
    landing: { elementIds: ['evaluation-form'], headingId: 'landing-heading', title: '' },
    evaluation: {
        elementIds: ['evaluation-editor-form'],
        headingId: 'evaluation-editor-heading',
        title: 'Evaluation'
    },
    test: {
        elementIds: ['test-editor-form'],
        headingId: 'test-editor-heading',
        title: 'Functional Test Editor'
    },
    perform: {
        elementIds: ['perform-screen'],
        headingId: 'perform-heading',
        title: 'Perform Functional Test'
    }
} as const;

export type ScreenName = keyof typeof SCREENS;

/** Which screen is showing, so a dialog can hand the title back on closing. */
let currentScreen: ScreenName = 'landing';

/**
 * Names the page for what is on it.
 *
 * The title is the one thing a screen reader will read on request whatever the
 * focus is doing, so it is worth keeping true. Nothing else tells a tester
 * which of four screens they are looking at.
 */
export function setSectionTitle(section: string): void {
    document.title = section === '' ? APP_TITLE : `${section} - ${APP_TITLE}`;
}

/** Puts the title back to the screen underneath, after a dialog closes. */
export function restoreScreenTitle(): void {
    setSectionTitle(SCREENS[currentScreen].title);
}

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

    // A status message belongs to the moment it was raised. Left on a screen it
    // is read out again as stale news the next time that screen is shown, which
    // is what returning from Perform to the landing screen used to do.
    document.querySelectorAll('.status-text').forEach((paragraph) => {
        paragraph.textContent = '';
    });

    currentScreen = name;
    setSectionTitle(SCREENS[name].title);
    requireEl(SCREENS[name].headingId).focus();
}
