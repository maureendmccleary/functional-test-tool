# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev         # Vite dev server
npm test            # Vitest (run mode)
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit
npm run build       # typecheck, then build to dist/
npm run preview     # serve the built output
```

Node 20 (`.nvmrc`); CI runs lint, typecheck, and test on every push to `main`, then
builds and publishes `dist/` to GitHub Pages.

Single test file or single test:

```bash
npx vitest run tests/scoring.test.ts
npx vitest run -t "name of the test"
UPDATE_GOLDEN=1 npm test    # regenerate tests/golden/ after an intentional shape change
```

`UPDATE_GOLDEN=1` rewrites the golden files — always review the resulting diff, since
their whole purpose is to fail when the saved-file shape drifts.

## Architecture

[ARCHITECTURE.md](ARCHITECTURE.md) is the detailed reference (module layout, data model,
failure handling, build). The essentials:

- Vanilla TypeScript, no framework. `index.html` holds every view and `<dialog>`; the UI
  modules look elements up by id and update the DOM by hand. There is no rendering layer
  and no reactivity — after mutating state, re-render explicitly.
- **Layering is enforced by ESLint** (`no-restricted-imports` in `eslint.config.js`):
  `domain/` and `config/` must not import from `ui/`, `state/`, or `io/`. `domain/`
  imports only `types.ts` and is where testable logic belongs.
- `state/store.ts` is the only owner of mutable state, deliberately a plain mutable
  module. Everything mutates the evaluation in place.
- `domain/migration.ts` is the only place untrusted file contents become an `Evaluation`.
  Downstream code may assume the normalized shape. Add new legacy field spellings there,
  never in a view.

### Data model vocabulary

"Functional test" is the current term for what used to be a **use case**, so saved files
and many identifiers still carry `UC` (`evalUCs`, `performedUCs`, `selectUC`). Keep the
`UC` spellings where they are part of the file format or existing element ids; use
"functional test" in new code and prose.

Issues and scores live on a **run** (one per assistive-technology/OS pair), not on the
functional test, so one script can be performed against several ATs with separate results.

### Deliberate oddities — do not "fix" in passing

Each is documented at its definition; changing one is a behavior change needing its own
tested commit.

- `Issue.score` is a string, `TestRun.score` is a number. Not unifiable in place.
- `currentTestIndex` in the store is `string | number`; array indexing coerces.
- `ui/issue-dialog.ts` and `ui/perform-view.ts` import each other; the cycle is safe
  because both sides only call hoisted declarations at event time.
- `requireEl` throws, `findEl` returns null — pick the one matching what the original
  code did at that call site.
- Read `event.currentTarget` *before* the first `await`; file pickers clear it.

## Constraints worth knowing before changing things

- **File load/save is Chromium-only** (File System Access API). `isFilePickerSupported()`
  gates the controls; picker `AbortError` is a normal outcome, not a failure.
- `docx@8.5.0` is loaded from unpkg by a `<script>` tag in `index.html` with a
  subresource-integrity hash, and typed as `any` in `globals.d.ts`. Changing the version
  means recomputing the hash (command in ARCHITECTURE.md).
- `vite.config.ts` sets `base: './'` for the GitHub Pages sub-path; absolute asset URLs
  404 there.
- `font-awesome-4.7.0/` is intentionally outside `public/` so Vite processes its CSS.
- Generated step element ids (`step-contents[N]`, `step-label[N]` in `ui/step-ids.ts`)
  are a contract with `index.html` and with `querySelectorAll` prefix matches.

## Testing

Automated tests cover pure logic only, and use a hand-written DOM stub
(`tests/helpers/dom-stub.ts`), not jsdom. The view modules have no automated coverage —
`tests/SMOKE.md` is the manual checklist for dialog, focus, and file-picker behavior; run
it after changes in those areas.

Fixtures use the *older* field names on purpose, so loading them exercises the migration.

## Commits and Pull Requests
When we are discussing making new set of changes to the project, always create a new branch. This branch will target main in the repo.
Remember when we are working and ready to commit changes to Github, never include a link or content of the session.
Only include descriptions of the changes.
Never include links to our conversation.
When we are ready for a pull request, never add Co-Authored-By-Claude  annotations.
Only include descriptions of the changes.
Never include emojis.



