import type { Evaluation, IssueBearing } from '../types.js';
import { issuesMap, issuesText } from './scoring.js';
import { getTestComments, testAssistiveTechnology, testDisplayName } from './functional-test.js';
import { isOutOfScope } from './test-run.js';

/**
 * Severity headings, in order, for scores 1 through 4.
 *
 * The punctuation really is inconsistent: the first two carry a colon, the last
 * two do not. This text is written into saved evaluation files and is matched
 * by BANNER_PATTERN below, so it cannot be tidied. See ARCHITECTURE.md.
 */
export const SUMMARY_BANNERS = ["Stoppers:", "Major Issues:", "Minor Issues", "Advisory"];

/**
 * Matches a banner together with the punctuation and line break that follow it,
 * so a Generate Summary -> Save round trip stores the issue text alone.
 *
 * Matching only the banner *word* left a stray ":\n" or "\n" at the front of
 * every stored comment. Files saved before this was corrected still contain
 * those characters; they are cosmetic and only affect display of old data.
 */
const BANNER_PATTERN = /(?:Stoppers|Major Issues|Minor Issues|Advisory):?[ \t]*\r?\n?/g;

/** Assembles the comment block, emitting only severities that have issues. */
export function buildSummaryText(allIssues: Map<number, Set<string>>): string {
    let summaryText = "";
    let issueString = "";
    for (let score = 0; score < 4; score++) {
        issueString = issuesText(allIssues, score + 1);
        if (issueString !== "") {
            summaryText += SUMMARY_BANNERS[score];
            summaryText += "\n";
            summaryText += issueString;
            summaryText += "\n\n";
        }
    }
    return summaryText;
}

/** Every issue description recorded against a record marked out of scope. */
function skippedDescriptions(run: IssueBearing): Set<string> {
    const skipped = new Set<string>();
    for (const section of [run.steps, run.extensions || []]) {
        for (const record of section) {
            if (isOutOfScope(record)) {
                record.issues.forEach((issue) => skipped.add(issue.description));
            }
        }
    }
    return skipped;
}

/**
 * The stored summary with the issues that no longer count taken out of it.
 *
 * A summary is generated from the issues, then stored as text, so marking a
 * step out of scope afterwards would otherwise leave its issues written into
 * the run's comments -- and from there into the results dialog's problem
 * summary and the report, which print those comments rather than recomputing
 * them. A step nobody performed should not be describing what went wrong.
 *
 * Only text attributable to a skipped record is removed. Anything the tester
 * wrote themselves matches no issue description and is left alone, and a
 * description that is also recorded against a record still in scope stays,
 * because it is still something that happened.
 *
 * Removal only. Taking the mark off again does not put the description back:
 * where it belonged in the tester's prose is not recoverable, and Generate
 * Summary rebuilds the whole block from what currently counts.
 */
export function summaryWithoutSkippedIssues(comments: string[], run: IssueBearing): string[] {
    const skipped = skippedDescriptions(run);
    if (skipped.size === 0) {
        return comments;
    }
    const counted = new Set<string>();
    issuesMap(run).forEach((descriptions) => {
        descriptions.forEach((description) => counted.add(description));
    });
    return comments.filter((comment) => !skipped.has(comment) || counted.has(comment));
}

/** Splits an edited comment block back into individual comments. */
export function splitSummaryComments(commentSummary: string): string[] {
    const commentsWithoutBanners = commentSummary.replace(BANNER_PATTERN, "").trim();
    return commentsWithoutBanners.split("\n\n");
}

/**
 * The evaluation-wide comment block: every functional test with its comments.
 *
 * Each block is headed by the script's full name, which already carries its
 * number and assistive technology. A separate running count used to head them;
 * it would now disagree with the number in the name, and could not tell the
 * copies of one script apart.
 */
export function buildOverallCommentsText(evaluation: Evaluation): string {
    let commentsText = "";
    evaluation.tests.forEach((test) => {
        commentsText += `${testDisplayName(test)}\n\n`;
        const testComments = getTestComments(test);
        if (testComments.length === 0) {
            commentsText += "No issues.";
        } else {
            commentsText += testComments.join("\n\n");
        }
        commentsText += "\n\n";
    });
    return commentsText;
}

/**
 * The comment block for one assistive technology: each of its functional tests,
 * named, with whatever the tester wrote about it.
 *
 * The evaluation wide version above covers every test at once. This one is what
 * Generate appends inside a technology's overall comments, so a tester
 * summarising NVDA is not handed what happened under JAWS.
 */
export function buildOverallCommentsTextFor(
    evaluation: Evaluation, assistiveTechnology: string
): string {
    let commentsText = "";
    (evaluation.tests || [])
        .filter((test) => testAssistiveTechnology(test) === assistiveTechnology)
        .forEach((test) => {
            commentsText += `${testDisplayName(test)}\n\n`;
            const testComments = getTestComments(test);
            commentsText += testComments.length === 0 ? "No issues." : testComments.join("\n\n");
            commentsText += "\n\n";
        });
    return commentsText;
}
