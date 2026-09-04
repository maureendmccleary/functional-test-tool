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
- **Perform** — one run of one script: every step, every extension, an issue
  list and Add Issue button per step, the score and the summary.

Perform was a modal dialog, and Add Issue, View Results and View Summary all
open from it, which made those nested modals. Nesting cost real bugs: a message
went to the live region of whichever dialog was underneath, which the modal on
top had made inert and no reader could reach, and the dialog re-announced its
title and contents whenever focus moved inside it. As a screen it leaves each of
those three as the only modal, opened over a screen, which is the ordinary case.
It is also what a screen is for: a dialog is an interruption to dismiss, and
performing a test is where a tester spends most of their time.

**The page is named for what is on it.** `showScreen` sets `document.title` to
the screen, and every dialog sets it on opening and hands it back on closing,
wired once in `main.ts` from the `close` event so it does not matter what closed
it. The title is the one thing a screen reader will read on request whatever
focus is doing, and nothing else tells a tester which of four screens they are
looking at. The issue dialog's is the step it was opened on, so "Add Issue Step
3" and "View Issue Step 3" are distinguishable.

**Showing a screen clears the status paragraphs.** A message belongs to the
moment it was raised; left on a screen it is read out again as stale news the
next time that screen appears, which is what returning from Perform to the
landing screen did with the load confirmation.

Escape does not leave a screen. None of the others offer it either, and Back is
the way out; a document level Escape handler would have to know whether a dialog
above it had already claimed the key.

Both the evaluation screen and the editor have a Back. Nothing on either is held
back until Save — the evaluation is changed in place as it is edited — so Back
differs from Save only in not announcing that the evaluation is ready to
perform. Leaving a screen should not require claiming to be finished with it.

The editor's Back returns to whichever screen opened it, and drops a script that
was never saved: it has no assistive technology, so it has no place in the
evaluation and would otherwise sit in every list as a nameless entry.

### Links in a script's prose

A step often tells the tester to go somewhere, with the address written into the
instructions. `domain/linked-text.ts` finds those addresses so the tester can
follow them instead of copying and pasting, and every script that already exists
gains its links without being rewritten, since the addresses are already there.

Nothing was added to the authoring format. A written out `http://` or `https://`
is recognised where it stands; an address with no scheme is left as prose rather
than guessed at, which is what `safe-url.ts` requires anyway. Punctuation that
belongs to the sentence is not taken into the address: a full stop ends the
sentence, and a closing bracket is only dropped when nothing in the address
opened it, since real addresses carry balanced brackets of their own.

Every address goes through `safeLinkUrl`, the same guard the start location
uses, so only `http:` and `https:` can be followed and a `javascript:` URL in a
saved file stays the text it is. The parts are built as elements — `innerHTML`
is refused throughout this app, and instructions come out of an untrusted file.
Links open in a new tab: performing a test in the same one would take the tool
away mid-run and lose the results recorded so far.

`ui/controls.ts` renders them for the four places instructions are displayed,
and `io/docx-report.ts` writes real Word hyperlinks into the report, so a reader
following up a finding can reach the page from the deliverable.

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

A step or an extension can be marked **out of scope** for the run, which is
what the tester does with a step the scripter wrote but nobody is meant to
perform — signing in to the site being the common one. The mark belongs to the
run rather than to the script, since the same script can have a step tested
under one assistive technology and skipped under another, and it lives on the
run's record as `outOfScope`. A marked record reads as "Out of scope" wherever
its issues would be listed and prints `N/A` in place of a score, and its issues
are dropped in `issuesMap` — the one place every total in the tool is built
from — so a step nobody performed cannot contribute a finding to the run's
score, the scorecard, the problem summary or the significant issues. Issues
already recorded against it are kept in the file and still reachable through
View Issues; they simply stop being reported. The flag is absent rather than
`false` on a record nobody has marked, which is what a file written before it
existed looks like, and `setOutOfScope` and the migration both hold that rule.

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

Assistive technologies come from the catalogue in `config/defaults.ts`, which
holds **one entry per technology, not per technology and platform**. The
scripter records the operating system on the test, so a single "VoiceOver"
covers macOS, iOS, iPadOS, watchOS and tvOS, and a single "Switch Control"
covers Apple's and Android's. A platform stays in an entry's name only where the
technology exists on that platform alone, as with Windows Narrator. Expanding the group moves focus into the list, because from the button neither
the arrows nor first letter navigation have anything to act on and the group
reads as unresponsive. It lands on the technology already assigned, falling back
to the first entry when none is. The list is alphabetical because the group
is navigated by first letter, and that group handles Up, Down, Home and End
itself: moving focus into it puts a screen
reader in focus mode, where the reader stops browsing the page and hands arrow
keys to the control, so without them the list cannot be walked at all. It
records no versions: testing is always done with the current release, so a
pinned version would only go stale.

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

