# Architecture

## Layout

```
src/
  main.ts            entry point; wires the controls that exist in index.html
  types.ts           the evaluation data model
  globals.d.ts       ambient declarations for browser APIs and the docx CDN global
  config/
    defaults.ts      score lists and the AT / OS catalogues
  state/
    store.ts         the single owner of mutable application state
  domain/            pure logic, no DOM, directly unit-testable
    selection-utils, functional-test, test-run, migration, scoring, summary,
    evaluation (evaluation-wide queries), report-format (report wording)
  io/
    file-picker.ts   File System Access API wrappers
    docx-report.ts   builds and downloads the .docx report
  ui/
    dom, step-ids, status, controls        primitives
    screens.ts       shows one of the three screens and moves focus to it
    evaluation-view, evaluation-editor-view, editor-view, perform-view,
    issue-dialog, summary-dialog, results-view, eval-results-view
```

**Dependencies run one way:** `ui/` → `domain/`, `state/`, `io/`, `config/`, and
never the reverse. `domain/` imports nothing but `types.ts`. Nothing outside
`state/` holds application state.

The rule is enforced, not just documented: `eslint.config.js` restricts imports
of `**/ui/*`, `**/state/*`, and `**/io/*` from `src/**`, and lifts that
restriction only for `src/ui/`, `src/io/`, and `src/main.ts`. `npm run lint`
fails on a violation.

`ui/issue-dialog.ts` and `ui/perform-view.ts` import each other — perform-view
builds the buttons that open the dialog, and the dialog refreshes them when it
closes. The cycle is fine: both sides only call hoisted function declarations,
at event time.

## Screens

Three screens live in `index.html` at once, and `ui/screens.ts` shows one at a
time by toggling the `inactive` class. It also moves focus to the new screen's
heading, which carries `tabindex="-1"`: hiding the element focus was on drops
focus to the document and leaves a screen reader user with no idea anything
changed.

- **Landing** — load or save the evaluation file, view the results, start or
  edit an evaluation, and choose a functional test to Edit or Perform. This is
  the tester's screen. It shows the evaluation's workspace, asset and name as
  read-only text: the tester needs to know which evaluation is open without
  going to the screen where those are edited. `populateEvaluationDetails` fills
  both the text and the fields, so every route that changes them calls the one
  function.
- **Evaluation** — the evaluation's own details (workspace, asset, name) and its
  list of functional tests, with Add Test, Edit and Delete. This is where an
  evaluation is put together. Edit is there because the copies made for each
  assistive technology start identical and often should not stay that way:
  driving a screen reader through a task reads differently from driving speech
  recognition through it, so a copy gets instructions of its own here.
- **Functional test editor** — one script: its metadata, its assistive
  technologies, and its steps.

Both the evaluation screen and the editor have a Back. Nothing on either is held
back until Save — the evaluation is changed in place as it is edited — so Back
differs from Save only in not announcing that the evaluation is ready to
perform. Leaving a screen should not require claiming to be finished with it.

The editor's Back returns to whichever screen opened it, and drops a script that
was never saved: it has no assistive technology, so it has no place in the
evaluation and would otherwise sit in every list as a nameless entry.

## Data model

An **Evaluation** holds **functional tests** — previously called *use cases*,
which is why saved files and some identifiers still carry `UC`. Each functional
test is a script written for **one assistive technology**, and carries exactly
one **run** holding the issues and score recorded against it.

A script the author writes for three assistive technologies therefore becomes
three functional tests. `addAssistiveTechnologyCopies` does that when the editor
saves, and `splitByAssistiveTechnology` — the same function — does it to older
files on load. The copies share the script's `testNumber`, which is what makes
them recognisable as the same script performed three ways; `formatUseCaseName`
composes the name the tester sees from the number, the name and the technology,
as in `01 Place a hold - NVDA`.

A functional test also carries **extensions**: deviations from the main success
path, holding what a step needs to refer to — credentials to sign in with, an
error condition to trigger. They are numbered from 1 within the test, which is
the number a step's own wording points at ("Login credentials are located in
extension 1"), and they store no link back to that step. Nothing has to be kept
in sync when steps move, and nothing can dangle.

Extensions record issues exactly as steps do, through the same positional
pairing: `run.extensions[i]` belongs to `test.extensions[i]`, kept in step by
`ensureTestRunShape`. Their issues count towards the score like any other, so a
stopper found in an extension takes the use case to 1. **Deleting an extension
renumbers the ones after it**, which no code can follow into the prose of a step
that mentions them, so the editor warns before doing it and only ever appends
new ones.

