import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import {
    beginPageEditSession, commitPageEditSession, getEvaluation, hasPendingPageChanges,
    setEvaluation
} from '../src/state/store.js';
import {
    addPageEditDialogEvents, CHANGES_SAVED_MESSAGE, pageDraftChanged, pageSaveIsDisabled,
    type PageSaveResult, requestPageExit, updatePageSaveState
} from '../src/ui/page-edit.js';
import {
    clearDocumentStub, installDocumentStub, type DocumentStub, type ElementStub
} from './helpers/dom-stub.js';

const IDS = [
    'unsaved-changes-dialog', 'unsaved-changes-heading',
    'unsaved-changes-keep-editing', 'unsaved-changes-discard',
    'unsaved-changes-save', 'destination-status', 'page-save', 'page-status', 'app-status'
];

function clickEvent(invoker: ElementStub): Event {
    return {
        type: 'click',
        currentTarget: invoker,
        target: invoker,
        preventDefault: vi.fn()
    } as unknown as Event;
}

function actionEvent(type = 'click'): Event {
    return { type, preventDefault: vi.fn() } as unknown as Event;
}

let documentStub: DocumentStub;
let invoker: ElementStub;

beforeEach(() => {
    documentStub = installDocumentStub(IDS);
    invoker = documentStub.createElement('A');
    setEvaluation({ tests: [], score: 0, name: 'Original' });
    beginPageEditSession();
    addPageEditDialogEvents();
});

afterEach(() => {
    clearDocumentStub();
});

function request(
    continued: () => void,
    save: () => PageSaveResult = () => ({
        saved: commitPageEditSession(),
        message: CHANGES_SAVED_MESSAGE
    })
): void {
    requestPageExit(clickEvent(invoker), {
        save,
        continueNavigation: continued,
        successStatusId: 'destination-status'
    });
}

describe('the unsaved page exit guard', () => {
    test('leaves immediately without opening a dialog when the page is clean', () => {
        const continued = vi.fn();

        request(continued);

        expect(continued).toHaveBeenCalledOnce();
        expect(documentStub.getElementById('unsaved-changes-dialog')!.open).toBe(false);
    });

    test('opens on its heading only when the page has effective changes', () => {
        getEvaluation().name = 'Changed';

        request(vi.fn());

        expect(documentStub.getElementById('unsaved-changes-dialog')!.open).toBe(true);
        expect(documentStub.getElementById('unsaved-changes-heading')!.focused).toBe(true);
    });

    test('Keep editing closes the dialog, restores focus, and retains the draft', () => {
        getEvaluation().name = 'Changed';
        const continued = vi.fn();
        request(continued);

        expect((document as unknown as { title: string }).title)
            .toBe('Unsaved changes - Functional Accessibility Testing Tool');

        documentStub.getElementById('unsaved-changes-keep-editing')!
            .dispatchEvent(actionEvent());

        expect(continued).not.toHaveBeenCalled();
        expect(invoker.focused).toBe(true);
        expect(hasPendingPageChanges()).toBe(true);
        expect((document as unknown as { title: string }).title)
            .toBe('Functional Accessibility Testing Tool');
    });

    test('Escape has the same safe behavior as Keep editing', () => {
        getEvaluation().name = 'Changed';
        request(vi.fn());
        const cancel = actionEvent('cancel');

        documentStub.getElementById('unsaved-changes-dialog')!.dispatchEvent(cancel);

        expect(cancel.preventDefault).toHaveBeenCalledOnce();
        expect(invoker.focused).toBe(true);
        expect(hasPendingPageChanges()).toBe(true);
    });

    test('Discard changes restores the complete committed evaluation', () => {
        getEvaluation().name = 'Changed';
        getEvaluation().tests.push({ name: 'Partial', runs: [] } as never);
        const continued = vi.fn();
        request(continued);

        documentStub.getElementById('unsaved-changes-discard')!
            .dispatchEvent(actionEvent());

        expect(continued).toHaveBeenCalledOnce();
        expect(getEvaluation().name).toBe('Original');
        expect(getEvaluation().tests).toEqual([]);
    });

    test('Save and continue commits, navigates, and reports success', () => {
        getEvaluation().name = 'Changed';
        const continued = vi.fn();
        request(continued);

        documentStub.getElementById('unsaved-changes-save')!
            .dispatchEvent(actionEvent());

        expect(continued).toHaveBeenCalledOnce();
        expect(getEvaluation().name).toBe('Changed');
        expect(documentStub.getElementById('destination-status')!.textContent)
            .toBe(CHANGES_SAVED_MESSAGE);
    });

    test('a failed save stays on the page and does not discard the draft', () => {
        getEvaluation().name = 'Changed';
        const continued = vi.fn();
        request(continued, () => ({ saved: false }));

        documentStub.getElementById('unsaved-changes-save')!
            .dispatchEvent(actionEvent());

        expect(continued).not.toHaveBeenCalled();
        expect(hasPendingPageChanges()).toBe(true);
        expect(documentStub.getElementById('unsaved-changes-dialog')!.open).toBe(false);
        expect((document as unknown as { title: string }).title)
            .toBe('Functional Accessibility Testing Tool');
    });
});

describe('Save changes state', () => {
    test('is disabled when clean, enables for a change, and disables after a revert', () => {
        updatePageSaveState('page-save');
        expect(pageSaveIsDisabled('page-save')).toBe(true);

        getEvaluation().name = 'Changed';
        pageDraftChanged('page-save', 'page-status');
        expect(pageSaveIsDisabled('page-save')).toBe(false);

        getEvaluation().name = 'Original';
        pageDraftChanged('page-save', 'page-status');
        expect(pageSaveIsDisabled('page-save')).toBe(true);
    });

    test('clears a stale success message when editing resumes', () => {
        documentStub.getElementById('page-status')!.textContent = CHANGES_SAVED_MESSAGE;
        getEvaluation().name = 'Changed';

        pageDraftChanged('page-save', 'page-status');

        expect(documentStub.getElementById('page-status')!.textContent).toBe('');
    });
});