### Written summaries and their severities

A written summary — the run's `comments` and the AT summary's
`significantIssues` — is a list of `SummaryComment`, each a line of text with
the `severity` it was written under. Both are generated from the issues, grouped
under the four banners `Stoppers:`, `Major Issues:`, `Minor Issues` and
`Advisory`, and the tester then rewrites them freely.

**A line's severity comes from where it sits, not from what it says.** The
banners stay in the box as ordinary lines of text, and `parseSummaryComments`
reads them: a line that is *exactly* a banner opens a section, and the
paragraphs below it carry that severity until the next one. So a tester can
reword a finding however they like and it stays a stopper, without ever typing a
severity. `buildSummaryTextFromComments` writes the box back out the same way,
so generate → edit → save → reopen is stable.

Matching a whole line matters. The banners used to be *stripped* with an
unanchored pattern, which ate the tester's own words wherever those phrases
appeared: "Advisory only: the icon could be larger" came back as "only: the icon
could be larger".

A line under no banner keeps **no** severity. That is a scoping note typed at
the top of the box, and it is every line of a file written before severities
were stored, since nothing in such a file says what the tester had grouped them
under. Those lines are kept and printed first, ahead of the banners, in the
results dialog, the evaluation results screen and the report alike
(`groupSummaryComments`). Printing them last would file them under whichever
banner came last, which is a severity nobody chose.

Generating into a box that already has text **merges** rather than appends, so
pressing Generate twice adds nothing the second time and a line the tester typed
unclassified picks up the severity of the issue it matches.

The run's summary is kept in step with its issues without being asked.
`summaryWithCurrentIssues` runs wherever an issue is added, edited, deleted or
taken out of scope, so the Summary under the score says what has been found even
for a tester who never opens the summary dialog. It is the same merge, so their
wording and the severity they moved a line to both survive. The consequence to
know: a line deleted from the summary while its issue is still recorded comes
back on the next change, and deleting the issue is what removes it for good.

Changing an issue re-files its line, which the merge cannot do. The merge fills
in a severity only where a line has none, on purpose, so that generating does
not undo a line the tester moved to another banner by hand — but that same rule
left an issue rescored from 4 to 3 sitting under Advisory. An edit is the one
moment the tool knows a severity changed and why, so `summaryWithRescoredIssue`
moves the line outright. Deletion works to the same rule from the other side:
`summaryWithoutIssues` keeps a line only where its description is still recorded
*at that line's own severity*, so deleting one of two issues that share wording
takes its line and leaves the other's.

Files saved by earlier versions used different field names (`evalUCs`,
`performedUCs`, `ats`, `oses`, `startlocation`). `domain/migration.ts` accepts
both spellings on load and always writes the current ones, so opening an old
file and saving it quietly upgrades it. Old spellings belong in that module and
nowhere else: the editor's inputs are named for the properties they write, and
naming them for the old spellings — which they once were — wrote fields nothing
reads, losing the edit the next time the editor opened.

`domain/migration.ts` is the only place untrusted file contents become an
`Evaluation`. Everything downstream can assume the normalized shape.

## Untrusted file contents

An evaluation file is untrusted input. It is passed between testers, and
everything in it reaches the screen: names, goals, step instructions, issue
descriptions, comments.

**Nothing builds DOM from a string.** Text goes in through `textContent`, and
anything with structure is built as elements. `eslint.config.js` bans
`innerHTML`, `outerHTML` and `insertAdjacentHTML` outright, so the rule is
enforced rather than remembered. Before that, a description reading
`<img src=x onerror=...>` ran as script the moment its step was opened.

**Only a real web address becomes a link.** A test's start location goes into an
anchor's href, and an href accepts `javascript:` and `data:` URLs, which run
when followed. `domain/safe-url.ts` allows `http:` and `https:` and nothing
else; anything refused is shown as the text it is.

**A Content Security Policy backs both of those up.** It is a `<meta>` tag in
`index.html`, so it applies to the dev server and the built output alike.
`script-src` names unpkg because the `docx` library is loaded from there, and
nothing else may load or run. If a way to inject markup ever reappears, the
policy is what stops it fetching or running anything.

Two allowances are deliberate. `style-src` permits inline styles because Vite
injects stylesheets as `<style>` elements when running the dev server; no user
text reaches a style, so nothing turns on it. `frame-ancestors` is absent
because it is ignored in a meta policy and needs a response header, which GitHub
Pages does not let us set.