The operating system belongs to the script the same way the assistive
technology does, so one script performed with NVDA on Windows and another with
VoiceOver on macOS keep separate results. Saving a script brings its run's
operating system into line with it — otherwise editing the field would never
reach the report, which reads it from the run. A run that has already been
performed keeps the operating system it was performed under: that is a record
of the conditions of the test, not a field to be rewritten afterwards.

`testNumber` is assigned once and never reassigned. Deleting a copy leaves a gap
in the numbering on purpose: the number is part of a name that may already have
been reported on, and renumbering would silently rename other scripts.

A run's `score` is `-1` until the tester picks one, and that is the only signal
that the run was performed. A run carries no issues both when the script passed
cleanly and when nobody has opened it yet, so without it an evaluation that had
been written but not performed would report every script as a 5. Nothing else
writes the score: `isPerformed` reads it, `buildScorecard` skips runs that fail
it, and `runScore` returns `-1` for them so the detailed section says
"Not rated".

The evaluation also carries what the report cover needs — `workspace` (the
company the work is for), `asset` (the thing under evaluation) and `name` — plus
one **assistive technology summary** per AT in use. That summary holds an
`overallRating` and a list of `significantIssues`, both assigned by the tester
after performing the whole evaluation with that AT. Neither is derived from the
runs: the report's overall rating is the mean of these per-AT ratings, and it
does not have to agree with the average or the minimum of the run scores.

`normalizeEvaluation` adds an empty summary for every AT the evaluation refers
to, and keeps stored summaries whose AT is no longer assigned to any test, so
briefly unassigning an AT does not discard the text written against it.

Files saved by earlier versions used different field names (`evalUCs`,
`performedUCs`, `ats`, `oses`, `startlocation`). `domain/migration.ts` accepts
both spellings on load and always writes the current ones, so opening an old
file and saving it quietly upgrades it. Old spellings belong in that module and
nowhere else: the editor's inputs are named for the properties they write, and
naming them for the old spellings — which they once were — wrote fields nothing
reads, losing the edit the next time the editor opened.

`domain/migration.ts` is the only place untrusted file contents become an
`Evaluation`. Everything downstream can assume the normalized shape.

## Failure handling

The File System Access API is Chromium-only and both pickers reject with an
`AbortError` when the user dismisses the dialog. `ui/evaluation-view.ts` treats
that as a normal outcome, reports unreadable files and write failures in the
status region belonging to whichever control was used, and checks
`isFilePickerSupported()` before offering the action at all — a large share of
screen reader users work in Firefox, where these APIs do not exist.

`event.currentTarget` is read *before* the first `await`. Once a picker opens,
dispatch has finished and the browser has cleared it to null.

The report library is loaded from a CDN, so `io/docx-report.ts` checks it is
present and reports build and packing failures rather than leaving
"Generating report, please wait..." on screen.

## The report

`io/docx-report.ts` follows the structure of the platform export it replaces: a
cover, a table of contents, a scorecard, the significant issues per assistive
technology, the scoring key, then the detailed results. The detailed section is
grouped **by assistive technology first**, then by functional test, which is why
`domain/evaluation.ts` exists — the grouping and the scorecard are questions no
single test or run can answer.

Three consequences worth knowing:

- The scorecard counts **performed runs**, so a script written for three ATs
  contributes nothing until each of the three has been scored, and three scripts
  performed against three ATs give a total of nine.
- A run's reported score is derived from its issues, not read from `run.score`.
  That field records only *whether* a score was picked; its value goes stale in
  any file whose issues were edited afterwards.
- Use case numbers come from `testNumber`, not from position, so a script is
  "03" under every AT it was performed with even where it is the first one
  listed, and stays "03" after an earlier script is deleted.

The two scores in the detailed section use **different rules on purpose**.
`runScore` is the most severe issue in the run, or 5 when there are none and the
run has been performed. `stepScore` is the mean of that
step's issue scores, rounded down. So a step holding one stopper among minor
issues reads as a 2 while the run it belongs to still reads as a 1. That is the
reporting rule this export has always used; unifying them would be a scoring
change, not a cleanup.

The table of contents is written out from the evaluation, not left to a Word
`TableOfContents` field. A field would carry page numbers, but only after Word
is asked to update fields when the document opens, and that prompt is worse than
the missing page numbers. The entries are ordinary internal hyperlinks pointing
at bookmarks on the assistive technology and use case headings, so they work as
soon as the file opens. **The document contains no fields at all** -- adding one
anywhere brings the prompt back.

Each use case carries two tables, deliberately not one, under the headings
"Overall Information" and "Main Success Case", plus a third headed "Extensions"
when it has any. The first is its metadata, where
the field names are **row** headings; the second is the steps, where "Main
Success Case" and "Issues Encountered" are **column** headings. Merged, a screen
reader reads the metadata with the step table's column headings attached to it.

