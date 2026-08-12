/**
 * Normalization for multi-select values (assistive technologies, operating
 * systems). Pure; no DOM.
 */

export function normalizeSelectionValues(
    values: unknown,
    aliasMap: Record<string, string> = {}
): string[] {
    let list: unknown[];
    if (!Array.isArray(values)) {
        list = values === undefined || values === null ? [] : [values];
    } else {
        list = values;
    }

    return list
        .filter((value) => value !== undefined && value !== null)
        .map((value) => String(value).trim())
        .filter((value) => value.length > 0)
        .map((value) => {
            const normalizedKey = value.toLowerCase();
            return aliasMap[normalizedKey] || value;
        })
        .filter((value, index, allValues) => allValues.indexOf(value) === index);
}

/** The subset of a checkbox this reads. Accepts real inputs and plain objects. */
interface CheckboxLike {
    checked: boolean;
    value: string;
}

/** Reads the values of every checked box, normalized and deduplicated. */
export function collectSelectedValues(
    checkboxes: ArrayLike<CheckboxLike | null | undefined> | null | undefined
): string[] {
    return normalizeSelectionValues(
        Array.from(checkboxes || [])
            .filter((checkbox) => checkbox && checkbox.checked)
            .map((checkbox) => (checkbox as CheckboxLike).value)
    );
}