The view modules set classes rather than style attributes for the same reason:
inline styles would have forced that allowance even in the built output.

## Status messages

Showing a message and announcing it are two jobs, done by two elements.

The visible paragraph belongs beside the control it reports on, which puts it
inside a screen or a dialog, and those get hidden. A live region cannot live
there: inside a `display: none` subtree it announces nothing, and a screen
reader drops it rather than picking it up again when the screen returns. That is
exactly what happened when the screens were introduced -- `evaluation-msg` had
been permanently visible, and hiding the landing screen silently stopped every
announcement it made.

So `#app-status` sits outside every screen and dialog, is never hidden, and is
what announces on the page. It is `role="status"`, which is polite: a load
confirmation should wait its turn rather than cut across whatever the reader is
saying.

**Which region gets the message is decided by focus, not by document order.**
The issue dialog opens on top of the Perform dialog, so two dialogs are open at
once; asking the document for `dialog[open]` answers with the first in the
markup, which is the Perform dialog, and the modal above it has made that inert.
A modal traps focus, so the dialog containing the focused element is the one on
top and the only one a reader can reach.

**The dialogs' regions are `role="alert"`, which is assertive, and that
difference is deliberate.** A polite update waits for the reader to fall idle
and is dropped rather than queued if it never does. The dialog messages report
what an action just did, and every one of those handlers moves focus first, so
the reader is mid-sentence when the message arrives. The paragraph was being
written correctly and the message was simply never spoken; interrupting is the
right behaviour for a confirmation the tester is waiting on. **Every dialog carries one of its own too.** A modal
dialog puts itself in the browser's top layer and makes everything outside it
inert, which takes the page's region out of the accessibility tree for as long
as the dialog is open -- so a message raised from the issue dialog, announced
from the page's region, is heard by nobody. `announce` sends the message to
whichever region is reachable: the open dialog's, or the page's. It is off screen via
`.visually-hidden`, which keeps it in the accessibility tree; `display: none`
would defeat the point. `ui/status.ts` writes both, and `showStatusMessage`
announces even when the paragraph is missing.

A dialog's own controls are wired **once at startup**, not each time it opens.
Registering an inline function in the open handler adds a fresh closure every
time, and the browser keeps all of them: ten opens meant ten handlers on the
issue dialog's close button, each running the discard prompt in turn. A named
function passed repeatedly is deduplicated by `addEventListener` and is safe;
an inline one never is.

**Fill a dialog before opening it.** A dialog is named by its heading through
`aria-labelledby`, and the issue dialog is the only one whose heading is empty
in the markup and written by script. Opening first and writing the title
afterwards leaves a reader that reads the name at open time announcing nothing
the first time and the previous step's title every time after. Nothing on that
path yields, so the work costs nothing done first. Focus is the exception: it
can only be placed once the dialog is open.

**Every dialog opens on its heading**, which is what names it, and its close
button comes straight after. The close button used to be first in the source and
carry `autofocus`, so opening any dialog announced "close" before saying what
the dialog was for. It is positioned absolutely, so its place in the source
never affected where it appears; it only ever affected what was read first.
Headings carry `tabindex="-1"` so they can take focus.

The issue dialog's controls are ordered so that reading forwards matches doing:
New Issue, then the fields it reveals, then Save Issue. The button used to sit
*after* the fields, so pressing it threw focus backwards up the dialog.

The gap before the message lands is also what gives a reader time to finish
speaking a focus change. These handlers move focus and then announce, and a
reader busy with the focus change drops a live region update that arrives while
it is speaking.

The same rule covers the file dialogs. A native picker hands focus back to the
page without leaving it anywhere, so a reader re-orients itself: it reads the
document title and then walks whatever it finds, and a polite message queues up
behind all of it. Loading a file puts focus on the list of functional tests,
which says the evaluation is open and what is in it, before announcing. Saving
has no next thing to move on to, so focus goes back to the control that was
pressed, cancelling included: changing your mind should not strand focus
either.

**Settle focus before announcing, never after.** A handler that removes or
hides the element holding focus drops focus to the body, and a screen reader
treats that as a context change and discards a pending message. Saving an issue
hides the Save button that was just pressed; deleting one removes the row the
delete button was in; deleting a step removes the step. Each announced first and
moved focus afterwards, and each was silent in JAWS while NVDA happened to be
forgiving enough to read it anyway. Move focus somewhere deliberate, then call
`showStatusMessage` last.

**The region is emptied again once the message has been spoken.** A live region
keeps whatever it last said, and that text stays in the accessibility tree as
ordinary content: a save announced on the perform screen was still there to be
read on returning to the landing screen, long after it stopped being true.

