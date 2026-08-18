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
    evaluation-view, editor-view, perform-view, issue-dialog,
    summary-dialog, results-view, eval-results-view
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

## Data model

An **Evaluation** holds **functional tests** — previously called *use cases*,
which is why saved files and some identifiers still carry `UC`. Each functional
test carries the authoring script — its steps and their instructions — plus a
list of **runs**, one per (assistive technology, operating system) pair it has
been run against. Issues and scores live on the run, not the functional test, so
the same script can be run against several assistive technologies and keep
separate results.

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
file and saving it quietly upgrades it.

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

Two consequences worth knowing:

- The scorecard counts **runs**, not functional tests, so three scripts
  performed against three ATs give a total of nine.
- A run's reported score is derived from its issues, not read from `run.score`.
  That field is only written while the perform dialog is open, so it is stale in
  any file whose issues were edited afterwards.

The table of contents is written out from the evaluation, not left to a Word
`TableOfContents` field. A field would carry page numbers, but only after Word
is asked to update fields when the document opens, and that prompt is worse than
the missing page numbers. The entries are ordinary internal hyperlinks pointing
at bookmarks on the assistive technology and use case headings, so they work as
soon as the file opens. **The document contains no fields at all** -- adding one
anywhere brings the prompt back.

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
