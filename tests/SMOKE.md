# Manual smoke checklist

The automated tests in this directory cover pure logic only. Everything below is
DOM behavior they cannot reach: dialog wiring, focus moves, listener order, and
the File System Access API.

**Run this whole checklist before releasing**, and after any change that
touches a dialog, a screen change, focus handling, or the file pickers.

## Setup

Run the app. Either works; prefer `preview` before a release, since that is
what actually gets deployed:

```bash
npm run dev        # dev server, source as written
npm run build && npm run preview   # the built output
```

Open it in **Chrome**. That is the browser this app is tested in, and the one
every check below assumes. Loading and saving go through the File System Access
API, which only Chromium browsers implement; anywhere else the app says so
rather than failing silently, which is a known limitation and not a regression.

Keep the devtools console open for the entire run. **An uncaught exception is a
failure even if the visible result looks right** -- this app updates the DOM by
hand, so a broken handler often leaves a plausible-looking screen behind.

Work on a scratch copy so you never overwrite a fixture:

```bash
cp tests/fixtures/evaluation-with-runs.json /tmp/smoke.json
```

## 1. Load an evaluation

- [ ] **Load Evaluation File...** opens the picker; choose `/tmp/smoke.json`
- [ ] "Select a Functional Test" fills with **four** entries, each named number,
      name, then assistive technology:
      <br>`01 Search the catalogue and place a hold - NVDA`
      <br>`01 Search the catalogue and place a hold - JAWS`
      <br>`02 Renew a borrowed item - NVDA`
      <br>`03 Update notification preferences - NVDA`
      <br>*(the file holds three scripts; the first was performed with two
      assistive technologies, so loading it splits that one in two)*
- [ ] You stay on the landing screen, and its Evaluation Details show
      "Riverbend Public Library", "Library Catalogue" and
      "Q3 2026 Accessibility Evaluation" as text, not as editable fields
- [ ] **Edit Evaluation**, **View Evaluation Results**, **Save Evaluation File**,
      **Edit Functional Test**, and **Perform** all become enabled, alongside
      **New Evaluation**
- [ ] "Q3 2026 Accessibility Evaluation loaded successfully. 4 functional tests."
      is announced (it appears ~100 ms after the picker closes -- the delay is
      deliberate, see `../ARCHITECTURE.md`)
- [ ] Load `tests/fixtures/evaluation-legacy.json`, which carries no cover: the
      details read "Not set" rather than keeping the previous evaluation's, and
      the announcement falls back to "Evaluation loaded successfully."
- [ ] **Edit Evaluation**, change the Evaluation name, then **Save**: the
      landing screen's details show the new name

## 2. The evaluation screen

- [ ] **Edit Evaluation** shows the evaluation screen, focus lands on its
      "Evaluation" heading, and the landing screen is no longer visible
- [ ] Workspace, Asset and Evaluation show the loaded values, and its list of
      functional tests matches the landing screen's
- [ ] **Add Test** opens the functional test editor with 5 blank steps already
      present and focus in the Name field
- [ ] **Back** in the editor warns that the unsaved test will be discarded;
      confirming returns to the evaluation screen with the list unchanged
- [ ] **Delete Functional Test** on `01 ... - JAWS` asks first; cancelling
      leaves it in place
- [ ] Confirming removes **only** that entry -- `01 ... - NVDA` is still there,
      with its own issues -- and announces that it was deleted
- [ ] The remaining entries keep their numbers: deleting `02` leaves `01` and
      `03` named as they were, gap and all
- [ ] Delete every functional test: **Delete Functional Test**, **Edit
      Functional Test** and **Perform** all become disabled
- [ ] Reload `/tmp/smoke.json` to carry on
- [ ] **Save** on the evaluation screen returns to the landing screen; the
      functional test list is there with Edit and Perform, and there is no
      **New Functional Test** button
- [ ] **Back** on the evaluation screen also returns to the landing screen, and
      does **not** announce that the evaluation is ready to perform
- [ ] **New Evaluation** with unsaved changes warns before discarding them;
      cancelling keeps the loaded evaluation intact