Two things it does deliberately. It never touches `aria-live` at run time: the
attribute belongs on the region before the content changes, and the old code set
it afterwards. And it empties the region before putting the message in, one task
later, because a live region announces a *change* -- setting the same text twice
in a row is no change at all, which is why saving two issues in a row used to
announce only the first.

## Failure handling

The File System Access API is Chromium-only and both pickers reject with an
`AbortError` when the user dismisses the dialog. `ui/evaluation-view.ts` treats
that as a normal outcome, reports unreadable files and write failures in the
status region belonging to whichever control was used, and checks
`isFilePickerSupported()` before offering the action at all — a large share of
screen reader users work in Firefox, where these APIs do not exist.

**Saving asks where only once.** `io/file-picker.ts` keeps the handle from the
first save and writes straight to it afterwards, so a tester performing a long
evaluation can save often without a file dialog stealing focus every time, which
is most of what makes saving disruptive with a screen reader. The handle is
deliberately *not* taken from opening a file: Save would then overwrite whatever
was loaded with no prompt, and the first thing anyone opens is a file they did
not mean to write over. Replacing the evaluation, by loading or starting a new
one, forgets it, or a new evaluation would be saved over the last one's file.

A save that writes straight to the file announces at once rather than after the
usual delay: nothing opened, so nothing stole focus and there is nothing to wait
for.

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

The detailed section gives each issue **its own table row**, carrying the score
the tester assigned to it. `issueRows` returns those score-and-description pairs
for a step or extension: one row per issue, a single row reading 5 and "No
issues" for a record with none, and a single row reading `N/A` and "Out of
scope" for a record marked out of the test's scope.

The score and the description are one object rather than two lists because they
have to end up in the same table row. Kept apart, nothing said which number went
with which finding: a reader met "1 3 3" in one cell and three sentences in the
next, and a description long enough to wrap took even the visual pairing apart.

Each step's rows are grouped: the results dialog gives every step its own
`tbody`, headed by the step number in a `th` with `scope="rowgroup"` spanning
its rows, and the report merges the number and instructions cells down the same
span. So a reader on the third issue is still told which step it belongs to,
without the number being repeated on every line. The report's banding follows
the step rather than the row, so one step's issues read as one block.

Nothing is averaged. A step used to report the mean of its issue scores rounded
down, so a stopper sitting beside two minor issues printed a single "2" -- which
read as the score of the first issue, and lost the rest (issue #27). The run's
own score is still `runScore`, the most severe issue anywhere in it, so that
step's stopper takes the use case to 1 while the step itself shows a 1 and two
3s on rows of their own.

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

The score key's colors live in `domain/report-format.ts` rather than beside the
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

Text is given an explicit color **only** where the report sets a background.
Word's "auto" adapts text to the reader's theme, which is right for ordinary
paragraphs and wrong on a cell whose fill is a fixed pale color: a dark theme
can turn the text pale too, leaving pale on pale. Unshaded text stays on "auto".

`ui/eval-results-view.ts` renders the results dialog section for section
against the report, reading its wording from `domain/report-format.ts` and
grouping runs with the same `groupRunsByAssistiveTechnology`. Changing one
without the other is what the two are arranged to prevent, so add new sections
to both.

**The results dialogs are read only.** Both the evaluation's results and a
single use case's show values and nothing else. The two values they show per
assistive technology, its overall rating and its significant issues, are written
from the perform screen instead: the last functional test assigned to a
technology carries a View Overall Comments button, which is where a tester has
just finished with that technology and knows what to say about it.

That dialog opens with the rating defaulted to the **worst** score any of that
technology's tests reached, and with the three most severe issues already in the
box when nothing has been written yet. Generate **appends** the per test
comments rather than replacing, so a tester's own wording is never thrown away.
It writes `overallRating` and `significantIssues`, which is what Significant
Issues and Assistive Technology Summaries both render.

**The report falls back to what the evaluation already knows.** A technology
whose dialog was never opened still gets a rating and a list of issues, computed
the same way the dialog would have offered them: the worst score it reached, and
its three most severe issues. `effectiveSummaryFor` is the one place that rule
lives, and the results dialog, the report and the scorecard's overall figure all
read through it. A tester who performed every test but never wrote a summary
should not produce a report that says "Not rated" and "No issues."

One loose end remains: `Evaluation.comments`, which the old evaluation wide
version of that dialog wrote, is displayed by nothing and now written by
nothing. It is left in the model and in saved files rather than dropped, so text
written by an older version is not silently discarded on load.

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
