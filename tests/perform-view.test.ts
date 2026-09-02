import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import type { FunctionalTest } from '../src/types.js';
import { clearDocumentStub, installDocumentStub, type DocumentStub } from './helpers/dom-stub.js';
import { setCurrentRunIndex, setCurrentTestIndex, setEvaluation } from '../src/state/store.js';
import { outOfScopeChanged, populateIssuesList } from '../src/ui/perform-view.js';

/**
 * What the tester reads under each step, which is the one thing the "Out of
 * scope" checkbox changes on the screen it sits on. The rest of the perform
 * screen is covered by tests/SMOKE.md.
 */

const ELEMENT_IDS = [
    'perform-step-results[0]', 'perform-step-results[1]', 'perform-extension-results[0]'
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

/** A change event from one checkbox, which is all the handler reads. */
function changeEvent(id: string, checked: boolean): Event {
    return { currentTarget: { id, checked } } as unknown as Event;
}

/** The lines drawn into one issue list. */
function linesIn(documentStub: DocumentStub, id: string): string[] {
    return documentStub.elements.get(id)!.children.map((child) => child.textContent);
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

    test('a checkbox with no record behind it is left alone', () => {
        evaluationWithRun();
        expect(() => outOfScopeChanged(changeEvent('out-of-scope[7]', true))).not.toThrow();
    });
});