- [ ] **New Evaluation** immediately after loading a file does **not** warn --
      nothing has been changed yet

## 3. Author a functional test

- [ ] **Edit Evaluation** -> **Add Test**, fill in Name and Goal, and check
      **NVDA**, **JAWS** and **ZoomText**
- [ ] **Save** stays in the editor and announces which functional tests were
      created: the one it saved as, then the two more, each named
      `NN name - technology`
- [ ] Only the technology the editor is now on stays checked
- [ ] **Back** returns to the evaluation screen with all three in the list,
      together and in order, and no prompt about discarding
- [ ] **Edit Functional Test** on the evaluation screen opens the editor on the
      selected copy; **Back** returns to the evaluation screen, not the landing
      screen
- [ ] Give one copy instructions of its own -- reword a step for that
      technology -- and **Save**: the wording sticks, **no** further copy is
      created, and the other copies keep the wording they had
- [ ] Edit one of the three, check a fourth technology, and **Save**: one more
      functional test appears, and the one edited keeps its own issues
- [ ] Change one copy's **Operating System**, **Save**, then generate the
      report: that use case's Operating System row shows the new value while
      its siblings keep theirs
- [ ] Do the same on a use case that has already been scored: it keeps the
      operating system it was performed under
- [ ] Edit it again, uncheck its own technology, and **Save**: nothing is
      deleted -- unchecking never throws away recorded work
- [ ] **Save** with the Name empty refuses, says so, and puts focus in the Name
      field
- [ ] **Save** with no assistive technology checked refuses, says so, and puts
      focus on the **Assistive Technology** button

## 4. Edit a functional test

- [ ] Select `02 Renew a borrowed item - NVDA`, then **Edit Functional Test**
- [ ] Name, Goal, Operator, Start Location, Operating System, and Application all
      show the saved values
- [ ] The **Assistive Technology** button expands its group, and the checked
      boxes match the test's saved AT list
- [ ] With the group expanded, one Tab from the **Assistive Technology** button
      lands on the first checkbox -- there is no stop on the container in
      between
- [ ] With a screen reader running, one Down arrow from the button also reaches
      the first checkbox: no menu mode, no "grouping" boundary, no stop of any
      kind on the container
- [ ] The checkboxes read as checkboxes, not as menu items
- [ ] Escape while focus is inside the group collapses it and returns focus to
      the **Assistive Technology** button
- [ ] Reopen the editor several times, then press Escape inside the group once:
      it collapses once, with no repeated announcement
- [ ] Typing into one of the 5 blank steps of a new test leaves the other four
      empty -- they are separate steps, not one step shown five times
- [ ] Editing a step's instructions and clicking away keeps the new text
- [ ] Editing Start Location and Operating System, then leaving the editor and
      reopening it, keeps the new values
- [ ] **New Step** opens the step-number dialog; **Add Step** inserts a step at
      the chosen position and renumbers the ones after it
- [ ] Delete a step: the step disappears, the remaining steps renumber, and
      "Step N was successfully deleted!" is announced
- [ ] Edit a step's text on a test that already has recorded issues, then reopen
      **Perform**: the issues are still attached to that step
- [ ] **Save** does **not** open a file picker: it completes the script in
      memory and reports what it created. The file is written from **Save
      Evaluation File** on the landing screen

## 4a. Extensions

- [ ] **New Extension** in the editor appends a numbered extension and puts
      focus in it; type credentials into extension 1
- [ ] Reference it from a step: "Login credentials are located in extension 1"
- [ ] **Save**, leave the editor, reopen it: both the step and the extension
      come back as typed
- [ ] Deleting an extension that has others after it warns that they will be
      renumbered; cancelling leaves it in place
- [ ] Deleting the last extension warns only that its issues will be lost

## 5. Perform a functional test

- [ ] Select `01 Search the catalogue and place a hold - NVDA`, then **Perform**
- [ ] Every step shows its instructions, its recorded issues, and an **Add Issue**
      button
- [ ] Assistive Technology reads as **text**, showing NVDA. There is no
      technology to choose: the script is written for one
