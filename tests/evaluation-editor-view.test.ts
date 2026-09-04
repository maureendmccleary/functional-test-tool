import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import {
    beginPageEditSession, discardPageEditSession, getEvaluation, hasPendingPageChanges,
    hasUnsavedChanges, setEvaluation
} from '../src/state/store.js';
import { saveEvaluationChanges } from '../src/ui/evaluation-editor-view.js';
import {
    clearDocumentStub, installDocumentStub, type DocumentStub
} from './helpers/dom-stub.js';

const IDS = [
    'select-test', 'eval-select-test', 'edit-test', 'perform-test',
    'eval-edit-test', 'eval-delete-test', 'eval-workspace', 'eval-asset', 'eval-name',
    'landing-workspace', 'landing-asset', 'landing-name', 'eval-editor-save'
];

let documentStub: DocumentStub;

beforeEach(() => {
    documentStub = installDocumentStub(IDS);
    setEvaluation({ tests: [], score: 0, name: 'Original' });
    beginPageEditSession();
});

afterEach(() => {
    clearDocumentStub();
});

describe('saving Evaluation-page changes', () => {
    test('commits the complete draft and resets the Save changes state', () => {
        getEvaluation().name = 'Updated';
        getEvaluation().asset = 'Catalogue';

        const result = saveEvaluationChanges();

        expect(result).toEqual({
            saved: true,
            message: 'Changes saved successfully.'
        });
        expect(hasPendingPageChanges()).toBe(false);
        expect(hasUnsavedChanges()).toBe(true);
        expect(documentStub.getElementById('eval-editor-save')!.getAttribute('aria-disabled'))
            .toBe('true');

        discardPageEditSession();
        expect(getEvaluation().name).toBe('Updated');
        expect(getEvaluation().asset).toBe('Catalogue');
    });

    test('does nothing when there is no effective change', () => {
        expect(saveEvaluationChanges()).toEqual({ saved: false });
        expect(hasUnsavedChanges()).toBe(false);
    });
});
