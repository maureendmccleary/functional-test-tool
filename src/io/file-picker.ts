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

/** Prompts for a location and writes the evaluation as JSON. */
export async function saveEvaluation(evaluation: Evaluation): Promise<void> {
    const fileHandle = await window.showSaveFilePicker(fileopts);
    const fp = await fileHandle.createWritable();
    await fp.write(JSON.stringify(evaluation));
    await fp.close();
}
