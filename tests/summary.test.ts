import { afterEach, describe, expect, test } from 'vitest';
import type { Evaluation, Issue, TestRunStep, TestRun, FunctionalTest } from '../src/types.js';
import {
    SUMMARY_BANNERS, buildOverallCommentsText, buildOverallCommentsTextFor, buildSummaryText,
    splitSummaryComments, summaryWithoutSkippedIssues
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

const SUMMARY_ELEMENT_IDS = ['general-comments', 'perform-score', 'summary-list'];

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

describe('buildSummaryText', () => {
    test('emits only the severities that have issues, in severity order', () => {
        const map = issuesMap({ steps: [{ issues: [issue('severe thing', '1'), issue('optimization', '4')] }] });
        expect(buildSummaryText(map)).toBe('Stoppers:\nsevere thing\n\nAdvisory\noptimization\n\n');
    });

    test('uses the exact banner text, colons included and omitted', () => {
        // "Stoppers:" and "Major Issues:" carry a colon; "Minor Issues" and
        // "Advisory" do not. This text lands in saved files -- do not tidy it.
        expect(SUMMARY_BANNERS).toEqual(['Stoppers:', 'Major Issues:', 'Minor Issues', 'Advisory']);
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

describe('splitSummaryComments', () => {
    test('strips the banner along with its punctuation and line break', () => {
        expect(splitSummaryComments('Major Issues:\nthe first problem\n\nAdvisory\nthe second problem'))
            .toEqual(['the first problem', 'the second problem']);
    });

    test('round trips buildSummaryText without leaving banner residue', () => {
        const map = issuesMap({
            steps: [{ issues: [issue('cannot activate the control', '1'), issue('no status message', '3')] }]
        });
        expect(splitSummaryComments(buildSummaryText(map).trim()))
            .toEqual(['cannot activate the control', 'no status message']);
    });

    test('leaves text that contains no banners alone', () => {
        expect(splitSummaryComments('just a comment')).toEqual(['just a comment']);
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
});

describe('saveGeneralComments', () => {
    const clickEvent = { preventDefault() { /* no-op */ } } as Event;

    test('clears comments and shows "No Issues" for an empty box', () => {
        const { run, document } = withTestRun([{ issues: [] }]);
        run.comments = ['stale'];
        document.getElementById('general-comments')!.value = '   ';
        saveGeneralComments(clickEvent);
        expect(run.comments).toEqual([]);
        expect(document.getElementById('summary-list')!.children.map((li) => li.textContent))
            .toEqual(['No Issues']);
    });

    test('stores clean issue text after a generate/save round trip', () => {
        const { run, document } = withTestRun([
            { issues: [issue('cannot activate the control', '1')] },
            { issues: [issue('no status message on submit', '3')] }
        ]);
        generateSummary();
        saveGeneralComments(clickEvent);
        expect(run.comments)
            .toEqual(['cannot activate the control', 'no status message on submit']);
        expect(document.getElementById('summary-list')!.children.map((li) => li.textContent))
            .toEqual(run.comments);
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
    const stored = ['cannot activate the control', 'no status message on submit'];

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
            .toEqual(['no status message on submit']);
    });

    test('drops them for an extension the same way', () => {
        const run = {
            steps: [{ issues: [issue('no status message on submit', '3')] }],
            extensions: [{
                issues: [issue('cannot activate the control', '1')], outOfScope: true
            }]
        };
        expect(summaryWithoutSkippedIssues(stored, run))
            .toEqual(['no status message on submit']);
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
        expect(summaryWithoutSkippedIssues(['cannot activate the control'], run))
            .toEqual(['cannot activate the control']);
    });

    test('leaves prose the tester wrote themselves alone', () => {
        const run = {
            steps: [{ issues: [issue('cannot activate the control', '1')], outOfScope: true }],
            extensions: []
        };
        const comments = ['Sign-in is out of scope for this engagement.',
            'cannot activate the control'];
        expect(summaryWithoutSkippedIssues(comments, run))
            .toEqual(['Sign-in is out of scope for this engagement.']);
    });

    test('does not put a description back when the mark comes off', () => {
        const run = {
            steps: [{ issues: [issue('cannot activate the control', '1')] }],
            extensions: []
        };
        expect(summaryWithoutSkippedIssues([], run)).toEqual([]);
    });
});

describe('buildOverallCommentsText', () => {
    test('heads each functional test with its full name and lists its comments', () => {
        const evaluation = normalizeEvaluation(loadFixture('evaluation-with-runs'));
        const text = buildOverallCommentsText(evaluation);
        expect(text.startsWith('01 Search the catalogue and place a hold - NVDA\n\n')).toBe(true);
        expect(text.endsWith('\n\n')).toBe(true);
        // Four scripts: the first was performed with two assistive technologies.
        expect(text.split('\n\n').filter((line) => /^\d\d /.test(line))).toHaveLength(4);
    });

    test('says "No issues." for a functional test with no comments', () => {
        const evaluation = {
            tests: [{ name: 'Empty', testNumber: 1, runs: [] } as unknown as FunctionalTest],
            score: 0
        } satisfies Evaluation;
        expect(buildOverallCommentsText(evaluation)).toBe('01 Empty\n\nNo issues.\n\n');
    });
});

describe('buildOverallCommentsTextFor', () => {
    test('covers one technology and leaves the others out', () => {
        const evaluation = normalizeEvaluation(loadFixture('evaluation-with-runs'));
        const text = buildOverallCommentsTextFor(evaluation, 'JAWS');

        expect(text).toContain('01 Search the catalogue and place a hold - JAWS');
        expect(text).not.toContain('- NVDA');
    });

    test('says "No issues." for a test with nothing written about it', () => {
        const evaluation = normalizeEvaluation(loadFixture('evaluation-with-runs'));
        const text = buildOverallCommentsTextFor(evaluation, 'NVDA');

        expect(text).toContain('02 Renew a borrowed item - NVDA\n\nNo issues.');
    });

    test('is empty for a technology the evaluation does not use', () => {
        const evaluation = normalizeEvaluation(loadFixture('evaluation-with-runs'));
        expect(buildOverallCommentsTextFor(evaluation, 'Orca')).toBe('');
    });
});
