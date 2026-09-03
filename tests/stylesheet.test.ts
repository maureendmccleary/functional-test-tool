import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

/**
 * Rules in styles.css that other code depends on being there.
 *
 * The view modules have no automated coverage, so a stylesheet rule that a
 * behavior relies on has nothing to catch its removal. These are the ones whose
 * loss is silent: the page still renders, and something else stops working.
 */

const stylesheet = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

/**
 * The body of a rule, by its selector, with whitespace collapsed.
 *
 * Anchored to the start of a line, because the comments in this sheet quote the
 * very selectors being looked for. Unanchored, this read the prose above the
 * rule instead of the rule.
 */
function ruleBody(selector: string): string {
    const pattern = new RegExp(
        `^${selector.replace(/[[\]]/g, '\\$&')}\\s*\\{([^}]*)\\}`, 'm'
    );
    const match = pattern.exec(stylesheet);
    return match ? match[1].replace(/\s+/g, ' ').trim() : '';
}

describe('the hidden attribute', () => {
    /*
     * A browser hides [hidden] from its own stylesheet, which any author rule
     * beats. #test-edit-at-menu sets display: grid, so without this rule the
     * assistive technology list stayed on screen whatever the disclosure button
     * said: never collapsed, thirty checkboxes stuck in the tab order, and an
     * aria-expanded of "false" over content that was plainly visible.
     */
    test('is hidden by the stylesheet, not left to the browser', () => {
        expect(ruleBody('[hidden]')).toMatch(/display:\s*none/);
    });

    test('wins over the display rules that would otherwise beat it', () => {
        // Without !important the rule loses to any id selector, which is what
        // #test-edit-at-menu is.
        expect(ruleBody('[hidden]')).toMatch(/display:\s*none\s*!important/);
    });

    test('the menu that needs it still sets a display of its own', () => {
        // If this ever stops being true the rule above is still correct, but
        // the reason recorded beside it is no longer the live one.
        expect(ruleBody('#test-edit-at-menu')).toMatch(/display:\s*grid/);
    });
});

describe('dialog close controls', () => {
    test('use the danger fill at rest', () => {
        expect(ruleBody('.dialog-close')).toMatch(/background-color:\s*var\(--danger\)/);
        expect(ruleBody('.dialog-close')).toMatch(/border-color:\s*var\(--danger\)/);
        expect(ruleBody('.dialog-close')).toMatch(/color:\s*#ffffff/);
    });

    test('use the darker danger fill on hover', () => {
        expect(ruleBody('.dialog-close:hover'))
            .toMatch(/background-color:\s*var\(--danger-hover\)/);
        expect(ruleBody('.dialog-close:hover'))
            .toMatch(/border-color:\s*var\(--danger-hover\)/);
    });
});
