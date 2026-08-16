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
    selection-utils, functional-test, test-run, migration, scoring, summary
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
