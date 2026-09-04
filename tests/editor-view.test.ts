import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { FunctionalTest } from '../src/types.js';
import { emptyFunctionalTest } from '../src/domain/functional-test.js';
import { toggleMenu } from '../src/ui/controls.js';
import {
    blurFormField, collapseAssistiveTechnologies, getEventControlId, updateTestEditorBackLink
} from '../src/ui/editor-view.js';
import {
    clearDocumentStub, createElementStub, installDocumentStub, type DocumentStub
} from './helpers/dom-stub.js';
import { setCurrentTestIndex, setEvaluation } from '../src/state/store.js';

/**
 * The editor writes each field straight onto the test using the field's `name`
 * attribute as the property name, so the names in index.html are part of the
 * data model rather than decoration.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const INDEX_HTML = fs.readFileSync(path.join(HERE, '..', 'index.html'), 'utf8');

/** Fields whose name is not a property of the test, handled by their own branch. */
const SPECIAL_FIELDS = ['steps', 'results'];

/** The `name` of every input and textarea inside the functional test editor form. */
function editorFieldNames(): string[] {
    const form = INDEX_HTML.slice(
        INDEX_HTML.indexOf('<form id="test-editor-form"'),
        INDEX_HTML.indexOf('<button id="new-step-btn"')
    );
    return [...form.matchAll(/<(?:input|textarea)\b[^>]*\bname="([^"]+)"/g)].map((match) => match[1]);
}

/** An event carrying just what blurFormField reads. */
function blurEvent(name: string, value: string, id = ''): Event {
    return { target: { name, value, id } } as unknown as Event;
}

function withTest(): FunctionalTest {
    const test = emptyFunctionalTest(1);
    setEvaluation({ tests: [test], score: 0 });
    setCurrentTestIndex(0);
    return test;
}

describe('editor field names', () => {
    test('the form has fields to check', () => {
        expect(editorFieldNames().length).toBeGreaterThan(0);
    });

    test('every field is named for the property it edits', () => {
        const properties = Object.keys(emptyFunctionalTest());
        const unknownFields = editorFieldNames()
            .filter((name) => !SPECIAL_FIELDS.includes(name) && !properties.includes(name));
        // A field named for anything else writes a property nothing reads, and
        // the edit is silently lost when the editor is next opened.
        expect(unknownFields).toEqual([]);
    });
});

describe('blurFormField', () => {
    test('writes the start location and operating system onto the test', () => {
        const test = withTest();
        blurFormField(blurEvent('startLocation', 'https://example.org'));
        blurFormField(blurEvent('operatingSystem', 'Windows'));

        expect(test.startLocation).toBe('https://example.org');
        expect(test.operatingSystem).toBe('Windows');
    });

    test('writes step instructions in place, keeping the recorded issues', () => {
        const test = withTest();
        test.steps[0].issues.push({ description: 'kept', findingURL: '', score: '1' });
        blurFormField(blurEvent('steps', 'do the thing', 'step-contents[0]'));

        expect(test.steps[0].instructions).toBe('do the thing');
        expect(test.steps[0].issues).toHaveLength(1);
    });
});

describe('delete button events', () => {
    test('uses the button id when a nested icon is clicked', () => {
        const event = {
            currentTarget: { id: 'step-delete[3]' },
            target: { id: '' }
        } as unknown as Event;

        expect(getEventControlId(event)).toBe('step-delete[3]');
    });
});

describe('the editor Back link', () => {
    let documentStub: DocumentStub;

    beforeEach(() => {
        documentStub = installDocumentStub(['test-editor-back']);
    });

    afterEach(() => {
        clearDocumentStub();
    });

    test('names and targets the evaluation screen when opened from there', () => {
        updateTestEditorBackLink('evaluation');
        const back = documentStub.getElementById('test-editor-back')!;

        expect(back.getAttribute('href')).toBe('#evaluation-editor-heading');
        expect(back.getAttribute('aria-label')).toBe('Back to Evaluation');
    });

    test('names and targets Evaluation Home when opened from the landing screen', () => {
        updateTestEditorBackLink('landing');
        const back = documentStub.getElementById('test-editor-back')!;

        expect(back.getAttribute('href')).toBe('#landing-heading');
        expect(back.getAttribute('aria-label')).toBe('Back to Evaluation Home');
    });
});

/** How long announce leaves the region empty before filling it. */
const SPOKEN_MS = 400;

describe('collapsing the assistive technology list', () => {
    let documentStub: DocumentStub;

    beforeEach(() => {
        documentStub = installDocumentStub(['app-status']);
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        clearDocumentStub();
    });

    test('closes it, puts focus back on the button, and says it has closed', () => {
        // Collapsing from the button leaves focus where it already was, so
        // there is no focus change for a reader to speak and an aria-expanded
        // that flips underneath it is not reliably reported. Without this the
        // tester had to ask what was focused to learn the list had closed.
        const button = createElementStub('BUTTON');
        const menu = createElementStub('DIV');
        button.setAttribute('aria-expanded', 'true');

        collapseAssistiveTechnologies(
            button as unknown as HTMLElement, menu as unknown as HTMLElement
        );

        expect(button.getAttribute('aria-expanded')).toBe('false');
        expect((menu as unknown as { hidden: boolean }).hidden).toBe(true);
        expect(button.focused).toBe(true);

        vi.advanceTimersByTime(SPOKEN_MS);
        expect(documentStub.getElementById('app-status')!.textContent)
            .toBe('Assistive technology list collapsed.');
    });
});

describe('expanding the assistive technology list', () => {
    afterEach(() => {
        clearDocumentStub();
    });

    test('uses the disclosure button when its nested chevron receives the click', () => {
        const documentStub = installDocumentStub(['test-edit-at-menu']);
        const button = createElementStub('BUTTON');
        button.setAttribute('aria-expanded', 'false');
        button.setAttribute('aria-controls', 'test-edit-at-menu');

        toggleMenu({
            currentTarget: button,
            target: createElementStub('svg')
        } as unknown as Event);

        expect(button.getAttribute('aria-expanded')).toBe('true');
        expect((documentStub.getElementById('test-edit-at-menu') as unknown as { hidden: boolean }).hidden)
            .toBe(false);
    });
});
