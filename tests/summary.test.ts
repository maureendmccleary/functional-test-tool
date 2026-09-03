import { afterEach, describe, expect, test, vi } from 'vitest';
import type {
    Issue, SummaryComment, TestRunStep, TestRun, FunctionalTest
} from '../src/types.js';
import {
    SUMMARY_BANNERS, bannerSeverity, buildOverallCommentsTextFor, buildSummaryText,
    buildSummaryTextFromComments, groupSummaryComments, mergeSummaryComments,
    parseSummaryComments, summaryWithRenamedIssue, summaryWithoutIssues,
    summaryWithoutSkippedIssues
} from '../src/domain/summary.js';
import { issuesMap } from '../src/domain/scoring.js';
import { normalizeEvaluation } from '../src/domain/migration.js';
import { setCurrentRunIndex, setEvaluation, setCurrentTestIndex } from '../src/state/store.js';
import { generateSummary, saveGeneralComments } from '../src/ui/summary-dialog.js';
import { clearDocumentStub, installDocumentStub } from './helpers/dom-stub.js';
import { loadFixture } from './helpers/fixtures.js';

function issue(description: string, score: string): Issue {
    return { description, findingURL: '', score };
}

/** One stored summary line, with or without the severity it was written under. */
function said(text: string, severity?: number): SummaryComment {
    return severity === undefined ? { text } : { text, severity };
}

/** How long announce leaves the region empty before filling it. */
const SPOKEN_MS = 400;

const SUMMARY_ELEMENT_IDS = [
    'general-comments', 'perform-score', 'summary-list', 'general-comments-msg', 'app-status'
];

/** Points the store at a single run and installs a stub document. */
function withTestRun(steps: TestRunStep[]) {
    const run: TestRun = {
        assistiveTechnology: 'NVDA', operatingSystem: 'Windows', score: -1, comments: [], steps,
        extensions: []
    };
    setEvaluation({
        tests: [{ name: 'Fixture', steps, runs: [run] } as unknown as FunctionalTest],
        score: 0
    });
    setCurrentTestIndex(0);
    setCurrentRunIndex(0);
    return { run, document: installDocumentStub(SUMMARY_ELEMENT_IDS) };
}

afterEach(() => clearDocumentStub());

describe('bannerSeverity', () => {
    test('reads each of the four banners, with or without its colon', () => {
        expect(SUMMARY_BANNERS).toEqual(['Stoppers:', 'Major Issues:', 'Minor Issues', 'Advisory']);
        expect(bannerSeverity('Stoppers:')).toBe(1);
        expect(bannerSeverity('Stoppers')).toBe(1);
        expect(bannerSeverity('Major Issues:')).toBe(2);
        expect(bannerSeverity('Minor Issues')).toBe(3);
        expect(bannerSeverity('Minor Issues:')).toBe(3);
        expect(bannerSeverity('Advisory')).toBe(4);
    });

    test('ignores surrounding whitespace', () => {
        expect(bannerSeverity('   Advisory  ')).toBe(4);
    });

    test('only a whole line counts, so a banner word inside a sentence does not', () => {
        // The old stripping matched anywhere and ate the tester's words:
        // "Advisory only: ..." came back as "only: ...".
        expect(bannerSeverity('Advisory only: the icon could be larger.')).toBeUndefined();
        expect(bannerSeverity('This is a Major Issues style problem.')).toBeUndefined();
        expect(bannerSeverity('Stoppers are common on this page.')).toBeUndefined();
        expect(bannerSeverity('')).toBeUndefined();
    });
});

describe('buildSummaryText', () => {
    test('emits only the severities that have issues, in severity order', () => {
        const map = issuesMap({ steps: [{ issues: [issue('severe thing', '1'), issue('optimization', '4')] }] });
        expect(buildSummaryText(map)).toBe('Stoppers:\nsevere thing\n\nAdvisory\noptimization\n\n');
    });

    test('uses the exact banner text, colons included and omitted', () => {
        // "Stoppers:" and "Major Issues:" carry a colon; "Minor Issues" and
        // "Advisory" do not. This text lands in saved files -- do not tidy it.
        const map = issuesMap({
            steps: [{ issues: [issue('one', '1'), issue('two', '2'), issue('three', '3'), issue('four', '4')] }]
        });
        expect(buildSummaryText(map)).toBe(
            'Stoppers:\none\n\nMajor Issues:\ntwo\n\nMinor Issues\nthree\n\nAdvisory\nfour\n\n'
        );
    });

    test('produces an empty summary when there are no issues', () => {
        expect(buildSummaryText(issuesMap({ steps: [{ issues: [] }] }))).toBe('');
    });
});

