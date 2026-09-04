import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { FunctionalTest } from '../src/types.js';
import {
    clearDocumentStub, createElementStub, installDocumentStub, type DocumentStub
} from './helpers/dom-stub.js';
import {
    markEvaluationChanged, markEvaluationSaved, setCurrentRunIndex, setCurrentTestIndex,
    setEvaluation
} from '../src/state/store.js';
import {
    openTestRun, outOfScopeChanged, performBackButtonClicked, populateIssuesList, populateSummaryList,
    setIssueButtonContent
} from '../src/ui/perform-view.js';

/**
 * What the tester reads under each step, which is the one thing the "Out of
 * scope" checkbox changes on the screen it sits on. The rest of the perform
 * screen is covered by tests/SMOKE.md.
 */

const ELEMENT_IDS = [
    'perform-step-results[0]', 'perform-step-results[1]', 'perform-extension-results[0]',
    'summary-list', 'perform-score', 'perform-screen', 'out-of-scope[0]', 'out-of-scope[1]',
    'extension-out-of-scope[0]'
];

/** A script with two steps and one extension, all recorded against one run. */
function evaluationWithRun(): FunctionalTest {
    const test = {
        name: 'Place a hold',
        testNumber: 1,
        goal: '',
        startLocation: '',
        operatingSystem: 'Windows',
        assistiveTechnologies: ['NVDA'],
        steps: [{ instructions: 'sign in', issues: [] }, { instructions: 'search', issues: [] }],
        extensions: [{ instructions: 'Credentials' }],
        comments: [],
        runs: [{
            assistiveTechnology: 'NVDA',
            operatingSystem: 'Windows',
            score: -1,
            comments: [],
            steps: [
                { issues: [{ description: 'no label', findingURL: '', score: '2' }] },
                { issues: [] }
            ],
            extensions: [{ issues: [] }]
        }]
    } as unknown as FunctionalTest;
    setEvaluation({ tests: [test], score: 0 });
    setCurrentTestIndex(0);
    setCurrentRunIndex(0);
    return test;
}

/** Replaces the evaluation with two scripts, and selects the one at `index`. */
function twoTests(comments: string[][], index: number): void {
    const tests = comments.map((runComments, testNumber) => ({
        name: `Script ${testNumber + 1}`,
        testNumber: testNumber + 1,
        goal: '',
        startLocation: '',
        operatingSystem: 'Windows',
        assistiveTechnologies: ['NVDA'],
        steps: [{ instructions: 'a step', issues: [] }, { instructions: 'another', issues: [] }],
        extensions: [{ instructions: 'Credentials' }],
        comments: [],
        runs: [{
            assistiveTechnology: 'NVDA',
            operatingSystem: 'Windows',
            score: -1,
            comments: runComments.map((text) => ({ text })),
            steps: [{ issues: [] }, { issues: [] }],
            extensions: [{ issues: [] }]
        }]
    }));
    setEvaluation({ tests: tests as unknown as FunctionalTest[], score: 0 });
    setCurrentTestIndex(index);
    setCurrentRunIndex(0);
}

/** A change event from one checkbox, which is all the handler reads. */
function changeEvent(id: string, checked: boolean): Event {
    return { currentTarget: { id, checked } } as unknown as Event;
}

/** The lines drawn into one issue list. */
function linesIn(documentStub: DocumentStub, id: string): string[] {
    return documentStub.elements.get(id)!.children.map((child) => child.textContent);
}

/**
 * Every line of the summary, banners included, in the order they are drawn.
 *
 * The summary is a tree now -- a banner paragraph and a list per severity --
 * so this walks it rather than reading one level of children.
 */
function summaryLines(documentStub: DocumentStub): string[] {
    const lines: string[] = [];
    const walk = (node: { textContent: string; children: typeof node[] }): void => {
        if (node.textContent !== '') {
            lines.push(node.textContent);
        }
        node.children.forEach(walk);
    };
    documentStub.elements.get('summary-list')!.children.forEach(walk);
    return lines;
}

let documentStub: DocumentStub;

beforeEach(() => {
    documentStub = installDocumentStub(ELEMENT_IDS);
});

afterEach(() => {
    clearDocumentStub();
});

describe('populateIssuesList', () => {
    test('draws what was recorded, and stands in for an empty list', () => {
        evaluationWithRun();
        populateIssuesList();
        expect(linesIn(documentStub, 'perform-step-results[0]')).toEqual(['no label']);
        expect(linesIn(documentStub, 'perform-step-results[1]')).toEqual(['No issues']);
        expect(linesIn(documentStub, 'perform-extension-results[0]')).toEqual(['No issues']);
    });

    test('draws "Out of scope" in place of whatever a marked record holds', () => {
        const test = evaluationWithRun();
        test.runs[0].steps[0].outOfScope = true;
        test.runs[0].extensions[0].outOfScope = true;

        populateIssuesList();

        expect(linesIn(documentStub, 'perform-step-results[0]')).toEqual(['Out of scope']);
        expect(linesIn(documentStub, 'perform-step-results[1]')).toEqual(['No issues']);
        expect(linesIn(documentStub, 'perform-extension-results[0]')).toEqual(['Out of scope']);
    });

    test('redraws rather than appending to what is already there', () => {
        evaluationWithRun();
        populateIssuesList();
        populateIssuesList();
        expect(linesIn(documentStub, 'perform-step-results[0]')).toEqual(['no label']);
    });
});

