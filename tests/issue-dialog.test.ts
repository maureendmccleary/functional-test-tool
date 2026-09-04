import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import type { FunctionalTest } from '../src/types.js';
import { clearDocumentStub, installDocumentStub, type DocumentStub } from './helpers/dom-stub.js';
import {
    setCurrentRunIndex, setCurrentSection, setCurrentStep, setCurrentTestIndex, setEvaluation
} from '../src/state/store.js';
import {
    currentRecordLabel, getIssueButtonControlId, validateIssueInputs
} from '../src/ui/issue-dialog.js';

/**
 * The score field rejecting "Not Rated (-1)" is the only thing keeping a score
 * nothing downstream can read out of a saved file, so what it refuses and what
 * it says while refusing are both worth pinning down.
 */

const ELEMENT_IDS = [
    'add-issue-description', 'add-issue-score', 'add-issue-findingURL',
    'add-issue-description-error', 'add-issue-score-error'
];

/** One script with two steps and an extension, all recorded against one run. */
function withRun(): FunctionalTest {
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
            steps: [{ issues: [] }, { issues: [] }],
            extensions: [{ issues: [] }]
        }]
    } as unknown as FunctionalTest;
    setEvaluation({ tests: [test], score: 0 });
    setCurrentTestIndex(0);
    setCurrentRunIndex(0);
    return test;
}

/** Fills the entry fields the way the tester would have left them. */
function enter(documentStub: DocumentStub, description: string, score: string): void {
    documentStub.elements.get('add-issue-description')!.value = description;
    documentStub.elements.get('add-issue-score')!.value = score;
}

function errorOn(documentStub: DocumentStub, field: 'description' | 'score'): string {
    return documentStub.elements.get(`add-issue-${field}-error`)!.textContent;
}

let documentStub: DocumentStub;

beforeEach(() => {
    documentStub = installDocumentStub(ELEMENT_IDS);
    withRun();
    setCurrentSection('steps');
    setCurrentStep(0);
});

afterEach(() => {
    clearDocumentStub();
});

describe('currentRecordLabel', () => {
    test('names a step and an extension by their number from 1', () => {
        setCurrentStep(2);
        expect(currentRecordLabel()).toBe('Step 3');
        setCurrentSection('extensions');
        setCurrentStep(0);
        expect(currentRecordLabel()).toBe('Extension 1');
    });
});

describe('Add Issue button events', () => {
    test('uses the button id when a nested decorative icon is clicked', () => {
        const event = {
            currentTarget: { id: 'add-extension-issue-btn[1]' },
            target: { id: '' }
        } as unknown as Event;

        expect(getIssueButtonControlId(event)).toBe('add-extension-issue-btn[1]');
    });
});

describe('validateIssueInputs', () => {
    test('accepts a description with any score a tester can assign', () => {
        enter(documentStub, 'Focus is lost after the menu closes', '2');
        expect(validateIssueInputs()).toBe(true);
        expect(errorOn(documentStub, 'score')).toBe('');
    });

    test('still refuses a score of -1, which nothing downstream can read', () => {
        enter(documentStub, 'N/A', '-1');
        expect(validateIssueInputs()).toBe(false);
        expect(documentStub.elements.get('add-issue-score')!.getAttribute('aria-invalid'))
            .toBe('true');
        expect(documentStub.elements.get('add-issue-score')!.focused).toBe(true);
    });

    test('points at the checkbox that does what the tester was reaching for', () => {
        setCurrentStep(1);
        enter(documentStub, 'N/A', '-1');
        validateIssueInputs();
        expect(errorOn(documentStub, 'score')).toBe(
            'Score is required. To record that Step 2 was not tested, close this dialog and '
            + 'mark it Out of scope.'
        );
    });

    test('names the extension when that is what the dialog is open on', () => {
        setCurrentSection('extensions');
        setCurrentStep(0);
        enter(documentStub, 'N/A', '-1');
        validateIssueInputs();
        expect(errorOn(documentStub, 'score')).toContain('Extension 1 was not tested');
    });

    test('an empty description is refused before the score is looked at', () => {
        enter(documentStub, '   ', '-1');
        expect(validateIssueInputs()).toBe(false);
        expect(errorOn(documentStub, 'description')).toBe('Description is required.');
        expect(errorOn(documentStub, 'score')).toBe('');
    });
});