**The heading between them is what keeps them apart.** Word renders two `<w:tbl>`
elements with no block-level content between them as a single table, so pushing
the two tables back to back merged them however separate they looked in the
source. Anything block-level between them will do; the headings are there
anyway, so they do the job.

OOXML has no per-cell equivalent of `<th>`, so headings are recorded two ways:
`w:tblHeader` marks a repeating header row, and `w:tblLook` records which of the
first row and first column are headings -- the "Header Row" and "First Column"
checkboxes in Word's Table Design tab, and what a screen reader reads to work
out a cell's headings. `docx@8.5.0` has no API for `w:tblLook`, so
`applyTableLook` pushes the element into the table properties itself. That is
only safe because the library version is pinned by the subresource integrity
hash in `index.html`, so the internals cannot shift without a deliberate version
bump -- **if you bump `docx`, check that `Table.root[0]` is still the
`w:tblPr` element.**

The score key's colours live in `domain/report-format.ts` rather than beside the
document builder, so `tests/contrast.test.ts` can assert them without loading
the docx library. Two rules are enforced there. Text on any fill the report sets
itself clears 4.5:1, and the achieved row is **bold as well as filled**: the pale
and strong fills of one score differ by as little as 1.29:1, far below the 3:1
that would let a fill carry the meaning alone, so the bold is what makes the row
findable rather than decoration.

Which row the key marks is settled by `scoreKeyRows`, not in the document
builder, for the same reason: it is a question about the data, and a test can
ask it. A score outside 1..5 marks nothing, which is what an unperformed run
gets.

Text is given an explicit colour **only** where the report sets a background.
Word's "auto" adapts text to the reader's theme, which is right for ordinary
paragraphs and wrong on a cell whose fill is a fixed pale colour: a dark theme
can turn the text pale too, leaving pale on pale. Unshaded text stays on "auto".

`ui/eval-results-view.ts` renders the results dialog section for section
against the report, reading its wording from `domain/report-format.ts` and
grouping runs with the same `groupRunsByAssistiveTechnology`. Changing one
without the other is what the two are arranged to prevent, so add new sections
to both.

One loose end from that alignment: `Evaluation.comments`, written by the "View
Overall Comments" dialog, is no longer displayed anywhere. Significant Issues
now shows the per-AT ratings and issues instead, per the AMP layout. The control
still stores its text, so nothing is lost, but it has no reader.

The report says "use case" where the rest of the codebase says functional test.
That is deliberate: the wording is output, matching the platform export the
report is modelled on, and it is not commentary to be brought in line with the
source. It lives in `domain/report-format.ts` and the section headings in
`io/docx-report.ts`.

## Build and deploy

Vite, with **`base: './'`**. The app is served from a project sub-path on GitHub
Pages, where Vite's default base of `/` emits absolute asset URLs that 404.
Relative URLs work there, on and under `vite preview` alike.

Font Awesome is deliberately *not* in `public/`. Letting Vite process its CSS
rewrites the `../fonts/` URLs to hashed assets, which fingerprints the fonts and
keeps every reference relative.

`docx@8.5.0` is loaded from unpkg by a `<script>` tag in `index.html`, so it is
a runtime network dependency and is typed as `any` in `globals.d.ts`. The tag
carries a subresource integrity hash: if the CDN ever serves different bytes for
that version, the browser refuses to run it. **Changing the pinned version means
recomputing the hash:**

```bash
curl -sL https://unpkg.com/docx@<version>/build/index.umd.js \
  | openssl dgst -sha384 -binary | openssl base64 -A
```

Bundling the library with `npm i docx` would retire both the network dependency
and the hash.

## Testing

`npm test` covers the pure logic. The golden round trips in
`tests/golden-roundtrip.test.ts` assert the exact bytes a save produces for a
given input, key order included — they fail if the in-memory shape of an
evaluation drifts.

The view modules have no automated coverage; `tests/SMOKE.md` is the manual
checklist for the dialog, focus, and file-picker behavior.

## Worth doing next

- **Bundle `docx`** — `npm i docx@8.5.0` and a real import, replacing the CDN
  script. Removes the network dependency and retires the `any`.
- **jsdom tests** for the view modules against the real `index.html`, replacing
  parts of `tests/SMOKE.md`.
- **`noUncheckedIndexedAccess`** — expect noise from the pervasive array
  indexing, so give it its own change.
- **`textContent` instead of `innerHTML`** for user-supplied text.
- **Bundle the assistive-technology catalogue with the OS catalogue.**
  `config/defaults.ts` still carries an `os-types` list nothing reads. The
  operating system is already a write-in field, so decide whether that list has
  a use or should be retired.