describe('issue button labels', () => {
    test('adds, removes and restores the plus with the Add Issue label', () => {
        const button = createElementStub('BUTTON');

        setIssueButtonContent(button as unknown as HTMLElement, 0);
        expect(button.children[0].classList.contains('icon-add')).toBe(true);
        expect(button.children[1].textContent).toBe('Add Issue');
        expect(button.classList.contains('control-with-icon')).toBe(true);

        setIssueButtonContent(button as unknown as HTMLElement, 2);
        expect(button.children).toHaveLength(1);
        expect(button.children[0].textContent).toBe('View 2 Issues');
        expect(button.classList.contains('control-with-icon')).toBe(false);

        setIssueButtonContent(button as unknown as HTMLElement, 0);
        expect(button.children).toHaveLength(2);
        expect(button.children[0].classList.contains('icon-add')).toBe(true);
    });
});

describe('populateSummaryList', () => {
    test('lists the comments recorded against the run', () => {
        twoTests([['Stoppers:', 'Focus is lost']], 0);
        populateSummaryList();
        expect(summaryLines(documentStub)).toEqual(['Stoppers:', 'Focus is lost']);
    });

    test('a run with no comments reads "No Issues"', () => {
        twoTests([[]], 0);
        populateSummaryList();
        expect(summaryLines(documentStub)).toEqual(['No Issues']);
    });

    test('redraws rather than appending to what is already there', () => {
        twoTests([['only once']], 0);
        populateSummaryList();
        populateSummaryList();
        expect(summaryLines(documentStub)).toEqual(['only once']);
    });
});

describe('opening a run and the summary left by the last one', () => {
    test('the next script clears the previous script summary', () => {
        twoTests([['Script one had this'], []], 0);
        populateSummaryList();
        expect(summaryLines(documentStub)).toEqual(['Script one had this']);

        // Selecting the second script and opening its run is what the tester
        // does by pressing Perform on it.
        setCurrentTestIndex(1);
        openTestRun();

        expect(summaryLines(documentStub)).toEqual(['No Issues']);
    });

    test('a script with its own summary shows that one, not the previous', () => {
        twoTests([['Script one had this'], ['Script two had that']], 0);
        populateSummaryList();
        setCurrentTestIndex(1);
        openTestRun();
        expect(summaryLines(documentStub)).toEqual(['Script two had that']);
    });
});

describe('outOfScopeChanged', () => {
    test('marks the step the checkbox belongs to and redraws its list', () => {
        const test = evaluationWithRun();

        outOfScopeChanged(changeEvent('out-of-scope[0]', true));

        expect(test.runs[0].steps[0].outOfScope).toBe(true);
        expect(test.runs[0].steps[1].outOfScope).toBeUndefined();
        expect(linesIn(documentStub, 'perform-step-results[0]')).toEqual(['Out of scope']);
    });

    test('files an extension checkbox against the extension, not the step', () => {
        const test = evaluationWithRun();

        outOfScopeChanged(changeEvent('extension-out-of-scope[0]', true));

        expect(test.runs[0].extensions[0].outOfScope).toBe(true);
        expect(test.runs[0].steps[0].outOfScope).toBeUndefined();
    });

    test('unticking removes the field, leaving the record as it started', () => {
        const test = evaluationWithRun();

        outOfScopeChanged(changeEvent('out-of-scope[0]', true));
        outOfScopeChanged(changeEvent('out-of-scope[0]', false));

        expect('outOfScope' in test.runs[0].steps[0]).toBe(false);
        expect(linesIn(documentStub, 'perform-step-results[0]')).toEqual(['no label']);
    });

    test('takes the skipped issues out of a summary already stored', () => {
        const test = evaluationWithRun();
        const run = test.runs[0];
        run.steps[1].issues = [{ description: 'count not announced', findingURL: '', score: '3' }];
        run.comments = [{ text: 'no label', severity: 2 }, { text: 'count not announced', severity: 3 }];

        outOfScopeChanged(changeEvent('out-of-scope[0]', true));

        expect(run.comments).toEqual([{ text: 'count not announced', severity: 3 }]);
        // Drawn under its banner, as the report draws it.
        expect(summaryLines(documentStub)).toEqual(['Minor Issues', 'count not announced']);
    });

    test('a summary left with nothing in it reads "No Issues"', () => {
        const test = evaluationWithRun();
        test.runs[0].comments = [{ text: 'no label', severity: 2 }];

        outOfScopeChanged(changeEvent('out-of-scope[0]', true));

        expect(test.runs[0].comments).toEqual([]);
        expect(summaryLines(documentStub)).toEqual(['No Issues']);
    });

    test('does not touch the score, which is the tester\'s', () => {
        const test = evaluationWithRun();
        test.runs[0].score = 1;

        outOfScopeChanged(changeEvent('out-of-scope[0]', true));

        expect(test.runs[0].score).toBe(1);
    });

    test('a checkbox with no record behind it is left alone', () => {
        evaluationWithRun();
        expect(() => outOfScopeChanged(changeEvent('out-of-scope[7]', true))).not.toThrow();
    });
});

describe('leaving Perform', () => {
    test('keeps the existing file-save warning exactly', () => {
        markEvaluationChanged();
        const confirm = vi.fn(() => false);
        (globalThis as unknown as { window: { confirm: typeof confirm } }).window = { confirm };
        const preventDefault = vi.fn();

        performBackButtonClicked({ preventDefault } as unknown as Event);

        expect(preventDefault).toHaveBeenCalledOnce();
        expect(confirm).toHaveBeenCalledWith(
            'These results have not been saved to a file. They are kept while the app is open, '
            + 'but will be lost if you close it. Go back anyway?'
        );
        markEvaluationSaved();
    });
});
