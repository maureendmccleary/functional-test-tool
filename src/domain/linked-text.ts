import { safeLinkUrl } from './safe-url.js';

/**
 * Finds the web addresses written into a script's prose.
 *
 * A script often tells the tester to go somewhere partway through a flow, with
 * the address written into the step. Testers were selecting it, copying it and
 * pasting it into the browser on every run, which costs time and mistypes.
 *
 * Nothing is added to the authoring format: the scripter writes the address in
 * the sentence as they already do, and it is recognised where it stands. Every
 * script that already exists gains its links without being touched.
 */

/** One piece of a step's text: prose, or an address to link. */
export interface TextPart {
    text: string;
    /** The address to follow, present only on a part that is a safe link. */
    href?: string;
}

/**
 * Candidate addresses. Only a written out scheme counts, which is what
 * safe-url.ts requires anyway: "catalogue.example.org/holds" is refused rather
 * than guessed at, since guessing is how a link ends up pointing somewhere
 * nobody meant.
 */
const ADDRESS = /https?:\/\/\S+/gi;

/** Punctuation that ends a sentence rather than an address. */
const SENTENCE_ENDINGS = '.,;:!?';

/** Quotes an address may be wrapped in but never ends with. */
const QUOTES = '"\'';

/** How many times `character` appears in `value`. */
function countOf(value: string, character: string): number {
    return [...value].filter((each) => each === character).length;
}

/**
 * The address without the punctuation that belongs to the sentence around it.
 *
 * "Go to https://example.org/holds." must not put the full stop in the address,
 * and "(see https://example.org/holds)" must not swallow the bracket. A closing
 * bracket is only dropped when nothing in the address opened it, because plenty
 * of real addresses carry balanced brackets of their own.
 */
function withoutTrailingPunctuation(candidate: string): string {
    let end = candidate.length;
    while (end > 0) {
        const character = candidate[end - 1];
        const kept = candidate.slice(0, end - 1);

        if (SENTENCE_ENDINGS.includes(character) || QUOTES.includes(character)) {
            end--;
            continue;
        }
        if (character === ')' && countOf(kept, ')') + 1 > countOf(kept, '(')) {
            end--;
            continue;
        }
        if (character === ']' && countOf(kept, ']') + 1 > countOf(kept, '[')) {
            end--;
            continue;
        }
        break;
    }
    return candidate.slice(0, end);
}

/**
 * Splits text into its prose and its links, in order.
 *
 * Always returns the whole text: a part with no `href` is prose, and text with
 * no address in it comes back as a single part. An address that safeLinkUrl
 * refuses stays prose too, so a `javascript:` URL in a saved file is shown as
 * the text it is rather than becoming something to activate.
 */
export function linkedParts(value: string): TextPart[] {
    const text = String(value ?? '');
    const parts: TextPart[] = [];
    let consumed = 0;

    for (const match of text.matchAll(ADDRESS)) {
        const address = withoutTrailingPunctuation(match[0]);
        const href = safeLinkUrl(address);
        if (href === '') {
            continue;
        }
        if (match.index > consumed) {
            parts.push({ text: text.slice(consumed, match.index) });
        }
        parts.push({ text: address, href });
        consumed = match.index + address.length;
    }

    if (consumed < text.length) {
        parts.push({ text: text.slice(consumed) });
    }
    return parts;
}

/** True when the text holds at least one address worth linking. */
export function hasLink(value: string): boolean {
    return linkedParts(value).some((part) => part.href !== undefined);
}
