/**
 * A minimal stand-in for the pieces of the DOM the dialog modules touch.
 *
 * Deliberately not jsdom: these tests assert behavior, not rendering, and a
 * hand-written stub makes it obvious exactly which DOM surface each module
 * depends on. Swapping in jsdom against the real index.html is a later step.
 */

export interface ElementStub {
    tagName: string;
    value: string;
    innerHTML: string;
    textContent: string;
    focused: boolean;
    children: ElementStub[];
    attributes: Map<string, string>;
    focus(): void;
    appendChild(child: ElementStub): ElementStub;
    removeChild(child: ElementStub): ElementStub;
    setAttribute(name: string, value: string): void;
    getAttribute(name: string): string | null;
    removeAttribute(name: string): void;
    readonly firstChild: ElementStub | null;
}

export function createElementStub(tagName = 'DIV'): ElementStub {
    const element: ElementStub = {
        tagName,
        value: '',
        innerHTML: '',
        textContent: '',
        focused: false,
        children: [],
        attributes: new Map<string, string>(),
        focus() {
            element.focused = true;
        },
        appendChild(child) {
            element.children.push(child);
            return child;
        },
        removeChild(child) {
            const index = element.children.indexOf(child);
            if (index !== -1) {
                element.children.splice(index, 1);
            }
            return child;
        },
        setAttribute(name, value) {
            element.attributes.set(name, value);
        },
        getAttribute(name) {
            return element.attributes.get(name) ?? null;
        },
        removeAttribute(name) {
            element.attributes.delete(name);
        },
        get firstChild() {
            return element.children.length > 0 ? element.children[0] : null;
        }
    };
    return element;
}

export interface DocumentStub {
    elements: Map<string, ElementStub>;
    getElementById(id: string): ElementStub | null;
    createElement(tagName: string): ElementStub;
}

/**
 * Installs a stub `document` global holding one element per id.
 *
 * Ids not listed resolve to null, matching the real getElementById, so code
 * paths that null-check behave the way they do in a browser.
 */
export function installDocumentStub(ids: string[]): DocumentStub {
    const elements = new Map(ids.map((id) => [id, createElementStub()]));
    const documentStub: DocumentStub = {
        elements,
        getElementById(id) {
            return elements.get(id) ?? null;
        },
        createElement(tagName) {
            return createElementStub(tagName);
        }
    };
    (globalThis as unknown as { document: unknown }).document = documentStub;
    return documentStub;
}

export function clearDocumentStub(): void {
    delete (globalThis as unknown as { document?: unknown }).document;
}
