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

/**
 * The entry first-letter navigation should move to, or -1 for no match.
 *
 * Two behaviours, both what a native listbox does. One character, or the same
 * character repeated, cycles: the search starts *after* the current entry and
 * wraps, so pressing "v" three times walks Voice Control, VoiceOver, VoiceView.
 * A longer query narrows instead: it starts at the current entry, so typing
 * "voicev" while already on VoiceOver lands on VoiceView rather than skipping
 * past it.
 *
 * The catalogue is alphabetical for this reason. Comparison is case
 * insensitive, since the typed character never carries case meaningfully.
 */
export function findTypeAheadIndex(labels: string[], query: string, fromIndex: number): number {
    const needle = query.toLowerCase();
    if (needle === '') {
        return -1;
    }

    const cycling = [...needle].every((character) => character === needle[0]);
    const search = cycling ? needle[0] : needle;
    const start = cycling ? fromIndex + 1 : fromIndex;

    for (let offset = 0; offset < labels.length; offset++) {
        const index = (((start + offset) % labels.length) + labels.length) % labels.length;
        if (String(labels[index] ?? '').toLowerCase().startsWith(search)) {
            return index;
        }
    }
    return -1;
}

/**
 * The index `delta` steps from `fromIndex`, wrapping at both ends.
 *
 * Wrapping arithmetic is where off-by-one errors live, so it is here rather
 * than inline in the key handler. An empty list has no index to move to.
 */
export function stepIndex(length: number, fromIndex: number, delta: number): number {
    if (length <= 0) {
        return -1;
    }
    return (((fromIndex + delta) % length) + length) % length;
}
