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

A functional test is a script written for **one** assistive technology and carries exactly
one **run**, which is where its issues and score live. A script the author writes for three
technologies becomes three functional tests, sharing a `testNumber` and named
`01 Place a hold - NVDA` and so on. `splitByAssistiveTechnology` makes the copies, both when
the editor saves and when an older file is loaded.

A test also carries **extensions** -- deviations from the main success path, numbered from 1
within the test and referred to by that number in a step's own wording. They record issues
and score exactly as steps do, through the same positional pairing against the run
(`run.extensions[i]` belongs to `test.extensions[i]`). They are only ever appended, because
deleting one renumbers the rest and no code can follow that into a step's prose.

A run's `score` is `-1` until the tester picks one, and that is the only thing that marks it
performed: a run with no issues is otherwise indistinguishable from one nobody has opened.
Unperformed runs are left out of the scorecard. Do not write the score anywhere except the
Perform dialog's score control.

### Deliberate oddities — do not "fix" in passing

Each is documented at its definition; changing one is a behavior change needing its own
tested commit.

- `Issue.score` is a string, `TestRun.score` is a number. Not unifiable in place.
- `currentTestIndex` in the store is `string | number`; array indexing coerces.
- `ui/issue-dialog.ts` and `ui/perform-view.ts` import each other; the cycle is safe
  because both sides only call hoisted declarations at event time.
- An editor input's `name` attribute is the model property it writes. Naming one for a
  spelling only `domain/migration.ts` should know writes a field nothing reads.
- `requireEl` throws, `findEl` returns null — pick the one matching what the original
  code did at that call site.
- Read `event.currentTarget` *before* the first `await`; file pickers clear it.

## Constraints worth knowing before changing things

- **A saved evaluation file is untrusted input.** Never assign to `innerHTML`; ESLint
  refuses it. Text goes in with `textContent`, structure is built as elements, and a URL
  from a file goes through `safeLinkUrl` before it reaches an `href`.
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

## Branching

Every set of changes in this project must be done through a PR; no directly pushing to `main`.
PRs always land as merge commits: squash and rebase merging are disabled on the remote. That keeps a merged branch's commits reachable from `main`, which is what makes the merged check below reliable.
When discussing making a new set of changes, you should branch off of main to make those changes, unless instructed to branch off of a different branch.
Before doing any of this, you should `git fetch` and make sure the current local branch is `main` and that it is up to date with `origin/main`.
The cases where this is not true should be handled as follows:
- If the current branch is `main` and it is behind `origin/main`, you should pull those changes.
- If the current branch is not `main`, test whether it has already been merged with `git merge-base --is-ancestor <branch> origin/main`; exit code 0 means merged. Fetch first, and compare against `origin/main` rather than local `main`, which is often stale. If it is merged, delete it with `git branch -d <branch>` and branch off of `origin/main`.
- Branches merged before this policy took effect were squashed or rebased, so their commits are not ancestors of `main` and the check above reports them as unmerged. Confirm those with `gh pr list --head <branch> --state merged` before deleting, and use `git branch -D` since `-d` will refuse.
- If the current branch is not `main` and it has changes (either commits, unstaged changes, or otherwise) which have not been merged into `main` via a PR, you should stop and ask how to proceed. Usually the answer will either be to keep working off of that branch (not yet ready for a PR) or to make a PR with some of the existing changes from that branch and move some of the newer changes off into another branch. This last case is the main one where ambiguity emerges. You should try your best to reasonably determine what is wanted and ask the user if that's correct.

## Commits and PRs

Commit descriptions should be concise and not meander or over-explain. The longer explanations should be reserved for PR descriptions. A commit message that is too long is much worse than one that is too short. Try to keep it to one or two sentences.
Never add content to commits beyond descriptions of the changes. Don't add Co-Authored-By annotations, for example.
Keep commits logically grouped, try to keep them at a reasonable number of lines, and try to make them as easy as possible to review.

Judging when a branch has reached a reasonable point for a PR is your job, so keep track of it and say so when you think it has. Creating the PR is not. Never run `gh pr create` on your own initiative; ask whether the user wants one and wait for an answer, even when the branch is obviously ready.

Merging works the same way. Sometimes the user merges the PR themselves; more often they will have you open it, spend some time reviewing, and then tell you to merge it. Either is normal, but never merge until told to.

For PRs, don't add anything to the PR description other than a description of the changes. For example, don't add "Generated by Claude Code" and don't include a link to the session.
The remote branch is deleted automatically on merge, since `delete_branch_on_merge` is enabled on the repo. Once a PR is merged, whether the user merged it or you did at their request, delete the local branch and switch back to `main`.
If the PR addresses an issue, you should provide links to those issues in the PR description.
A distinction should be made between issues that are merely related to the PR, and ones that are actually closed by the PR: in the latter case you want to specifically use "Closes #XXX" but not in the former.

## Other general notes

Keep authored text under `src/` and `tests/` ASCII. No emojis, and no em-dashes or other typographic punctuation in comments, log and error messages, test names, or identifiers. This applies to the TypeScript and JavaScript there and to the JSON fixtures and golden files alongside them.

Prose documentation is exempt. `README.md`, `ARCHITECTURE.md`, and this file use em-dashes throughout and should stay that way.

Deliberate user-facing copy is the exception worth recognizing before "fixing" it. `src/ui/results-view.ts` prefixes report rows with a `"•"` bullet on purpose; that is output, not commentary.