describe('parseSummaryComments', () => {
    test('takes each line severity from the banner above it', () => {
        expect(parseSummaryComments(
            'Major Issues:\nthe first problem\n\nAdvisory\nthe second problem'
        )).toEqual([said('the first problem', 2), said('the second problem', 4)]);
    });

    test('keeps several lines under one banner at that severity', () => {
        expect(parseSummaryComments('Stoppers:\nfirst\n\nsecond\n\nMinor Issues\nthird'))
            .toEqual([said('first', 1), said('second', 1), said('third', 3)]);
    });

    test('text before any banner keeps no severity rather than being guessed at', () => {
        expect(parseSummaryComments('Testing covered the desktop only.\n\nStoppers:\nfirst'))
            .toEqual([said('Testing covered the desktop only.'), said('first', 1)]);
    });

    test('text with no banners at all is all unclassified', () => {
        expect(parseSummaryComments('just a comment')).toEqual([said('just a comment')]);
    });

    test('keeps a comment the tester wrapped over two lines as one comment', () => {
        expect(parseSummaryComments('Stoppers:\nfirst line\nsecond line'))
            .toEqual([said('first line\nsecond line', 1)]);
    });

    test('does not eat a banner word used inside a sentence', () => {
        expect(parseSummaryComments('Advisory only: the icon could be larger.'))
            .toEqual([said('Advisory only: the icon could be larger.')]);
    });

    test('an empty box yields nothing', () => {
        expect(parseSummaryComments('')).toEqual([]);
        expect(parseSummaryComments('   \n\n  ')).toEqual([]);
    });

    test('a banner with nothing under it contributes nothing', () => {
        expect(parseSummaryComments('Stoppers:\n\nAdvisory\nonly this')).toEqual([
            said('only this', 4)
        ]);
    });
});

describe('the box round trip', () => {
    test('what a tester reads back is what they wrote, severities included', () => {
        const written = [
            said('Testing covered the desktop catalogue only.'),
            said('The hold button has no name.', 1),
            said('Focus is lost after the dialog closes.', 1),
            said('The result count is not announced.', 3)
        ];
        expect(parseSummaryComments(buildSummaryTextFromComments(written))).toEqual(written);
    });

    test('a generated block survives being saved and reopened unchanged', () => {
        const map = issuesMap({
            steps: [{ issues: [issue('cannot activate the control', '1'), issue('no status message', '3')] }]
        });
        const generated = buildSummaryText(map);
        const stored = parseSummaryComments(generated);
        expect(stored).toEqual([
            said('cannot activate the control', 1), said('no status message', 3)
        ]);
        expect(buildSummaryTextFromComments(stored)).toBe(generated);
    });

    test('unclassified lines are written back at the top, ahead of the banners', () => {
        const text = buildSummaryTextFromComments([
            said('The hold button has no name.', 1),
            said('Testing covered the desktop catalogue only.')
        ]);
        expect(text).toBe(
            'Testing covered the desktop catalogue only.\n\nStoppers:\nThe hold button has no name.\n\n'
        );
    });
});

describe('mergeSummaryComments', () => {
    test('adds what is missing and leaves the tester wording alone', () => {
        const existing = [said('their own words', 2)];
        const generated = [said('a fresh finding', 1)];
        expect(mergeSummaryComments(existing, generated))
            .toEqual([said('their own words', 2), said('a fresh finding', 1)]);
    });

    test('generating twice adds nothing the second time', () => {
        const generated = [said('a finding', 1), said('another', 3)];
        const once = mergeSummaryComments([], generated);
        expect(mergeSummaryComments(once, generated)).toEqual(once);
    });

    test('an unclassified line takes the severity the matching issue was found at', () => {
        expect(mergeSummaryComments([said('a finding')], [said('a finding', 2)]))
            .toEqual([said('a finding', 2)]);
    });

    test('does not overwrite a severity the tester had already moved a line to', () => {
        expect(mergeSummaryComments([said('a finding', 1)], [said('a finding', 3)]))
            .toEqual([said('a finding', 1)]);
    });
});

