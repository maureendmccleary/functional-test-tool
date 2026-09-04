import { beforeEach, describe, expect, test } from 'vitest';
import {
    beginPageEditSession, commitPageEditSession, discardPageEditSession, getEvaluation,
    hasPendingPageChanges, hasUnsavedChanges, hasUnsavedWork, markEvaluationChanged,
    markEvaluationSaved, resetPageEditBaseline, setEvaluation
} from '../src/state/store.js';

beforeEach(() => {
    setEvaluation({ tests: [], score: 0 });
});

describe('page edit sessions', () => {
    test('keeps draft mutations out of the committed evaluation until commit', () => {
        beginPageEditSession();
        getEvaluation().name = 'Draft name';

        expect(hasPendingPageChanges()).toBe(true);
        expect(hasUnsavedChanges()).toBe(false);

        expect(commitPageEditSession()).toBe(true);
        expect(hasPendingPageChanges()).toBe(false);
        expect(hasUnsavedChanges()).toBe(true);

        discardPageEditSession();
        expect(getEvaluation().name).toBe('Draft name');
    });

    test('discard removes every pending mutation and preserves prior file state', () => {
        markEvaluationChanged();
        beginPageEditSession();
        getEvaluation().workspace = 'Not committed';
        discardPageEditSession();

        expect(getEvaluation().workspace).toBeUndefined();
        expect(hasUnsavedChanges()).toBe(true);
    });

    test('treats a new blank item as clean without committing it', () => {
        beginPageEditSession();
        getEvaluation().tests.push({ name: '', runs: [] } as never);
        resetPageEditBaseline();

        expect(hasPendingPageChanges()).toBe(false);
        discardPageEditSession();
        expect(getEvaluation().tests).toEqual([]);
    });

    test('recognises when a user restores the baseline value', () => {
        setEvaluation({ tests: [], score: 0, name: 'Original' });
        beginPageEditSession();
        getEvaluation().name = 'Changed';
        expect(hasPendingPageChanges()).toBe(true);

        getEvaluation().name = 'Original';
        expect(hasPendingPageChanges()).toBe(false);
    });

    test('before-unload state includes both pending and committed work', () => {
        beginPageEditSession();
        getEvaluation().asset = 'Pending';
        expect(hasUnsavedWork()).toBe(true);

        commitPageEditSession();
        expect(hasUnsavedWork()).toBe(true);

        markEvaluationSaved();
        expect(hasUnsavedWork()).toBe(false);
    });
});
