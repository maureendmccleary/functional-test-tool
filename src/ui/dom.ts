/**
 * Typed element lookup.
 *
 * The split matters. `requireEl` is for the places today's code would throw on
 * a missing element anyway -- it still throws, just with a message naming the
 * id. `findEl` is for the places today's code null-checks and carries on.
 * Using requireEl where the original checked for null would turn a silent
 * no-op into a crash, which is a behavior change.
 */

export function requireEl<T extends HTMLElement>(id: string): T {
    const el = document.getElementById(id);
    if (!el) {
        throw new Error(`Missing element: ${id}`);
    }
    return el as T;
}

/** Looks up an element that may legitimately be absent. */
export function findEl<T extends HTMLElement>(id: string): T | null {
    return document.getElementById(id) as T | null;
}

/** A <form> looked up by its name attribute, as document.forms[name]. */
export function requireForm(name: string): HTMLFormElement {
    const form = document.forms.namedItem(name);
    if (!form) {
        throw new Error(`Missing form: ${name}`);
    }
    return form;
}
