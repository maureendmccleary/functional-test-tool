/**
 * Guards the one place a value from a saved file becomes a link.
 *
 * A functional test's start location is written into an anchor's href. An href
 * accepts more than web addresses: `javascript:` and `data:` URLs run as script
 * when the link is followed, so a saved file could carry code that executes on
 * a click. Evaluation files are passed between testers, which makes them
 * untrusted input like any other.
 */

/** Schemes a link in this app may use. Everything else is refused. */
const SAFE_SCHEMES = ['http:', 'https:'];

/**
 * The address if it is safe to follow, otherwise an empty string.
 *
 * Requires an absolute address: a bare "example.org/page" has no scheme to
 * check, so it is refused and shown as plain text rather than guessed at.
 */
export function safeLinkUrl(value: unknown): string {
    const address = String(value ?? '').trim();
    if (address === '') {
        return '';
    }

    let parsed: URL;
    try {
        parsed = new URL(address);
    } catch {
        return '';
    }
    return SAFE_SCHEMES.includes(parsed.protocol) ? address : '';
}
