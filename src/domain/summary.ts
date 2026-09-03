import type { Evaluation, IssueBearing, SummaryComment } from '../types.js';
import { issuesMapFor } from './evaluation.js';
import { issuesMap, issuesText } from './scoring.js';
import { isOutOfScope } from './test-run.js';

/**
 * The written summaries: the comment block a tester edits, and the severity
 * each line of it is written under.
 *
 * A summary is generated from the issues, grouped under the banners below, and
 * the tester then rewrites it in their own words. What keeps a reworded line at
 * its severity is *where it sits*, not anything about its text: the banner
 * above it. So a tester can say what they like and never type a severity.
 */

/**
 * Severity headings, in order, for scores 1 through 4.
 *
 * The punctuation really is inconsistent: the first two carry a colon, the last
 * two do not. This text is written into saved evaluation files and read back
 * out of them, so it cannot be tidied. See ARCHITECTURE.md.
 */
export const SUMMARY_BANNERS = ["Stoppers:", "Major Issues:", "Minor Issues", "Advisory"];

/** The severities a line can be written under, matching Issue.score. */
const LOWEST_SEVERITY = 1;
const HIGHEST_SEVERITY = 4;

/** A banner with its colon taken off, so the four compare alike. */
function bareBanner(banner: string): string {
    return banner.replace(/:$/, '');
}

/**
 * The severity a line opens a section for, or undefined when it is not a banner.
 *
 * The whole line has to be the banner. Matching it anywhere in the text is what
 * the old stripping did, and it ate the tester's own words: "Advisory only: the
 * icon could be larger" came back as "only: the icon could be larger". A
 * trailing colon is optional either way, since two of the four are written
 * without one and a tester may well add them.
 */
export function bannerSeverity(line: string): number | undefined {
    const trimmed = bareBanner(line.trim());
    const index = SUMMARY_BANNERS.findIndex((banner) => bareBanner(banner) === trimmed);
    return index === -1 ? undefined : index + LOWEST_SEVERITY;
}

/** The comments of one severity, or the unclassified ones when given undefined. */
function commentsAt(comments: SummaryComment[], severity: number | undefined): SummaryComment[] {
    return comments.filter((comment) => comment.severity === severity);
}

/**
 * The comment block, as the tester reads and edits it.
 *
 * Unclassified lines come first, under no banner. They are what a tester types
 * at the top of the box -- a note on what the testing covered -- and what every
 * line of a file written before severities were stored reads as. Putting them
 * after the sections instead would file them under whichever banner came last,
 * which is a severity nobody chose.
 *
 * A severity with nothing in it prints no banner. An empty section is a line to
 * read and then delete, and the tester is here to write, not to tidy.
 */
export function buildSummaryTextFromComments(comments: SummaryComment[]): string {
    let text = "";
    commentsAt(comments, undefined).forEach((comment) => {
        text += `${comment.text}\n\n`;
    });
    for (let severity = LOWEST_SEVERITY; severity <= HIGHEST_SEVERITY; severity++) {
        const written = commentsAt(comments, severity);
        if (written.length === 0) {
            continue;
        }
        text += SUMMARY_BANNERS[severity - LOWEST_SEVERITY];
        text += "\n";
        text += written.map((comment) => comment.text).join("\n\n");
        text += "\n\n";
    }
    return text;
}

/** One line per issue found, each at the severity it was recorded under. */
export function commentsFromIssues(allIssues: Map<number, Set<string>>): SummaryComment[] {
    const comments: SummaryComment[] = [];
    for (let severity = LOWEST_SEVERITY; severity <= HIGHEST_SEVERITY; severity++) {
        const issueString = issuesText(allIssues, severity);
        if (issueString !== "") {
            issueString.split("\n\n").forEach((text) => comments.push({ text, severity }));
        }
    }
    return comments;
}

/** Assembles the comment block from issues, emitting only severities that have any. */
export function buildSummaryText(allIssues: Map<number, Set<string>>): string {
    return buildSummaryTextFromComments(commentsFromIssues(allIssues));
}

/**
 * Reads the edited block back, taking each line's severity from the banner above it.
 *
 * Paragraphs are separated by a blank line, which is how the generated block
 * writes them, so a tester who presses Enter once inside a comment keeps it as
 * one comment. Text before any banner keeps no severity rather than being given
 * the first one, because nothing here knows what they meant by it.
 */
export function parseSummaryComments(commentSummary: string): SummaryComment[] {
    const comments: SummaryComment[] = [];
    let severity: number | undefined;
    let paragraph: string[] = [];

    const flush = (): void => {
        const text = paragraph.join("\n").trim();
        paragraph = [];
        if (text !== "") {
            comments.push(severity === undefined ? { text } : { text, severity });
        }
    };

    commentSummary.split(/\r?\n/).forEach((line) => {
        const opened = bannerSeverity(line);
        if (opened !== undefined) {
            flush();
            severity = opened;
            return;
        }
        if (line.trim() === "") {
            flush();
            return;
        }
        paragraph.push(line);
    });
    flush();
    return comments;
}

/**
 * Adds comments to a block without repeating what it already says.
 *
 * Generating into a box the tester has already worked in should leave their
 * wording alone and fill in what is missing, rather than appending a second
 * copy of every line under a second set of banners. A line already there but
 * unclassified takes the severity the new one carries, since that is a severity
 * arrived at from the issues rather than guessed.
 */