describe('groupSummaryComments', () => {
    test('leads with the unclassified lines, then each severity most severe first', () => {
        expect(groupSummaryComments([
            said('a minor thing', 3),
            said('a note'),
            said('a stopper', 1)
        ])).toEqual([
            { comments: [said('a note')] },
            { banner: 'Stoppers:', comments: [said('a stopper', 1)] },
            { banner: 'Minor Issues', comments: [said('a minor thing', 3)] }
        ]);
    });

    test('emits no group for a severity with nothing in it', () => {
        expect(groupSummaryComments([said('a stopper', 1)]))
            .toEqual([{ banner: 'Stoppers:', comments: [said('a stopper', 1)] }]);
    });

    test('an old file, where nothing is classified, is one group with no banner', () => {
        expect(groupSummaryComments([said('one'), said('two')]))
            .toEqual([{ comments: [said('one'), said('two')] }]);
    });

    test('nothing written yields no groups at all', () => {
        expect(groupSummaryComments([])).toEqual([]);
    });
});

describe('generateSummary', () => {
    test('writes the summary and the recomputed score', () => {
        const { run, document } = withTestRun([
            { issues: [issue('a', '3'), issue('b', '2')] }
        ]);
        generateSummary();
        expect(document.getElementById('general-comments')!.value)
            .toBe('Major Issues:\nb\n\nMinor Issues\na\n\n');
        expect(run.score).toBe(2);
        expect(document.getElementById('perform-score')!.value).toBe('2');
    });

    test('scores 5 and writes nothing when there are no issues', () => {
        const { run, document } = withTestRun([{ issues: [] }]);
        generateSummary();
        expect(document.getElementById('general-comments')!.value).toBe('');
        expect(run.score).toBe(5);
    });

    test('moves focus to the comment box', () => {
        const { document } = withTestRun([{ issues: [issue('a', '1')] }]);
        generateSummary();
        expect(document.getElementById('general-comments')!.focused).toBe(true);
    });

    test('keeps what the tester has already written and adds what is missing', () => {
        const { document } = withTestRun([{ issues: [issue('a fresh finding', '1')] }]);
        document.getElementById('general-comments')!.value =
            'Major Issues:\ntheir own words';
        generateSummary();
        expect(document.getElementById('general-comments')!.value)
            .toBe('Stoppers:\na fresh finding\n\nMajor Issues:\ntheir own words\n\n');
    });

    test('pressing it twice changes nothing the second time', () => {
        const { document } = withTestRun([{ issues: [issue('a', '1'), issue('b', '3')] }]);
        generateSummary();
        const once = document.getElementById('general-comments')!.value;
        generateSummary();
        expect(document.getElementById('general-comments')!.value).toBe(once);
    });

    test('groups an old summary that was stored with no severities at all', () => {
        // The case that made this merge rather than replace: a file saved
        // before severities existed. Replacing was the only route to a grouped
        // summary and it threw the tester's wording away.
        const { run, document } = withTestRun([
            { issues: [issue('cannot activate the control', '1')] }
        ]);
        run.comments = [
            said('cannot activate the control'),
            said('Sign-in was out of scope for this engagement.')
        ];
        document.getElementById('general-comments')!.value =
            buildSummaryTextFromComments(run.comments);

        generateSummary();

        // The line matching an issue takes its severity; the tester's own note
        // matches nothing and stays unclassified, at the top.
        expect(document.getElementById('general-comments')!.value).toBe(
            'Sign-in was out of scope for this engagement.\n\n'
            + 'Stoppers:\ncannot activate the control\n\n'
        );
    });
});

