/**
 * The names the app offers when it hands a file to the tester.
 *
 * Both names carry the evaluation's own name, so a second evaluation's files do
 * not land beside the first's as copies of it. That name comes out of a saved
 * file, so nothing here trusts it: see scrubName.
 *
 * Kept apart from report-format.ts, which is the wording *inside* the report.
 * One of these two names is for the saved evaluation, which is not a report at
 * all.
 */

/** What the report is called when the evaluation has no name to add. */
const REPORT_FILE_STEM = 'evaluation-results';

/** What a saved evaluation is called when it has no name of its own yet. */
const EVALUATION_FILE_STEM = 'evaluation';

/**
 * Characters a file name cannot carry on Windows, and the two path separators.
 *
 * A separator is the one that matters: a name holding "../" must not be able to
 * steer a download anywhere. Browsers flatten a download name themselves, but
 * this does not depend on that.
 */
const ILLEGAL_FILE_NAME_CHARACTERS = '<>:"/\\|?*';

/** How much of the evaluation name a file name carries. */
const MAX_NAME_LENGTH = 120;

/**
 * The evaluation's name, reduced to something a file system will take.
 *
 * Anything a file name cannot carry becomes a space and runs of whitespace
 * collapse, so a name holding a path separator cannot steer the file anywhere.
 * It is then cut to MAX_NAME_LENGTH, which keeps the whole name well inside the
 * 255 bytes file systems allow, and the cut end is tidied: Windows drops a
 * trailing dot or space, which would rename the deliverable behind the tester's
 * back, and a trailing dot would read as "Audit..docx" in any case.
 *
 * Nothing is done about a leading dot. Both names below either put a stem in
 * front of the name or fall back to one, and a file called ".hidden.json" is
 * the tester's own choice of name rather than something this introduced.
 *
 * @returns the usable name, or an empty string when nothing usable is left
 */
function scrubName(evaluationName: string | undefined): string {
    const scrubbed = [...String(evaluationName ?? '')]
        .map((character) => (
            character < ' ' || character === '\u007f'
                || ILLEGAL_FILE_NAME_CHARACTERS.includes(character)
                ? ' '
                : character
        ))
        .join('')
        .replace(/\s+/g, ' ')
        .trim();
    return scrubbed.slice(0, MAX_NAME_LENGTH).replace(/[. ]+$/, '').trim();
}

/**
 * The name the report downloads as.
 *
 * Every report used to arrive as "evaluation-results.docx", so a second one
 * landed beside the first as a copy and neither said which engagement it was
 * for. The evaluation name is appended where there is one; where there is not
 * -- files written before the cover fields existed, or simply not filled in --
 * the stem is used on its own rather than leaving a dangling separator.
 */
export function reportFileName(evaluationName: string | undefined): string {
    const name = scrubName(evaluationName);
    return name === ''
        ? `${REPORT_FILE_STEM}.docx`
        : `${REPORT_FILE_STEM} - ${name}.docx`;
}

/**
 * The name the save dialog opens on the first time an evaluation is saved.
 *
 * The evaluation's own name, since that is what the tester would type. Only a
 * suggestion: they can change it, and it is offered once, because saving again
 * writes straight to the file they chose.
 */
export function evaluationFileName(evaluationName: string | undefined): string {
    const name = scrubName(evaluationName);
    return `${name === '' ? EVALUATION_FILE_STEM : name}.json`;
}
