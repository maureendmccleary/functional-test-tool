# Manual smoke checklist

The automated tests in this directory cover pure logic only. Everything below is
DOM behavior they cannot reach: dialog wiring, focus moves, listener order, and
the File System Access API.

**Run this whole checklist before releasing**, and after any change that
touches a dialog, focus handling, or the file pickers.

## Setup

Run the app. Either works; prefer `preview` before a release, since that is
what actually gets deployed:

```bash
npm run dev        # dev server, source as written
npm run build && npm run preview   # the built output
```

Open it in **Chrome or Edge**. Firefox and Safari do not implement `showOpenFilePicker`/`showSaveFilePicker`, so loading and saving will
fail there; that is a known limitation, not a regression.

Keep the devtools console open for the entire run. **An uncaught exception is a
failure even if the visible result looks right** -- this app updates the DOM by
hand, so a broken handler often leaves a plausible-looking screen behind.

Work on a scratch copy so you never overwrite a fixture:

```bash
cp tests/fixtures/evaluation-with-runs.json /tmp/smoke.json
```

## 1. Load an evaluation

- [ ] **Load Evaluation File...** opens the picker; choose `/tmp/smoke.json`
- [ ] "Select a Functional Test" fills with three names, "Search the catalogue
      and place a hold" first
- [ ] **View Evaluation Results**, **Save Evaluation File**, **Edit Functional
      Test**, and **Perform** all become enabled
- [ ] "Evaluation data loaded!" is announced (it appears ~100 ms after the picker
      closes -- the delay is deliberate, see `../ARCHITECTURE.md`)

## 2. Edit a functional test

- [ ] Select "Renew a borrowed item", then **Edit Functional Test**
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
- [ ] **New Functional Test** opens the editor with 5 blank steps already
      present, and focus in the Name field
- [ ] Typing into one of those 5 steps leaves the other four empty -- they are
      separate steps, not one step shown five times
- [ ] Editing a step's instructions and clicking away keeps the new text
- [ ] **New Step** opens the step-number dialog; **Add Step** inserts a step at
      the chosen position and renumbers the ones after it
- [ ] Delete a step: the step disappears, the remaining steps renumber, and
      "Step N was successfully deleted!" is announced
- [ ] Edit a step's text on a test that already has recorded issues, then reopen
      **Perform**: the issues are still attached to that step
- [ ] **Save** writes the file and announces "Functional Test saved successfully."
      ~500 ms after the picker closes

## 3. Perform a functional test

- [ ] Select "Search the catalogue and place a hold", then **Perform**
- [ ] Every step shows its instructions, its recorded issues, and an **Add Issue**
      button
- [ ] Changing **Assistive Technology Type** between NVDA and JAWS switches to
      that AT's recorded results (both have runs saved, with different issues);
      switching back restores the first set
- [ ] Add a third AT to this test in the editor, reopen **Perform**, and select
      it: empty issue lists and a score of `Not Rated (-1)`, with the NVDA and
      JAWS data still intact
- [ ] Adding a step in the editor and reopening **Perform** shows the new step
      with an empty issue list

## 4. Issues

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

## 5. Summary and scoring

- [ ] **View Summary** -> **Generate Summary** fills General Comments with only
      the severities that have issues, under the banners `Stoppers:`,
      `Major Issues:`, `Minor Issues`, `Advisory`
      <br>*(the last two have no colon -- that is current behavior, see
      `../ARCHITECTURE.md`)*
- [ ] The Score field updates to the most severe issue present
- [ ] **Save** replaces the summary list; an empty comment box yields a single
      "No Issues" entry
- [ ] **View Results** shows the results table with the issues grouped by severity

## 6. Evaluation results and report

- [ ] **View Evaluation Results** opens the results dialog with an Executive
      Summary, Significant Issues, and the scoring key
- [ ] With no overall comments saved, the Significant Issues area reads
      "No issues." -- **not** the literal word "undefined"
- [ ] **View Overall Comments** -> **Generate Overall Comments** -> **Save**
- [ ] **Generate Report (.docx)** downloads a file that opens in Word, with each
      functional test and its issues
      <br>*(needs network access -- `docx` loads from unpkg)*

## 7. Save and diff

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
