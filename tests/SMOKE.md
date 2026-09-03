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
- [ ] **Load Evaluation File...** with unsaved changes warns in the same words
      before the file dialog opens; cancelling leaves the loaded evaluation
      alone and never opens the picker
- [ ] Closing or reloading the tab with unsaved changes raises the browser's own
      "leave site" prompt; with nothing unsaved it closes without one
      <br>*(this is the only place the evaluation is genuinely lost -- every
      other route keeps it in the store)*

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
- [ ] The **Assistive Technology** button expands its group and focus lands on
      the technology the script is already assigned to, not at the top of the
      list. The checked boxes match the test's saved AT list
- [ ] On a new test with nothing assigned yet, expanding lands on the first
      entry instead
- [ ] Because focus is already inside, the arrow keys and first letter
      navigation work immediately, with no Tab needed first
- [ ] There is no stop on the container itself: Tab from the last checkbox
      leaves the group rather than pausing on it
- [ ] With a screen reader running, the group reads as checkboxes: no menu
      mode, no "grouping" boundary announced on the container
- [ ] The checkboxes read as checkboxes, not as menu items
- [ ] With focus inside the group, **Down** and **Up** move through the list and
      wrap at both ends, and **Home** and **End** reach the first and last
      entries. Check this *after* using first letter navigation as well: moving
      focus puts a screen reader in focus mode, where the group has to handle
      the arrows itself
- [ ] With focus inside the group, typing a letter moves to the first
      technology starting with it, and pressing the same letter again moves to
      the next one sharing it: "v" walks Voice Control, VoiceOver, VoiceView
- [ ] Typing a longer run quickly, such as "win", reaches Windows Magnifier
      directly
- [ ] **Space** still ticks the focused checkbox rather than being swallowed by
      the typing
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

## 5. Perform a functional test (a screen, not a dialog)

- [ ] Select `01 Search the catalogue and place a hold - NVDA`, then **Perform**:
      the perform **screen** replaces the landing screen, focus lands on
      "Perform Functional Test", and there is no dialog to escape from
- [ ] **Back** returns to the landing screen with the test list intact, and the
      earlier "loaded successfully" message is **not** read out again
- [ ] **Back** after recording anything warns that the results are not saved to a
      file; cancelling stays on the perform screen with everything intact
- [ ] Accepting that warning and going back, then performing the same test
      again, shows every result still there -- Back keeps the work, and the
      warning says so rather than claiming it is lost
- [ ] **Back** with nothing recorded since the last save does not warn
- [ ] The page title follows the screen: "Perform Functional Test", "Evaluation",
      "Functional Test Editor", and the app's name on the landing screen. Ask the
      reader for the title on each
- [ ] Opening a dialog titles the page for it, including "Add Issue Step 3" for
      the step it was opened on, and closing it puts the screen's title back
      whether closed by its button or by Escape
- [ ] **Add Issue**, **View Results** and **View Summary** each open a single
      dialog over the screen. Closing one returns to the perform screen, not to
      another dialog
- [ ] Nothing is announced twice on opening the perform screen, and the reader
      does not read the whole screen back after focus moves inside it
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

## 5a. Steps that are out of scope

- [ ] Every step and every extension has an **Out of scope** checkbox after its
      Add Issue button, and the reader announces it as a checkbox named
      "Out of scope Step 3" -- the step's number is part of the name, since
      every step on the screen has one of these
- [ ] The label is clickable and **Space** toggles the box, both of which come
      free from its being a real checkbox rather than something built to look
      like one
- [ ] Ticking it replaces that step's issue list with a single **Out of scope**
      line, and no other step's list changes
- [ ] Untick it: the step's own issues come back, or "No issues" if it had none
- [ ] Leave the screen and come back: every box you ticked is still ticked
- [ ] Tick the box on a step that already has an issue recorded. The list reads
      "Out of scope", and the button still says "View 1 Issue" -- the issue is
      kept and still reachable, it is only no longer reported
- [ ] With a **stopper** recorded on that step, the use case's score is what the
      rest of the steps make it, not 1. A step nobody performed contributes
      nothing to the score, the summary or the significant issues
- [ ] **View Results**: the out of scope steps read `N/A` in the Score column and
      `Out of scope` under Issues Encountered, and their issues are absent
      <br>*(one `N/A`, not one per issue it is hiding)*
