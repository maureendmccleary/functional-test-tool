import type { Evaluation } from '../types.js';

/**
 * File System Access API wrappers. Chromium only; Firefox and Safari do not
 * implement showOpenFilePicker/showSaveFilePicker.
 *
 * Both pickers reject with an AbortError when the user dismisses the dialog.
 * Callers must treat that as a normal outcome, not a failure.
 */

/**
 * Whether this browser can open and save files.
 *
 * Worth checking before offering the action: a large share of screen reader
 * users work in Firefox, where these APIs do not exist.
 */
export function isFilePickerSupported(): boolean {
    return typeof window.showOpenFilePicker === 'function'
        && typeof window.showSaveFilePicker === 'function';
}

export const fileopts = {
    types: [{
        description: "JSON file",
        accept: { "application/json": [".json"] }
    }],
    excludeAcceptAllOption: true
};

/**
 * Returns the parsed file contents as `unknown`: the shape on disk is whatever
 * an older version of the app wrote. normalizeEvaluation turns it into an
 * Evaluation, and is the only thing that should.
 */
export async function loadFile(): Promise<unknown> {
    const pickerOpts = {
        types: [
            {
                description: "JSON Files",
                accept: {
                    "application/json": [".json"],
                },
            },
        ],
        excludeAcceptAllOption: true,
        multiple: false,
        startIn: "documents"
    };

    const [filePicker] = await window.showOpenFilePicker(pickerOpts);
    const fp = await filePicker.getFile();
    const jobjtext = await fp.text();
    return JSON.parse(jobjtext);
}

/**
 * The file this evaluation has been saved to, once it has been saved once.
 *
 * Kept so that saving again during a session writes straight to it. A tester
 * performing a long evaluation should be able to save often without a file
 * dialog stealing focus each time, which is most of what makes saving
 * disruptive for a screen reader.
 *
 * Deliberately not taken from `loadFile`. A handle from opening a file would
 * let Save overwrite it with no prompt at all, and the first thing anyone loads
 * is a file they did not mean to write over.
 */
let savedFileHandle: FileSystemFileHandleLike | null = null;

/**
 * Forgets where the evaluation was saved.
 *
 * Called when the evaluation is replaced. Without it, starting a new evaluation
 * and saving would write it over the previous one's file without asking.
 */
export function forgetSavedFile(): void {
    savedFileHandle = null;
}

/** True when saving will write straight to a file rather than ask for one. */
export function hasSavedFile(): boolean {
    return savedFileHandle !== null;
}

/**
 * Writes the evaluation as JSON, asking where only the first time.
 *
 * A failed write clears the handle, so the next attempt asks again rather than
 * retrying somewhere the browser has stopped letting us write.
 */
export async function saveEvaluation(evaluation: Evaluation): Promise<void> {
    const fileHandle = savedFileHandle ?? await window.showSaveFilePicker(fileopts);
    try {
        const fp = await fileHandle.createWritable();
        await fp.write(JSON.stringify(evaluation));
        await fp.close();
    } catch (error) {
        savedFileHandle = null;
        throw error;
    }
    savedFileHandle = fileHandle;
}
