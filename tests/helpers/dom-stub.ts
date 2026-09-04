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
    open: boolean;
    children: ElementStub[];
    attributes: Map<string, string>;
    classList: {
        add(...tokens: string[]): void;
        remove(...tokens: string[]): void;
        contains(token: string): boolean;
    };
    focus(): void;
    showModal(): void;
    close(): void;
    addEventListener(type: string, listener: EventListener): void;
    dispatchEvent(event: Event): boolean;
    appendChild(child: ElementStub): ElementStub;
    removeChild(child: ElementStub): ElementStub;
    setAttribute(name: string, value: string): void;
    getAttribute(name: string): string | null;
    removeAttribute(name: string): void;
    /**
     * Answers with nothing. The elements these queries look for are the ones a
     * view generates -- a step's Add Issue button and the like -- and none of
     * them is modelled here, so a walk over the result is a walk over nothing.
     */
    querySelectorAll(selector: string): ElementStub[];
    readonly firstChild: ElementStub | null;
}

export function createElementStub(tagName = 'DIV'): ElementStub {
    const classes = new Set<string>();
    const listeners = new Map<string, EventListener[]>();
    const element: ElementStub = {
        tagName,
        value: '',
        innerHTML: '',
        textContent: '',
        focused: false,
        open: false,
        children: [],
        attributes: new Map<string, string>(),
        classList: {
            add(...tokens) {
                tokens.forEach((token) => classes.add(token));
            },
            remove(...tokens) {
                tokens.forEach((token) => classes.delete(token));
            },
            contains(token) {
                return classes.has(token);
            }
        },
        focus() {
            element.focused = true;
        },
        showModal() {
            element.open = true;
        },
        close() {
            element.open = false;
        },
        addEventListener(type, listener) {
            const registered = listeners.get(type) || [];
            if (!registered.includes(listener)) {
                registered.push(listener);
            }
            listeners.set(type, registered);
        },
        dispatchEvent(event) {
            (listeners.get(event.type) || []).forEach((listener) => {
                listener.call(element as unknown as EventTarget, event);
            });
            return true;
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
        querySelectorAll() {
            return [];
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
    createElementNS(namespace: string, tagName: string): ElementStub;
    querySelector(selector: string): ElementStub | null;
}

/**
 * Answers only the queries the modules actually make, by id or by the one
 * class the status regions carry. Dialogs are not modelled, so a query for an
 * open one is answered with null -- which is the page's own state in these
 * tests, and the branch the code then takes.
 */
function matchSelector(elements: Map<string, ElementStub>, selector: string): ElementStub | null {
    if (selector.startsWith('#')) {
        return elements.get(selector.slice(1)) ?? null;
    }
    if (selector === '.app-status') {
        return elements.get('app-status') ?? null;
    }
    return null;
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
        },
        createElementNS(_namespace, tagName) {
            return createElementStub(tagName);
        },
        querySelector(selector) {
            return matchSelector(elements, selector);
        }
    };
    (globalThis as unknown as { document: unknown }).document = documentStub;
    return documentStub;
}

export function clearDocumentStub(): void {
    delete (globalThis as unknown as { document?: unknown }).document;
}
