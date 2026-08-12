import type { ListboxOption, TypeCatalogEntry } from '../types.js';
import { findEl, requireEl } from './dom.js';

/** Builds the checkbox menu of assistive technologies from the at-types catalogue. */
export function fillCheckboxMenu(
    jobj: Record<string, TypeCatalogEntry>,
    checkboxMenuId: string,
    name: string
): void {
    const checkBoxMenu = requireEl(checkboxMenuId);
    let checkBox: HTMLInputElement;

    for (const key in jobj) {
        checkBox = document.createElement('input');
        checkBox.type = "checkbox";
        checkBox.name = name;
        checkBox.value = jobj[key]["friendly-name"];
        checkBox.id = `test-edit-${key}-chk`;
        const checkLabel = document.createElement("label");
        checkLabel.textContent = jobj[key]["friendly-name"];
        checkLabel.htmlFor = checkBox.id;
        checkLabel.appendChild(checkBox);
        checkBoxMenu.appendChild(checkLabel);
        checkBoxMenu.appendChild(document.createElement("br"));
    }
}

/**
 * Fills a <select>. Accepts three shapes, all of which are in use:
 * an array of {value,label}, an array of plain values (index becomes the
 * value), or a catalogue object keyed by id.
 *
 * Returns silently when the element is missing -- the original checks.
 */
export function fillListbox(
    jobj: ListboxOption[] | Array<string | number> | Record<string, TypeCatalogEntry>,
    listboxid: string
): void {
    const lbx = findEl<HTMLSelectElement>(listboxid);
    let elem: HTMLOptionElement;

    if (!lbx) {
        return;
    }

    lbx.innerHTML = "";

    if (Array.isArray(jobj)) {
        for (let i = 0; i < jobj.length; i++) {
            elem = document.createElement('option');
            const entry = jobj[i];
            if (entry && typeof entry === 'object') {
                elem.value = String((entry as ListboxOption).value);
                elem.textContent = (entry as ListboxOption).label;
            } else {
                elem.value = String(i);
                elem.textContent = String(entry);
            }
            lbx.appendChild(elem);
        }
    } else {
        for (const key in jobj) {
            elem = document.createElement('option');
            elem.setAttribute('name', key);
            elem.value = key;
            elem.textContent = jobj[key]["friendly-name"];
            lbx.appendChild(elem);
        }
    }
}

/** Removes every row but the header. */
export function clearTable(table: HTMLTableElement): void {
    const rows = table.rows;

    for (let i = rows.length - 1; i > 0; i--) {
        table.deleteRow(i);
    }
    return;
}

/** A <ul> of the given items, or a <p> holding `emptyText` when there are none. */
export function createUnorderedList(listItems: string[] | undefined, emptyText = ""): HTMLElement {
    if (!Array.isArray(listItems) || listItems.length === 0) {
        const paragraphElem = document.createElement("p");
        paragraphElem.textContent = emptyText;
        return paragraphElem;
    }

    const list = document.createElement("ul");
    listItems.forEach(item => {
        const itemNode = document.createElement("li");
        itemNode.textContent = item;
        list.appendChild(itemNode);
    });

    return list;
}

/** Appends two <br> elements, matching the spacing used elsewhere in the forms. */
export function appendNewlines(div: HTMLElement): void {
    div.appendChild(document.createElement("br"));
    div.appendChild(document.createElement("br"));
}

/** Expand/collapse handler for an aria-expanded button with aria-controls. */
export function toggleMenu(e: Event): void {
    const target = e.target as HTMLElement;
    const isExpanded = target.getAttribute('aria-expanded') === 'true';

    target.setAttribute('aria-expanded', String(!isExpanded));
    const controlsTargetId = target.getAttribute("aria-controls") as string;
    const controlsTarget = requireEl(controlsTargetId);
    controlsTarget.hidden = isExpanded;
}