- [ ] Generate and save a summary, *then* tick Out of scope on a step whose
      issues are in it: those issues leave the Summary under the score, and
      leave the Problem Summary in View Results and the report with it
      <br>*(the summary is stored as text, so it is the one thing that has to be
      brought back into line rather than recomputed)*
- [ ] Anything you typed into the summary yourself survives that; only text
      matching an issue on the skipped step goes
- [ ] The Score under the list is **not** changed by ticking the box -- the
      score is the tester's
- [ ] The same two cells read the same way in the generated `.docx`

## 6. Issues

- [ ] Open the issue dialog on **step 1**, close it, then open it on **step 3**:
      the second announces "Add Issue Step 3", not step 1's title and not a
      dialog with no name. Its title is the only one written by script, so it
      is the only one that can go stale
- [ ] Every dialog opens announcing its own heading, never "close": New Step,
      Perform, Add Issue, View Summary, View Results, Evaluation Results and
      View Overall Comments
- [ ] In each, the close button is reached straight after the heading, and
      **Escape** still closes
- [ ] **Add Issue** on a step opens the issue dialog with that step's issues in
      the table, and focus lands on the dialog's heading, which names the step.
      A step with no issues yet opens straight into the Description field
- [ ] Tab order runs forwards: **New Issue**, then Description, Score, Finding
      URL, then **Save Issue**. Pressing New Issue moves focus down the dialog,
      never back up it
- [ ] Saving with an empty description shows "Description is required." and moves
      focus to the description field
- [ ] Saving with the score left on "Not Rated (-1)" is refused, moves focus to
      the score field, and the message names the record and points at the
      checkbox: "Score is required. To record that Step 3 was not tested, close
      this dialog and mark it Out of scope."
      <br>*(a -1 is the one score nothing downstream can read, so it stays
      refused; filing an "N/A" issue was the workaround the checkbox replaces)*
- [ ] A valid save announces "Issue successfully saved!", adds a table row, and
      adds the issue under the step in the Perform dialog
- [ ] **Edit** on a row loads that issue into the fields, announces "Editing
      issue N", and puts focus in the description field; saving updates the same
      row rather than adding one
- [ ] Rewording a description updates the line for it in the Summary under the
      score **in place**, keeping its position, rather than dropping it
      <br>*(an edit is the same finding in better words; a delete is not)*
- [ ] Reopen the dialog on a step whose issue count is unchanged -- the table
      renders without a console error
- [ ] **Delete** on a row removes it from both the table and the step, and takes
      it out of the Summary under the score as well when a summary was already
      written for the run
- [ ] On a step already marked **Out of scope**, saving, editing or deleting an
      issue leaves the list behind the dialog reading "Out of scope" -- the
      dialog must not redraw it as the issues it is hiding
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
- [ ] **Save** announces "General comments saved." and leaves it on screen; the
      reader hears it from inside the dialog, since the page's own region is
      inert while a modal is open
- [ ] The **Summary under the score** on the perform screen is grouped the same
      way the report is: any unbannered line first, then `Stoppers:` and the
      rest, most severe first
- [ ] Clearing the summary entirely leaves a plain "No Issues" line there
- [ ] Leaving the script and performing it again redraws the summary still
      grouped
