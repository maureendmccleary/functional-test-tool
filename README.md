# functional-test-tool

Functional Accessibility Testing Tool — author functional tests, perform them
against a given assistive technology and operating system, record and score
issues, and export an evaluation report.

A script assigned several assistive technologies becomes one functional test per
technology, so no technology an evaluation covers is left untested.

## Writing summaries

Both written summaries — a test's **General Comments** and an assistive
technology's **Overall Comments** — are grouped by severity, and the report
prints them in that order so a reader meets the stoppers first. The grouping
comes from four banner lines:

```
Stoppers:
Major Issues:
Minor Issues
Advisory
```

**A comment's severity comes from the banner above it, not from anything you
write in the comment.** So reword a finding however you like and it stays where
it is. There is nothing to type but the comment itself.

The rules are:

1. A **banner alone on its line** opens a section. The colon is optional — type
   it or leave it off.
2. Everything below a banner keeps that severity **until the next banner**.
3. Put a **blank line between comments**. A single line break inside a comment
   keeps it as one comment.
4. Text **above the first banner** carries no severity. It prints first, ungrouped
   — which is what a note on what the testing covered should do.
5. To use a severity that is not there yet, type its banner line yourself.

### An example

**The summary builds itself as you record issues.** Every issue you log appears
under its category in the Summary beneath the score, straight away, and leaves
again if you delete it or mark its step out of scope. You do not have to ask for
it.

**Generate Summary** does the same thing on demand, which is what you want after
opening an older evaluation, or if you have deleted a line you now want back. It
**merges** rather than replacing, so it is always safe to press: your wording
stays, anything missing is added, and pressing it twice changes nothing the
second time.

It starts you with:

```
Stoppers:
The "Place hold" button has no accessible name.

Minor Issues
The result count is not announced.

The filter legend is not read.
```

You then add a scoping note, reword the stopper, add a second one, and decide the
last finding is only advisory:

```
Testing covered the desktop catalogue only; the mobile app was out of scope.

Stoppers:
The "Place hold" button is announced only as "button", so a screen reader user
cannot tell what it does.

Focus is lost when the confirmation dialog closes.

Minor Issues
The result count is not announced.

Advisory:
The filter legend could be worded more plainly.
```

Save and reopen, and it comes back as you left it: the reworded stopper is still
a stopper, the two-line comment is still one comment, both lines under
`Stoppers:` are stoppers — the blank line separates comments, it does not end the
section — and `Advisory:` is written back as `Advisory`.

### Overall Comments

The format is the same. **Generate Overall Comments** fills the box with
everything that technology ran into across the whole evaluation, grouped by
severity, and pressing it again **merges** rather than appending: nothing
duplicates, your edits survive, and a line you typed under no banner takes the
severity of the issue it matches.

### Opening an evaluation saved before this existed

Older files stored summaries as plain text with no severities, and nothing in
them records which banner a line was written under, so they load **unclassified**
— printed above the banners rather than grouped. Nothing is guessed and nothing
is lost; the issues themselves still carry their scores.

To group one, open the summary and press **Generate Summary** (or **Generate
Overall Comments**). A line matching an issue takes that issue's severity, a note
you wrote yourself matches nothing and stays where it is, and anything not yet
mentioned is added under its banner.

A summary that was never written at all needs nothing: the tool falls back to the
most severe issues, computed from the scores, and those come out grouped already.

### Worth knowing

- A line you delete from the summary while its issue is still recorded comes
  back the next time any issue changes, because the summary follows the issues.
  Delete the issue itself to be rid of it.
- Deleting a banner does not delete its comments. They fall into whichever
  section is above them, or become unclassified if there is none.
- Moving a comment to another severity is cut and paste.
- A banner word inside a sentence is safe: "Advisory only: the icon could be
  larger" stays whole.

## Development

Requires Node 20 LTS (18.13+ works; the CI runs 20).

```bash
npm install
npm run dev         # Vite dev server
npm test            # Vitest
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit
npm run build       # type-check, then build to dist/
npm run preview     # serve the built output
```

`npm run build` is what CI deploys to GitHub Pages. It sets `base: './'` so
assets resolve from a project sub-path — see `vite.config.ts` for why.

Evaluation files are read and written with the File System Access API, so
**loading and saving only work in Chromium** (Chrome, Edge). Other browsers are
told so rather than failing silently; everything else works anywhere.

## Layout

```
src/
  main.ts          entry point and top-level wiring
  types.ts         the evaluation data model
  config/          score lists and AT/OS catalogues
  state/           the single owner of mutable app state
  domain/          pure logic: migration, scoring, summary text. No DOM.
  io/              file pickers and .docx report generation
  ui/              one module per view or dialog, plus DOM primitives
```

Dependencies run one way: `ui/` → `domain/`, `state/`, `io/`, `config/`, and
never the reverse. `domain/` imports nothing but `types.ts`.

## Testing

`npm test` covers the pure logic and includes golden load/save round trips that
fail if the on-disk shape of an evaluation file changes.

`tests/SMOKE.md` is a manual checklist for the dialog and focus behavior the
automated tests do not reach. Run it before releasing.

## Deployment

Pushing to `main` runs lint, type check, and tests, then builds and publishes
`dist/` to GitHub Pages — see `.github/workflows/deploy.yml`.

## License

Not licensed for redistribution. `package.json` declares `UNLICENSED` and no
licence is granted; ask before reusing this code.

## Architecture

[ARCHITECTURE.md](ARCHITECTURE.md) covers the module layout and the dependency
rule, the data model, how failures and the build are handled, and what is worth
doing next.