export function mergeSummaryComments(
    existing: SummaryComment[], generated: SummaryComment[]
): SummaryComment[] {
    const merged = existing.map((comment) => ({ ...comment }));
    generated.forEach((comment) => {
        const already = merged.find((kept) => kept.text === comment.text);
        if (!already) {
            merged.push({ ...comment });
            return;
        }
        if (already.severity === undefined && comment.severity !== undefined) {
            already.severity = comment.severity;
        }
    });
    return merged;
}

/** One printed block of a summary: the banner it sits under, and its lines. */
export interface SummaryGroup {
    /** Absent for the unclassified lines, which lead and carry no banner. */
    banner?: string;
    comments: SummaryComment[];
}

/**
 * A summary arranged for printing: unclassified lines first, then each severity
 * that has any, most severe first.
 *
 * Shared by the results dialog, the evaluation results screen and the report,
 * so a tester reading the summary on screen is reading the order the client
 * will. Grouping is the whole value of storing the severity: a reader looking
 * for what to fix first finds the stoppers at the top rather than hunting
 * through a flat list.
 */
export function groupSummaryComments(comments: SummaryComment[]): SummaryGroup[] {
    const groups: SummaryGroup[] = [];
    const leading = commentsAt(comments, undefined);
    if (leading.length > 0) {
        groups.push({ comments: leading });
    }
    for (let severity = LOWEST_SEVERITY; severity <= HIGHEST_SEVERITY; severity++) {
        const written = commentsAt(comments, severity);
        if (written.length > 0) {
            groups.push({ banner: SUMMARY_BANNERS[severity - LOWEST_SEVERITY], comments: written });
        }
    }
    return groups;
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

/** Every issue description that still counts towards this run's totals. */
function countedDescriptions(run: IssueBearing): Set<string> {
    const counted = new Set<string>();
    issuesMap(run).forEach((descriptions) => {
        descriptions.forEach((description) => counted.add(description));
    });
    return counted;
}

/**
 * The stored summary with the named descriptions taken out of it.
 *
 * A summary is generated from the issues and then stored, so anything that
 * stops an issue counting afterwards -- marking its step out of scope, deleting
 * it -- would otherwise leave it written into the run's comments, and from
 * there into the results dialog's problem summary and the report, both of which
 * print those comments rather than recomputing them.
 *
 * Only the descriptions named are removed. Anything the tester wrote themselves
 * matches none of them and is left alone, and a description still counted
 * somewhere in the run stays, because it is still something that happened: the
 * same problem hit on two steps does not stop having happened on the second
 * when the first is skipped.
 *
 * Removal only. Nothing here puts a description back, because where it belonged
 * in the tester's prose is not recoverable; Generate Summary rebuilds the whole
 * block from what currently counts.
 *
 * @param run the run as it is *after* the change, which is what decides what
 *            still counts
 */
export function summaryWithoutIssues(
    comments: SummaryComment[], removed: Iterable<string>, run: IssueBearing
): SummaryComment[] {
    const dropping = new Set(removed);
    if (dropping.size === 0) {
        return comments;
    }
    const counted = countedDescriptions(run);
    return comments.filter(
        (comment) => !dropping.has(comment.text) || counted.has(comment.text)
    );
}

/** The stored summary with the issues of every out of scope record taken out. */
export function summaryWithoutSkippedIssues(
    comments: SummaryComment[], run: IssueBearing
): SummaryComment[] {
    return summaryWithoutIssues(comments, skippedDescriptions(run), run);
}

/**
 * The stored summary with one issue's description rewritten where it appears.
 *
 * Editing an issue is not deleting one: it is the same finding in better words,
 * so the summary keeps the line, in its place and at its severity, saying the
 * new thing. Dropping it the way a deletion does would lose a finding the
 * tester still means to report, and leaving it would report wording they have
 * just corrected.
 *
 * The old wording is left alone when it still describes an issue recorded
 * somewhere else in the run, since there it is not out of date. If the new
 * wording is already in the summary, the old line goes rather than being
 * duplicated.
 *
 * @param run the run as it is *after* the edit
 */
export function summaryWithRenamedIssue(
    comments: SummaryComment[], from: string, to: string, run: IssueBearing
): SummaryComment[] {
    if (from === to || countedDescriptions(run).has(from)) {
        return comments;
    }
    return comments.some((comment) => comment.text === to)
        ? comments.filter((comment) => comment.text !== from)
        : comments.map((comment) => (
            comment.text === from ? { ...comment, text: to } : comment
        ));
}

/**
 * The summary brought up to date with the issues currently recorded.
 *
 * Called wherever an issue is added, edited, deleted or taken out of scope, so
 * the summary under the score on the perform screen says what has been found
 * without the tester having to ask for it. A tester who never opens the summary
 * dialog at all still gets one.
 *
 * A merge, not a rebuild: wording the tester has written stays, its severity
 * stays where they put it, and only issues the summary does not yet mention are
 * added. It follows that a line deleted from the summary while its issue is
 * still recorded comes back the next time an issue changes. Removing the issue
 * is what removes it for good, and that is what summaryWithoutIssues is for.
 */
export function summaryWithCurrentIssues(
    comments: SummaryComment[], run: IssueBearing
): SummaryComment[] {
    return mergeSummaryComments(comments, commentsFromIssues(issuesMap(run)));
}

/**
 * The comment block Generate offers for one assistive technology.
 *
 * The same severity grouping the per test summary uses, over every issue that
 * technology ran into. It used to group by script instead, listing each one by
 * name with its comments under it, which left the tester rearranging the whole
 * block into severity order by hand before it could go in the report.
 */
export function buildOverallCommentsTextFor(
    evaluation: Evaluation, assistiveTechnology: string
): string {
    return buildSummaryText(issuesMapFor(evaluation, assistiveTechnology));
}