describe('saveGeneralComments', () => {
    const clickEvent = { preventDefault() { /* no-op */ } } as Event;

    test('clears comments and shows "No Issues" for an empty box', () => {
        const { run, document } = withTestRun([{ issues: [] }]);
        run.comments = [said('stale')];
        document.getElementById('general-comments')!.value = '   ';
        saveGeneralComments(clickEvent);
        expect(run.comments).toEqual([]);
        expect(document.getElementById('summary-list')!.children.map((li) => li.textContent))
            .toEqual(['No Issues']);
    });

    test('stores each line with the severity it was written under', () => {
        const { run, document } = withTestRun([
            { issues: [issue('cannot activate the control', '1')] },
            { issues: [issue('no status message on submit', '3')] }
        ]);
        generateSummary();
        saveGeneralComments(clickEvent);
        expect(run.comments).toEqual([
            said('cannot activate the control', 1), said('no status message on submit', 3)
        ]);
        expect(document.getElementById('summary-list')!.children.map((li) => li.textContent))
            .toEqual(['cannot activate the control', 'no status message on submit']);
    });

    test('a line the tester rewords under a banner keeps that severity', () => {
        // The whole point of taking severity from position rather than text.
        const { run, document } = withTestRun([{ issues: [issue('cannot activate the control', '1')] }]);
        document.getElementById('general-comments')!.value =
            'Stoppers:\nThe "Place hold" button is announced only as "button".';
        saveGeneralComments(clickEvent);
        expect(run.comments)
            .toEqual([said('The "Place hold" button is announced only as "button".', 1)]);
    });

    test('confirms the save, so the tester is not left guessing', () => {
        const { document } = withTestRun([{ issues: [] }]);
        document.getElementById('general-comments')!.value = 'something worth keeping';
        saveGeneralComments(clickEvent);
        expect(document.getElementById('general-comments-msg')!.textContent)
            .toBe('General comments saved.');
    });

    test('the confirmation is announced, not only shown', () => {
        // The dialog is modal, so the page's own region is inert while it is
        // open; the message has to reach a live region to be spoken at all.
        // announce clears the region first and fills it in a later task, so
        // that a repeated message still reads as a change.
        vi.useFakeTimers();
        try {
            const { document } = withTestRun([{ issues: [] }]);
            saveGeneralComments(clickEvent);
            // Far enough for the message to land, not so far that announce has
            // emptied the region again; running every timer would show nothing.
            vi.advanceTimersByTime(SPOKEN_MS);
            expect(document.getElementById('app-status')!.textContent)
                .toBe('General comments saved.');
        } finally {
            vi.useRealTimers();
        }
    });

    test('replaces the previous list rather than appending to it', () => {
        const { document } = withTestRun([{ issues: [] }]);
        document.getElementById('general-comments')!.value = 'first save';
        saveGeneralComments(clickEvent);
        document.getElementById('general-comments')!.value = 'second save';
        saveGeneralComments(clickEvent);
        expect(document.getElementById('summary-list')!.children.map((li) => li.textContent))
            .toEqual(['second save']);
    });
});

describe('summaryWithoutSkippedIssues', () => {
    const stored = [said('cannot activate the control', 1), said('no status message on submit', 3)];

    test('leaves a run with nothing marked exactly as it was', () => {
        const run = {
            steps: [
                { issues: [issue('cannot activate the control', '1')] },
                { issues: [issue('no status message on submit', '3')] }
            ],
            extensions: []
        };
        expect(summaryWithoutSkippedIssues(stored, run)).toEqual(stored);
    });

    test('drops the issues recorded against a step now out of scope', () => {
        const run = {
            steps: [
                { issues: [issue('cannot activate the control', '1')], outOfScope: true },
                { issues: [issue('no status message on submit', '3')] }
            ],
            extensions: []
        };
        expect(summaryWithoutSkippedIssues(stored, run))
            .toEqual([said('no status message on submit', 3)]);
    });

    test('drops them for an extension the same way', () => {
        const run = {
            steps: [{ issues: [issue('no status message on submit', '3')] }],
            extensions: [{
                issues: [issue('cannot activate the control', '1')], outOfScope: true
            }]
        };
        expect(summaryWithoutSkippedIssues(stored, run))
            .toEqual([said('no status message on submit', 3)]);
    });

    test('keeps a description that is also recorded on a step still in scope', () => {
        // The same problem was hit twice. One of the steps being skipped does
        // not make it stop having happened on the other.
        const run = {
            steps: [
                { issues: [issue('cannot activate the control', '1')], outOfScope: true },
                { issues: [issue('cannot activate the control', '1')] }
            ],
            extensions: []
        };
        expect(summaryWithoutSkippedIssues([said('cannot activate the control', 1)], run))
            .toEqual([said('cannot activate the control', 1)]);
    });

    test('leaves prose the tester wrote themselves alone', () => {
        const run = {
            steps: [{ issues: [issue('cannot activate the control', '1')], outOfScope: true }],
            extensions: []
        };
        const comments = [
            said('Sign-in is out of scope for this engagement.'),
            said('cannot activate the control', 1)
        ];
        expect(summaryWithoutSkippedIssues(comments, run))
            .toEqual([said('Sign-in is out of scope for this engagement.')]);
    });

    test('does not put a description back when the mark comes off', () => {
        const run = {
            steps: [{ issues: [issue('cannot activate the control', '1')] }],
            extensions: []
        };
        expect(summaryWithoutSkippedIssues([], run)).toEqual([]);
    });
});

