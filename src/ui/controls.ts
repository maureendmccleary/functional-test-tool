import type { ListboxOption, TypeCatalogEntry } from '../types.js';
import type { SummaryGroup } from '../domain/summary.js';
import { linkedParts } from '../domain/linked-text.js';
import { findEl, requireEl } from './dom.js';

/**
 * Builds the checkbox list of assistive technologies from the at-types
 * catalogue. The container is the body of a disclosure and carries no role of
 * its own, so these are plain checkboxes, not menuitemcheckboxes.
 */
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

    lbx.textContent = "";

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

/**
 * Writes text into an element, with any web address in it as a link.
 *
 * The one place a step's prose is put on screen. Built as elements rather than
 * markup: instructions come out of a saved file, which is untrusted, and
 * innerHTML is refused throughout this app for exactly that reason. The address
 * has already been through safeLinkUrl by the time it arrives here, so nothing
 * but http and https can be followed.
 *
 * Links open in a new tab. Performing a test in the same one would take the
 * tool away mid-run and lose the results recorded so far.
 */
export function setLinkedText(element: HTMLElement, value: string): void {
    element.textContent = "";
    linkedParts(value).forEach((part) => {
        if (part.href === undefined) {
            element.appendChild(document.createTextNode(part.text));
            return;
        }
        const link = document.createElement("a");
        link.href = part.href;
        link.textContent = part.text;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        element.appendChild(link);
    });
}

/**
 * A summary printed in its severity groups: a banner, then the lines under it.
 *
 * Returns one element holding the lot, so it drops into the same place the flat
 * list used to.
 *
 * `headingLevel` makes each banner a heading of that level, which is what lets a
 * reader jump between severities instead of walking the whole list. It has to be
 * given rather than assumed: this is drawn at three different depths, and a
 * heading at the wrong level is worse for someone navigating by headings than no
 * heading at all. Left out, the banner is a bold paragraph.
 */
export function createGroupedList(
    groups: SummaryGroup[], emptyText = "", headingLevel?: number
): HTMLElement {
    if (groups.length === 0) {
        const paragraphElem = document.createElement("p");
        paragraphElem.textContent = emptyText;
        return paragraphElem;
    }

    const container = document.createElement("div");
    groups.forEach((group) => {
        if (group.banner !== undefined) {
            if (headingLevel === undefined) {
                const banner = document.createElement("p");
                const strong = document.createElement("strong");
                strong.textContent = group.banner;
                banner.appendChild(strong);
                container.appendChild(banner);
            } else {
                const banner = document.createElement(`h${headingLevel}`);
                banner.textContent = group.banner;
                container.appendChild(banner);
            }
        }
        container.appendChild(
            createUnorderedList(group.comments.map((comment) => comment.text))
        );
    });
    return container;
}

/**
 * A two column table whose first cell in each row is a row heading.
 *
 * The label/value shape used by the scorecard and a use case's details. The
 * labels are `<th scope="row">` so a screen reader announces the field name
 * with the value, which is the same reason the report sets `w:tblLook`.
 */
export function createLabelValueTable(rows: Array<[string, string]>): HTMLTableElement {
    const table = document.createElement("table");
    rows.forEach(([label, value]) => {
        const row = table.insertRow(-1);
        const heading = document.createElement("th");
        heading.setAttribute("scope", "row");
        heading.textContent = label;
        row.appendChild(heading);
        row.insertCell(-1).textContent = value;
    });
    return table;
}

/** A table with column headings, each `<th scope="col">`. */
export function createDataTable(headers: string[], rows: string[][]): HTMLTableElement {
    const table = document.createElement("table");
    const headingRow = table.insertRow(-1);
    headers.forEach((header) => {
        const heading = document.createElement("th");
        heading.setAttribute("scope", "col");
        heading.textContent = header;
        headingRow.appendChild(heading);
    });
    rows.forEach((cells) => {
        const row = table.insertRow(-1);
        cells.forEach((cellText) => {
            row.insertCell(-1).textContent = cellText;
        });
    });
    return table;
}

/** Appends two <br> elements, matching the spacing used elsewhere in the forms. */
export function appendNewlines(div: HTMLElement): void {
    div.appendChild(document.createElement("br"));
    div.appendChild(document.createElement("br"));
}

/**
 * Expand/collapse handler for a disclosure button: an aria-expanded button
 * whose aria-controls names the region it shows and hides.
 */
export function toggleMenu(e: Event): void {
    const target = e.target as HTMLElement;
    const isExpanded = target.getAttribute('aria-expanded') === 'true';

    target.setAttribute('aria-expanded', String(!isExpanded));
    const controlsTargetId = target.getAttribute("aria-controls") as string;
    const controlsTarget = requireEl(controlsTargetId);
    controlsTarget.hidden = isExpanded;
}
