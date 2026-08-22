/**
 * Generated element ids for steps.
 *
 * These strings are part of the contract with index.html: markup and the
 * querySelectorAll prefix matches depend on their exact shape.
 */

export function getStepId(stepNumber: number | string): string {
    return `step-contents[${stepNumber}]`;
}

/** Id of a step's heading in the perform dialog, used as its accessible name. */
export function getStepLabelIdForPerform(stepNumber: number): string {
    return `step-label[${stepNumber}]`;
}

/** Which list an element belongs to, read off its id prefix. */
export function isExtensionElementId(elementId: string): boolean {
    return elementId.startsWith('add-extension-issue-btn')
        || elementId.startsWith('perform-extension')
        || elementId.startsWith('extension-');
}

/** Id of the list holding one step's or extension's recorded issues. */
export function getIssueListId(section: 'steps' | 'extensions', index: number): string {
    return section === 'extensions'
        ? `perform-extension-results[${index}]`
        : `perform-step-results[${index}]`;
}

/** Id of an extension's heading in the perform dialog, used as its accessible name. */
export function getExtensionLabelIdForPerform(index: number): string {
    return `extension-label[${index}]`;
}

/** Id of an extension's instructions field in the editor. */
export function getExtensionId(index: number | string): string {
    return `extension-contents[${index}]`;
}

/** Parses the index back out of an id like `step-contents[3]`. */
export function getStepNumber(stepId: string): number {
    const begin = stepId.indexOf('[') + 1;
    const end = stepId.indexOf(']');
    const indexStr = stepId.slice(begin, end);
    return parseInt(indexStr);
}