describe('summaryWithoutIssues', () => {
    test('removes the description of an issue that has been deleted', () => {
        // The run no longer holds it, which is the state after the splice.
        const run = { steps: [{ issues: [issue('still here', '3')] }], extensions: [] };
        expect(summaryWithoutIssues(
            [said('deleted one', 1), said('still here', 3)], ['deleted one'], run
        )).toEqual([said('still here', 3)]);
    });

    test('keeps it when the same description is still recorded elsewhere', () => {
        const run = { steps: [{ issues: [issue('hit twice', '2')] }], extensions: [] };
        expect(summaryWithoutIssues([said('hit twice', 2)], ['hit twice'], run))
            .toEqual([said('hit twice', 2)]);
    });

    test('leaves the summary alone when nothing is named', () => {
        const run = { steps: [{ issues: [] }], extensions: [] };
        const comments = [said('written by hand')];
        expect(summaryWithoutIssues(comments, [], run)).toBe(comments);
    });
});

describe('summaryWithRenamedIssue', () => {
    /** The run after the edit: the issue now carries the new wording. */
    const edited = { steps: [{ issues: [issue('button has no name', '2')] }], extensions: [] };

    test('rewrites the line in place, keeping its position and its severity', () => {
        const comments = [
            said('first finding', 1), said('unlabelled button', 2), said('third finding', 3)
        ];
        expect(summaryWithRenamedIssue(comments, 'unlabelled button', 'button has no name', edited))
            .toEqual([
                said('first finding', 1), said('button has no name', 2), said('third finding', 3)
            ]);
    });

    test('leaves a summary that never mentioned it alone', () => {
        expect(summaryWithRenamedIssue(
            [said('something else', 2)], 'unlabelled button', 'button has no name', edited
        )).toEqual([said('something else', 2)]);
    });

    test('does nothing when the description did not change', () => {
        const comments = [said('button has no name', 2)];
        expect(summaryWithRenamedIssue(comments, 'button has no name', 'button has no name', edited))
            .toBe(comments);
    });

    test('keeps the old wording when another issue is still recorded under it', () => {
        const run = {
            steps: [
                { issues: [issue('button has no name', '2')] },
                { issues: [issue('unlabelled button', '2')] }
            ],
            extensions: []
        };
        expect(summaryWithRenamedIssue(
            [said('unlabelled button', 2)], 'unlabelled button', 'button has no name', run
        )).toEqual([said('unlabelled button', 2)]);
    });

    test('drops the old line rather than duplicating wording already there', () => {
        const comments = [said('button has no name', 2), said('unlabelled button', 2)];
        expect(summaryWithRenamedIssue(comments, 'unlabelled button', 'button has no name', edited))
            .toEqual([said('button has no name', 2)]);
    });
});

describe('buildOverallCommentsTextFor', () => {
    test('groups the whole technology by severity, not by script', () => {
        const evaluation = normalizeEvaluation(loadFixture('evaluation-with-runs'));
        const text = buildOverallCommentsTextFor(evaluation, 'NVDA');

        // It used to head each block with the script's name, leaving the tester
        // to sort the lot into severity order by hand.
        expect(text).not.toContain('01 Search the catalogue and place a hold');
        expect(text.startsWith('Stoppers:\n')).toBe(true);
        expect(text).toContain('Major Issues:\n');
        expect(text).toContain('Minor Issues\n');
    });

    test('covers one technology and leaves the others out', () => {
        const evaluation = normalizeEvaluation(loadFixture('evaluation-with-runs'));
        const jaws = parseSummaryComments(buildOverallCommentsTextFor(evaluation, 'JAWS'));
        const nvda = parseSummaryComments(buildOverallCommentsTextFor(evaluation, 'NVDA'));

        // Availability shown by color alone was only ever recorded under NVDA.
        const under = (comments: SummaryComment[]) => comments.map((comment) => comment.text);
        expect(under(nvda).some((text) => text.startsWith('Availability is shown'))).toBe(true);
        expect(under(jaws).some((text) => text.startsWith('Availability is shown'))).toBe(false);
    });

    test('is empty for a technology the evaluation does not use', () => {
        const evaluation = normalizeEvaluation(loadFixture('evaluation-with-runs'));
        expect(buildOverallCommentsTextFor(evaluation, 'Orca')).toBe('');
    });
});
