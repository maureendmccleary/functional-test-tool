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

/**
 * The paragraph introducing the Significant Issues section.
 *
 * Shared by the report and the results dialog so the two cannot drift.
 */
export const SIGNIFICANT_ISSUES_INTRO =
    'The following list of problems includes the most significant, widespread, high severity '
    + 'problems that were encountered during testing. Any given problem may have occurred on '
    + 'some, most, or all of the use cases, or it may have occurred on a single use case (but '
    + 'was of sufficiently high severity to be noted here).';

/** The explanatory text above the scoring table. */
export const SCORING_KEY_PARAGRAPHS: ReadonlyArray<string> = [
    'Each use case is performed as a "Success Case" according to the specified steps. Every effort is made to achieve success, but minor, major, or fatal accessibility problems can occur at any point, which are noted in the "Issues Encountered" column next to the step where the problem occurred. At the end of each use case, its success or failure is scored on a 5 point scale, where "5" indicates complete success and "1" indicates complete failure. The following chart is an explanation of all five possible scores.',
    'After the entire set of use cases has been performed with an assistive technology, the tester assigns an overall score for that assistive technology and assembles a list of the most significant problems encountered across all of the use cases. Those are recorded in the Significant Issues section of this report.',
    'If, during testing, the tester encounters any "stoppers" -- problems severe enough to prevent the completion of the use case -- the use case is automatically given a score of 1, "Fail - Severe Accessibility Problem(s)". Testers are generally instructed to get past the point of failure so that the whole use case is still performed, which is why problems may be noted in steps after a stopper.'
];

/**
 * Shading behind each score in the key, palest for the scores not achieved.
 *
 * One color per score and nothing else: green for 5 down through blue, yellow
 * and orange to red for 1. Neither shade is ever asked to carry the meaning on
 * its own -- the score's label sits on every fill, in the key and on the badge
 * alike -- which is what keeps the report readable to anyone who does not see
 * the color, and in greyscale.
 *
 * Kept here with the rest of the report's presentation so the contrast of every
 * pairing can be asserted without building a document. See
 * `tests/contrast.test.ts`.
 */
const SCORE_FILLS: Record<number, { plain: string; achieved: string }> = {
    5: { plain: 'EAF4EA', achieved: '92D050' },
    4: { plain: 'EAEFF9', achieved: '8EAADB' },
    3: { plain: 'FFF8E5', achieved: 'FFD966' },
    2: { plain: 'FDEEE3', achieved: 'F4B183' },
    1: { plain: 'FBE9E9', achieved: 'E06666' }
};

/** Shading behind a table's heading row. */
export const HEADER_FILL = 'EEEEEE';

/**
 * The font the whole report is set in, headings and tables included.
 *
 * Word's own default is a serif, which is not what the rest of the deliverables
 * this report sits with are set in.
 */
export const REPORT_FONT = 'Arial';

/**
 * Heading color. Word's built-in heading styles are a blue that this report
 * does not want; every heading is plain black.
 */
export const HEADING_COLOR = '000000';

/**
 * Shading on every other row of the detailed results tables, so a row can be
 * followed across its columns.
 *
 * Office's "Blue, Accent 1, Lighter 60%". It reads at 1.5:1 against the unbanded
 * rows, which is what banding is: an aid to the eye, not a carrier of meaning,
 * so it is not held to 3:1. What does matter is the text sitting on it, and
 * REPORT_TEXT_COLOR on this is 14:1. Checked in tests/contrast.test.ts.
 */
export const BAND_FILL = 'BDD7EE';

/**
 * Text color for anything the report gives a background of its own.
 *
 * Word's "auto" adapts the text to the theme, which is right for ordinary
 * paragraphs and wrong on a cell whose fill is a fixed pale color: in a dark
 * theme it can turn the text pale as well, leaving pale on pale. Wherever a
 * fill is set, the text color is set with it, and the two are checked against
 * each other in `tests/contrast.test.ts`. Unshaded text is deliberately left on
 * "auto" so it still follows the reader's theme.
 */
export const REPORT_TEXT_COLOR = '000000';

/**
 * How one row of the score key is drawn.
 *
 * The achieved row is bold as well as more strongly filled. The bold is not
 * decoration: the pale and strong fills of a given score differ by as little as
 * 1.29:1, so the fill alone would not tell a low vision reader which score was
 * reached, and color would be carrying meaning on its own.
 */
export function scoreRowStyle(score: number, achieved: boolean): { fill: string; bold: boolean } {
    const fills = SCORE_FILLS[score];
    return { fill: achieved ? fills.achieved : fills.plain, bold: achieved };
}

/**
 * The Scorecard's rows, label and value, in the order both the report and the
 * results dialog print them.
 *
 * Shared for the same reason SIGNIFICANT_ISSUES_INTRO is: the two were keeping
 * their own copies of this list, and the copies had already drifted into
 * labelling three rows "2", "3" and "4" beside two that spelled out "Use Cases
 * that Scored a 5 (best)".
 *
 * Structurally typed rather than importing Scorecard, so this module still
 * needs nothing but the types it is given.
 */
export function scorecardRows(scorecard: {
    totalRuns: number;
    countsByScore: Map<number, number>;
    overallRating: number;
}): Array<[string, string]> {
    const scored = (score: number): [string, string] => [
        `Use Cases that Scored a ${score}${SCORE_EXTREMES[score] || ''}`,
        String(scorecard.countsByScore.get(score) || 0)
    ];
    return [
        ['Total Number of Use Cases', String(scorecard.totalRuns)],
        scored(1), scored(2), scored(3), scored(4), scored(5),
        ['Overall Rating', formatOverallRating(scorecard.overallRating)]
    ];
}

/** Which ends of the scale the scorecard names, so the reader knows its direction. */
const SCORE_EXTREMES: Record<number, string> = { 1: ' (worst)', 5: ' (best)' };

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

/**
 * A use case name with its number and assistive technology, for example
 * "01 Review exit polls - NVDA".
 *
 * This is the one place the three parts are put together. The number comes from
 * the script rather than from its position in the evaluation, so the copies
 * made of one script for different assistive technologies share it and a
 * deleted copy does not renumber the rest.
 *
 * The assistive technology is omitted rather than left dangling when a script
 * has none, which only happens in files written before the split. A number that
 * is not a positive whole one is dropped the same way, rather than printed as
 * "00" or "undefined".
 */
export function formatUseCaseName(
    testNumber: number, name: string, assistiveTechnology = ''
): string {
    const trimmedName = String(name || '').trim();
    const numbered = Number.isInteger(testNumber) && testNumber > 0
        ? `${String(testNumber).padStart(2, '0')} ${trimmedName}`.trim()
        : trimmedName;
    const technology = String(assistiveTechnology || '').trim();
    return technology === '' ? numbered : `${numbered} - ${technology}`;
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