- [ ] Closing and reopening **View Summary** does not read that message again
- [ ] Reword a line *under its banner*, save, and reopen **View Summary**: the
      box comes back with its banners, and the reworded line is still under the
      one you left it under
      <br>*(a line's severity comes from where it sits, not from its text --
      this is the whole of issue #25)*
- [ ] Type a scoping note above the first banner, save and reopen: it is still
      at the top, still under no banner
- [ ] Write a comment that *mentions* a banner word mid-sentence -- "Advisory
      only: the icon could be larger" -- save and reopen: the sentence is intact
      <br>*(the old stripping deleted those words wherever they appeared)*
- [ ] **View Results**: the Problem Summary is grouped, most severe first, with
      any unbannered line printed above the groups
- [ ] **Generate Summary** on a box that already has text **merges**: your
      wording stays, missing issues are added under their banners, and pressing
      it a second time changes nothing
- [ ] Load an evaluation saved **before severities were stored**: its summaries
      show ungrouped, above where the banners would be, and its issue scores are
      untouched. Pressing **Generate Summary** then groups it -- a line matching
      an issue takes that issue's severity, and a note the tester wrote stays
      unclassified at the top
      <br>*(replacing was that tester's only route to a grouped summary and it
      cost them everything they had written)*
- [ ] Save a summary on script 1, go **Back**, then Perform script 2: the
      Summary under the score reads "No Issues", **not** script 1's summary
- [ ] Back to script 1: its own summary is there again
- [ ] Opening a script in the **editor** does not change what the perform
      screen's Summary shows
      <br>*(the list is on the perform screen; populateEditor used to write to
      it from a screen it is not on, which is what left it stale)*
- [ ] **View Results** shows the results table with the issues grouped by severity
- [ ] A step carrying several issues gives each issue a row of its own, with its
      score in the Score cell of that row, in both the results table and the
      generated `.docx`
- [ ] With a screen reader in that table, moving to a score announces it under
      the "Score" column heading, and the step number is still reported for the
      second and third issues of a step -- it heads the row group
      <br>*(this is the association the old stacked-lines layout could not make:
      "1 3 3" in one cell said nothing about which finding each belonged to)*
- [ ] A description long enough to wrap does not take the columns out of
      alignment, since the pairing is the row rather than the line

## 7a. Overall comments for an assistive technology

- [ ] Perform a test that is **not** the last one for its technology: there is
      no **View Overall Comments** button
- [ ] Perform the last test for that technology: the button is there
- [ ] Activating it opens a dialog titled "NVDA Overall comments" followed by
      the evaluation's name, and the page title says the same
- [ ] The rating starts at the **worst** score any of that technology's tests
      reached, and the box holds the three most severe issues found with it,
      already under their banners
- [ ] **Generate Overall Comments** fills the box with that technology's issues
      **grouped by severity**, not by script -- no script names appear
      <br>*(it used to head each block with a script name, leaving the tester to
      sort the whole thing into severity order by hand)*
- [ ] Pressing **Generate Overall Comments** a second time changes nothing: it
      merges rather than appending a second copy under a second set of banners
- [ ] Editing a line and generating again keeps the edit and adds only what is
      missing
- [ ] Only that technology's issues appear, never another's
- [ ] Change the rating, edit the text, **Save**, close and reopen: both come
      back as saved rather than being recomputed
- [ ] **Save** announces "Overall comments saved." the same way, and reopening
      does not read it again
- [ ] **View Evaluation Results**: Significant Issues shows that rating and
      those comments for that technology
- [ ] A technology whose overall comments were **never opened** still shows a
      rating and issues there, being the worst score it reached and its three
      most severe issues, rather than "Not rated" and "No issues."
- [ ] Saving a summary for it and reopening the results shows what was saved
      instead

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
      technology in the evaluation, each with its rating and its comments as
      text, and no controls for changing them
- [ ] Those values match what was saved from the perform screen, and the
      Scorecard's Overall Rating averages the ratings
- [ ] **Generate Report (.docx)** downloads a file that opens in Word
- [ ] In the report, both Problem Summary and Significant Issues are grouped
      under bold `Stoppers:` / `Major Issues:` / `Minor Issues` / `Advisory`
      lines, most severe first, with any unbannered line printed above them
      <br>*(the banners are bold paragraphs, not headings: they must not appear
      in the table of contents)*
- [ ] It arrives as `evaluation-results - <evaluation name>.docx`, so two
      reports from different evaluations do not land on each other as copies
- [ ] An evaluation with no name set downloads as `evaluation-results.docx`,
      with no dangling separator left on the end
- [ ] An evaluation named with something a file name cannot carry -- try
      `Q3/2026: audit` -- still downloads, with those characters spaced out
      rather than the download failing
- [ ] **Save Evaluation File** on a *new* evaluation opens the save dialog
      already filled in with the evaluation's name and `.json`, or
      `evaluation.json` when it has no name yet
      <br>*(the file pickers cannot be driven from a test, so this one is only
      ever checked by hand)*
- [ ] Renaming the file in that dialog sticks: saving again writes straight to
      the file you chose, without offering the suggestion a second time
      <br>*(needs network access -- `docx` loads from unpkg)*

Open that document and check:

- [ ] The cover shows the workspace, then the asset and evaluation name joined
      with a dash, then the date and time the file was generated -- from
      `/tmp/smoke.json` that reads "Riverbend Public Library", then
      "Library Catalogue - Q3 2026 Accessibility Evaluation" 
- [ ] Word opens the document with **no prompt of any kind** -- no offer to
      update fields, no macro or security bar. A prompt means a field crept back
      into the document
- [ ] "Assistive Technologies Used" lists the technologies by name with no
      version numbers
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
- [ ] A step with no issues is one row scoring 5. A step with issues gets **one
      row per issue**, each score in the same row as the finding it belongs to,
      so a step holding a stopper and two minor issues reads `1`, `3`, `3` on
      three rows rather than the single `2` an average rounded down used to
      print
- [ ] The step number and its instructions are written once and merged down that
      step's rows, rather than repeated on each
- [ ] In Word, moving through the merged cells still reaches the step number
      once per step, and each score sits beside its own issue
- [ ] Nothing is averaged: the use case's own score is still the most severe
      issue anywhere in it, so that step's stopper takes the use case to 1
- [ ] With a screen reader in the metadata table, moving to a value announces
      its field name -- "Goal", "Operator", "Start Location" -- rather than
      reading the value bare
- [ ] In the steps table, moving between columns announces "Main Success Case"
      and "Issues Encountered"
- [ ] The Scorecard reads the same way: each number is announced with the label
      beside it
- [ ] Open the report with Word in a **dark theme**: the filled score rows and
      the table headings still read as dark text on their pale fills
      <br>*(the only color check left by hand. `contrast.test.ts` asserts the
      contrast of every label against its fill, and that the row marked is the
      one the use case scored, so neither needs an eye. What no test here can
      reach is whether Word honours the explicit text color in its own dark
      theme.)*
- [ ] The cover credits "Produced by Functional Test Tool, Level Access Inc."
- [ ] The report says "Use Case" throughout, **not** "Functional Test" -- that
      wording is deliberate output, see ARCHITECTURE.md

## 8a. Untrusted file contents

Author a functional test with these in it, then perform it and open the results
dialog and the report.

- [ ] A step whose instructions are `<img src=x onerror="alert(1)">`: it reads
      back as that text everywhere, and no alert appears
- [ ] An issue whose description is `<script>alert(1)</script>`: same, in the
      issue dialog, the step's issue list, and the results table
- [ ] A start location of `javascript:alert(1)`: the Perform dialog shows it as
      plain text with no link to follow
- [ ] A start location of `https://example.org`: still a working link
- [ ] The devtools console reports **no Content Security Policy violations** at
      any point in this run. The report needs the docx library from unpkg and
      downloads through a blob URL, so generate one and watch the console while
      it runs

## 8b. Announcements

With a screen reader running. Every message below has to be *heard*, not just
appear on screen, and the two are separate elements now.

- [ ] Loading a file announces the evaluation by name
- [ ] **Save** in the functional test editor announces what it created
- [ ] Deleting a step, and deleting an extension, are each announced
- [ ] Saving two issues in a row announces **both**, not just the first
- [ ] Save on the perform screen, then go **Back**: the save message is not read
      out a second time on the landing screen, nor found there by browsing
- [ ] Dialog messages interrupt rather than wait: saving, editing and deleting
      an issue are each heard even though focus moves at the same moment
- [ ] **Save Evaluation File** puts focus back on that button and then
      announces, without the document title being read first
- [ ] **Save Functional Test Results** on the perform screen returns focus to
      **Back** and announces, without reading on into the next button
- [ ] Cancelling either picker also returns focus to the button, announcing
      nothing
- [ ] Loading a file lands focus on "Select a Functional Test" and announces the
      evaluation by name. The document title should not be read out twice first,
      nor the buttons walked through, before the message arrives
- [ ] Deleting an issue is announced, and focus lands on **New Issue** rather
      than being lost to the page
- [ ] Editing an issue is announced, with focus in the Description field
- [ ] Delete and edit an issue **with the mouse**, clicking the small trash and
      pencil icons themselves: the click lands on the icon rather than the
      button, which used to throw before anything was announced
- [ ] Deleting the only step of a test focuses **New Step** instead of throwing
- [ ] Check the issue dialog messages in **JAWS as well as NVDA**: these were
      the ones JAWS dropped when focus moved after the announcement
- [ ] Add Test, then Back, then Edit Evaluation: messages are still announced
      after moving between screens
- [ ] Generating a report announces its progress and its result

## 9. Save and diff

- [ ] The **first** save asks where to put the file; every save after it writes
      straight there with no dialog, and says so at once
- [ ] **Save Functional Test Results** on the perform screen, twice: the second
      does not open a dialog
- [ ] Load a different evaluation, then save: it asks again rather than writing
      over the file the previous one came from
- [ ] **New Evaluation**, then save: it asks again for the same reason
- [ ] **Save Evaluation File** over `C:\Users\momcc\smoke.json`
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