- [ ] Close it, select the `- JAWS` entry, **Perform**: the same steps with the
      JAWS results, which differ from the NVDA ones
- [ ] Perform a functional test nobody has scored yet: Score reads
      `Not Rated (-1)` on opening, and stays there until you pick one
- [ ] Adding an issue does **not** change the Score on its own -- the score is
      the tester's, and picking one is what marks the run performed
- [ ] Pick a score, close the dialog, reopen it: the score you picked comes back
- [ ] Adding a step in the editor and reopening **Perform** shows the new step
      with an empty issue list
- [ ] Extensions appear after the steps, headed "Extension 1" and so on, each
      with its own **Add Issue** button
- [ ] Recording an issue against an extension lists it under that extension and
      **not** under any step, and relabels that extension's button alone
- [ ] A stopper recorded against an extension takes the use case's score to 1,
      the same as one recorded against a step
- [ ] A test with no extensions shows no extension blocks at all

## 6. Issues

- [ ] **Add Issue** on a step opens the issue dialog with that step's issues in
      the table
- [ ] Saving with an empty description shows "Description is required." and moves
      focus to the description field
- [ ] Saving with the score left on "Not Rated (-1)" shows "Score is required."
      and moves focus to the score field
- [ ] A valid save announces "Issue successfully saved!", adds a table row, and
      adds the issue under the step in the Perform dialog
- [ ] **Edit** on a row loads that issue into the fields, announces "Editing
      issue N", and puts focus in the description field; saving updates the same
      row rather than adding one
- [ ] Reopen the dialog on a step whose issue count is unchanged -- the table
      renders without a console error
- [ ] **Delete** on a row removes it from both the table and the step
- [ ] Typing a description and then closing the dialog with **Esc** or the X
      prompts to discard; cancelling the prompt keeps the dialog open
- [ ] Reopening the dialog on a step shows a table matching that step exactly

## 7. Summary and scoring

- [ ] **View Summary** -> **Generate Summary** fills General Comments with only
      the severities that have issues, under the banners `Stoppers:`,
      `Major Issues:`, `Minor Issues`, `Advisory`
      <br>*(the last two have no colon -- that is current behavior, see
      `../ARCHITECTURE.md`)*
- [ ] The Score field updates to the most severe issue present
      <br>*(Generate Summary is the one place other than the score control that
      writes the score, and it is a deliberate tester action)*
- [ ] **Save** replaces the summary list; an empty comment box yields a single
      "No Issues" entry
- [ ] **View Results** shows the results table with the issues grouped by severity

## 8. Evaluation results and report

- [ ] **View Evaluation Results** opens the results dialog. Its sections are, in
      order: Use Case Results Summary (Scorecard, Assistive Technologies Used),
      Significant Issues, Assistive Technology Summaries, Testing and Scoring
      Key, Detailed Use Case Results -- **the same order as the report**, and
      with no "Executive Summary" heading anywhere
- [ ] The dialog's Scorecard matches the report's for the same evaluation
- [ ] Significant Issues lists each assistive technology's overall rating
      followed by its issues, reading "No issues." where none were entered --
      **not** the literal word "undefined"
- [ ] Detailed Use Case Results groups by assistive technology: the AT is a
      heading, and each numbered use case is a heading under it
- [ ] A functional test nobody has performed still appears there, marked
      "Not rated", so what is outstanding is visible
- [ ] **View Overall Comments** -> **Generate Overall Comments** -> **Save**
      <br>*(these comments are no longer displayed in the dialog or the report;
      see the note in `../ARCHITECTURE.md`)*
- [ ] The **Assistive Technology Summaries** area shows one block per assistive
      technology in the evaluation, each with a rating select and an issues
      textarea
- [ ] Editing a rating or issues there and reopening the dialog updates the
      Significant Issues section and the Scorecard's Overall Rating
- [ ] Set a rating and type two paragraphs of significant issues, close the
      dialog, reopen it: both come back
- [ ] **Generate Report (.docx)** downloads a file that opens in Word
      <br>*(needs network access -- `docx` loads from unpkg)*

