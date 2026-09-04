import {
    discardPageEditSession, endPageEditSession, hasPendingPageChanges
} from '../state/store.js';
import { requireEl } from './dom.js';
import { restoreScreenTitle, setSectionTitle } from './screens.js';
import { showStatusMessage } from './status.js';

export const CHANGES_SAVED_MESSAGE = 'Changes saved successfully.';

/** The outcome a page-specific save hands to the shared leave dialog. */
export interface PageSaveResult {
    saved: boolean;
    message?: string;
}

interface PageExitRequest {
    invoker: HTMLElement;
    save: () => PageSaveResult;
    continueNavigation: () => void;
    successStatusId: string;
}

let pendingExit: PageExitRequest | null = null;

/**
 * Keeps a Save changes button focusable while exposing its unavailable state.
 *
 * Native disabled drops focus when the user has just activated the button.
 * aria-disabled keeps that focus stable, and each handler guards activation.
 */
export function updatePageSaveState(buttonId: string): void {
    requireEl(buttonId).setAttribute(
        'aria-disabled', hasPendingPageChanges() ? 'false' : 'true'
    );
}

/** Clears stale success copy and refreshes Save after any editor mutation. */
export function pageDraftChanged(buttonId: string, statusId: string): void {
    requireEl(statusId).textContent = '';
    updatePageSaveState(buttonId);
}

/** True when an aria-disabled Save changes button must ignore activation. */
export function pageSaveIsDisabled(buttonId: string): boolean {
    return requireEl(buttonId).getAttribute('aria-disabled') === 'true';
}

function closeUnsavedChangesDialog(): void {
    requireEl<HTMLDialogElement>('unsaved-changes-dialog').close();
}

function keepEditing(): void {
    const request = pendingExit;
    pendingExit = null;
    closeUnsavedChangesDialog();
    restoreScreenTitle();
    request?.invoker.focus();
}

function discardAndContinue(): void {
    const request = pendingExit;
    if (!request) {
        return;
    }

    pendingExit = null;
    discardPageEditSession();
    closeUnsavedChangesDialog();
    restoreScreenTitle();
    request.continueNavigation();
}

function saveAndContinue(): void {
    const request = pendingExit;
    if (!request) {
        return;
    }

    pendingExit = null;
    closeUnsavedChangesDialog();
    restoreScreenTitle();
    const result = request.save();
    if (!result.saved) {
        return;
    }

    endPageEditSession();
    request.continueNavigation();
    showStatusMessage(
        request.successStatusId, result.message || CHANGES_SAVED_MESSAGE, 0
    );
}

/**
 * Navigates at once from a clean editor, or asks what to do with its draft.
 */
export function requestPageExit(
    e: Event,
    options: Omit<PageExitRequest, 'invoker'>
): void {
    e.preventDefault();
    if (!hasPendingPageChanges()) {
        endPageEditSession();
        options.continueNavigation();
        return;
    }

    pendingExit = {
        ...options,
        invoker: (e.currentTarget as HTMLElement | null)
            || (e.target as HTMLElement)
    };
    const dialog = requireEl<HTMLDialogElement>('unsaved-changes-dialog');
    setSectionTitle('Unsaved changes');
    dialog.showModal();
    requireEl('unsaved-changes-heading').focus();
}

/** Wires the shared dialog once at startup. */
export function addPageEditDialogEvents(): void {
    requireEl('unsaved-changes-keep-editing').addEventListener('click', keepEditing);
    requireEl('unsaved-changes-discard').addEventListener('click', discardAndContinue);
    requireEl('unsaved-changes-save').addEventListener('click', saveAndContinue);
    requireEl('unsaved-changes-dialog').addEventListener('cancel', (e) => {
        e.preventDefault();
        keepEditing();
    });
}
