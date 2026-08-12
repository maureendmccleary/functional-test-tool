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

/** Parses the index back out of an id like `step-contents[3]`. */
export function getStepNumber(stepId: string): number {
    const begin = stepId.indexOf('[') + 1;
    const end = stepId.indexOf(']');
    const indexStr = stepId.slice(begin, end);
    return parseInt(indexStr);
}