Open that document and check:

- [ ] The cover shows the workspace, then the asset and evaluation name joined
      with a dash, then the date and time the file was generated -- from
      `/tmp/smoke.json` that reads "Riverbend Public Library", then
      "Library Catalogue - Q3 2026 Accessibility Evaluation" 
- [ ] Word opens the document with **no prompt of any kind** -- no offer to
      update fields, no macro or security bar. A prompt means a field crept back
      into the document
- [ ] The Table of Contents lists each assistive technology with its use cases
      indented under it, and clicking an entry jumps to that heading
- [ ] The Scorecard's total counts **performed runs**, not scripts: three use
      cases performed with two ATs each totals six, and a functional test nobody
      has scored is not counted at all
- [ ] Add a functional test for a new assistive technology and generate the
      report without performing it: the Scorecard total does not move, and it
      does not appear as a 5
- [ ] Overall Rating is the average of the ratings entered above, to one decimal
      place, and reads "Not rated" when none were set
- [ ] Significant Issues lists each assistive technology with its rating and the
      issues typed into the dialog
- [ ] Detailed results are grouped by assistive technology first, with each
      use case under the AT it was performed with
- [ ] A use case with extensions has a third table under an "Extensions"
      heading, after Main Success Case, with the columns Extension #,
      Extension, Score, Issues Encountered
- [ ] A use case with no extensions has no "Extensions" heading or table
- [ ] Each use case has **two** tables, under the headings "Overall Information"
      and "Main Success Case" -- not one merged table. Click into the steps
      table and confirm Word reports it as its own table, with the metadata
      above it in a separate one
- [ ] Use case names read number, name, then assistive technology --
      `01 Search the catalogue and place a hold - NVDA` -- in the contents, the
      heading and the metadata table's Name row, and the same script keeps the
      same number under every assistive technology
- [ ] A use case nobody has scored reads "Not rated" rather than scoring 5
- [ ] The step table's columns are Step #, Main Success Case, Score, Issues
      Encountered, in that order
- [ ] A step with no issues scores 5; a step with issues scores the average of
      them, rounded down -- so a step holding a stopper among minor issues can
      read higher than the use case's own score, which is deliberate
- [ ] With a screen reader in the metadata table, moving to a value announces
      its field name -- "Goal", "Operator", "Start Location" -- rather than
      reading the value bare
- [ ] In the steps table, moving between columns announces "Main Success Case"
      and "Issues Encountered"
- [ ] The Scorecard reads the same way: each number is announced with the label
      beside it
- [ ] Each use case ends with the five score labels, the one it scored filled in
      a stronger colour and bold
      <br>*(the contrast of every label against its fill is asserted by
      `contrast.test.ts`; what needs an eye here is only that the right row is
      the filled one)*
- [ ] Open the report with Word in a dark theme: the filled rows and the table
      headings still read as dark text on their pale fills
- [ ] The cover credits "Produced by Functional Test Tool, Level Access Inc."
- [ ] The report says "Use Case" throughout, **not** "Functional Test" -- that
      wording is deliberate output, see ARCHITECTURE.md

## 9. Save and diff

- [ ] **Save Evaluation File** over `/tmp/smoke.json`
- [ ] With no edits made in this session, the saved file matches the golden:

```bash
diff <(node -e 'console.log(JSON.stringify(JSON.parse(require("fs").readFileSync("/tmp/smoke.json","utf8")), null, 2))') \
     tests/golden/evaluation-with-runs.json
```

  Any difference here is a state-shape regression. The automated golden test
  (`tests/golden-roundtrip.test.ts`) covers the same ground for the load path;
  this step confirms the browser's save path agrees.

## Deliberate oddities -- not regressions

Documented in `../ARCHITECTURE.md`. Leave them alone.

- The summary banners are punctuated inconsistently: `Stoppers:` and
  `Major Issues:` carry a colon, `Minor Issues` and `Advisory` do not.
- Status messages after the file dialogs appear a beat late. The 100 ms and
  500 ms delays are deliberate: screen readers miss the announcement otherwise.
