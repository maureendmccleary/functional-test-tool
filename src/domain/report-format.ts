/**
 * Text formatting for the evaluation report.
 *
 * Kept out of io/docx-report.ts so the wording and the date format can be
 * tested without building a document or loading the docx library.
 *
 * The report deliberately says "use case", not "functional test", even though
 * functional test is this codebase's term for the same thing. This wording is
 * output, matching the platform export the report is modelled on, and is not
 * commentary to be brought in line with the rest of the source. See the data
 * model vocabulary note in CLAUDE.md.
 */

/** How the report names each score, highest first. */
export const SCORE_LABELS: ReadonlyArray<{ score: number; label: string; definition: string }> = [
    {
        score: 5,
        label: 'Pass - No Accessibility Problem(s)',
        definition: 'The use case is a complete success. No accessibility problems are found to hinder its completion.'
    },
    {
        score: 4,
        label: 'Pass - Optimizations Suggested',
        definition: 'The use case is readily completed, but a slight modification would make it easier or more reliably accessible.'
    },
    {
        score: 3,
        label: 'Pass - Minor Accessibility Problem(s)',
        definition: 'One or more minor accessibility problems makes completion of the use case tricky or more difficult than it should be.'
    },
    {
        score: 2,
        label: 'Fail - Major Accessibility Problem(s)',
        definition: 'One or more major (or a significant number of minor) accessibility problems makes the completion of the use case very difficult. Many disabled users who are less diligent or proficient in their assistive technology would be expected to give up.'
    },
    {
        score: 1,
        label: 'Fail - Severe Accessibility Problem(s)',
        definition: 'The use case cannot be completed, or the confidence in its success is very low, due to one or more major accessibility problems.'
    }
];

/** The explanatory text above the scoring table. */
export const SCORING_KEY_PARAGRAPHS: ReadonlyArray<string> = [
    'Each use case is performed as a "Success Case" according to the specified steps. Every effort is made to achieve success, but minor, major, or fatal accessibility problems can occur at any point, which are noted in the "Issues Encountered" column next to the step where the problem occurred. At the end of each use case, its success or failure is scored on a 5 point scale, where "5" indicates complete success and "1" indicates complete failure. The following chart is an explanation of all five possible scores.',
    'After the entire set of use cases has been performed with an assistive technology, the tester assigns an overall score for that assistive technology and assembles a list of the most significant problems encountered across all of the use cases. Those are recorded in the Significant Issues section of this report.',
    'If, during testing, the tester encounters any "stoppers" -- problems severe enough to prevent the completion of the use case -- the use case is automatically given a score of 1, "Fail - Severe Accessibility Problem(s)". Testers are generally instructed to get past the point of failure so that the whole use case is still performed, which is why problems may be noted in steps after a stopper.'
];

/** The label for a score, or an empty string when it is not one of the five. */
export function scoreLabel(score: number): string {
    return SCORE_LABELS.find((entry) => entry.score === score)?.label || '';
}

/** A score as the detailed section prints it, for example "Fail - Severe... (1)". */
export function formatScore(score: number): string {
    const label = scoreLabel(score);
    return label === '' ? 'Not rated' : `${label} (${score})`;
}

/** The overall rating to one decimal place, or "Not rated" when unset. */
export function formatOverallRating(rating: number): string {
    return typeof rating === 'number' && rating >= 1 ? rating.toFixed(1) : 'Not rated';
}

/** An assistive technology with its catalogue version, when one is known. */
export function formatAssistiveTechnology(name: string, version: string | undefined): string {
    const trimmed = (version || '').trim();
    return trimmed === '' ? name : `${name} ${trimmed}`;
}

/** Joins the cover's asset and evaluation name, skipping whichever is blank. */
export function buildCoverSubtitle(asset: string | undefined, name: string | undefined): string {
    return [asset, name]
        .map((part) => (part || '').trim())
        .filter((part) => part !== '')
        .join(' - ');
}

/** English ordinal suffix: 1st, 2nd, 3rd, 4th, and the 11th to 13th exceptions. */
function ordinalSuffix(day: number): string {
    if (day >= 11 && day <= 13) {
        return 'th';
    }
    switch (day % 10) {
        case 1: return 'st';
        case 2: return 'nd';
        case 3: return 'rd';
        default: return 'th';
    }
}

/**
 * The cover date, for example "Thursday 13th of August 2026 at 10:22 AM".
 *
 * Formatted from the local time fields so the result does not shift with the
 * reader's time zone, and pinned to en-US so the weekday and month names do
 * not vary with the machine's locale.
 */
export function formatReportTimestamp(date: Date): string {
    const weekday = date.toLocaleDateString('en-US', { weekday: 'long' });
    const month = date.toLocaleDateString('en-US', { month: 'long' });
    const day = date.getDate();
    const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return `${weekday} ${day}${ordinalSuffix(day)} of ${month} ${date.getFullYear()} at ${time}`;
}
