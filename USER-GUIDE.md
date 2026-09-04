# Functional Accessibility Testing Tool — user guide

## Contents

- [What the tool is for](#what-the-tool-is-for)
- [Opening and saving your work](#opening-and-saving-your-work)
  - [Loading an evaluation](#loading-an-evaluation)
  - [Downloading the evaluation file](#downloading-the-evaluation-file)
  - [Downloading the report](#downloading-the-report)
  - [Unsaved changes](#unsaved-changes)
- [For scripters](#for-scripters)
  - [Starting a new evaluation](#starting-a-new-evaluation)
  - [Editing an evaluation](#editing-an-evaluation)
  - [Adding a functional test](#adding-a-functional-test)
  - [Choosing assistive technologies](#choosing-assistive-technologies)
  - [Writing steps](#writing-steps)
  - [Inserting and deleting steps](#inserting-and-deleting-steps)
  - [Extensions](#extensions)
  - [Links in a step](#links-in-a-step)
  - [Deleting a functional test](#deleting-a-functional-test)
- [For testers](#for-testers)
  - [Performing a functional test](#performing-a-functional-test)
  - [Adding an issue](#adding-an-issue)
  - [Scoring an issue](#scoring-an-issue)
  - [Editing and deleting issues](#editing-and-deleting-issues)
  - [Steps that are out of scope](#steps-that-are-out-of-scope)
  - [Scoring the functional test](#scoring-the-functional-test)
  - [The summary](#the-summary)
  - [Overall comments for an assistive technology](#overall-comments-for-an-assistive-technology)
  - [Viewing results](#viewing-results)
- [Reference](#reference)
  - [What the scores mean](#what-the-scores-mean)
  - [Keyboard notes](#keyboard-notes)

---

## What the tool is for

The tool produces an **accessibility evaluation report** from functional tests:
short scripts describing a real task a user performs, walked through with one
assistive technology, with any problems recorded against the step where they
happened.

Two people use it, usually at different times.

A **scripter** writes the scripts. They describe the task, the steps in order,
and which assistive technologies the task should be performed with.

A **tester** performs a script with one assistive technology, records the
problems they hit, scores each one, and scores the task as a whole. What they
record becomes the report.

One idea shapes everything else: **a functional test is written for exactly one
assistive technology.** A script the scripter assigns to three technologies
becomes three functional tests, sharing a number and named for the technology,
as in `01 Place a hold - NVDA`. Each is performed and scored separately, because
a task that works with one screen reader may fail with another, and the report
has to be able to say so.

---

## Opening and saving your work

Everything you do lives in the browser tab until you download it. Downloading is
what makes it permanent.

> **Chrome or Edge is required for loading and saving files.** The file controls
> use an API that Firefox and Safari do not implement. If you are in one of
> those, the tool tells you so rather than failing quietly.

### Loading an evaluation

On the home screen, choose **Load Evaluation File...** and pick a `.json`
evaluation file. The tool reads files written by older versions as well as
current ones.

Cancelling the file dialog does nothing at all — it is not an error.

If a file cannot be read you are told which problem it hit, and nothing is
loaded. Your current evaluation is left alone.

### Downloading the evaluation file

**Download Evaluation File** on the home screen writes the whole evaluation —
every script, every result — to a `.json` file. This is the file you reload next
time, and the file you send to a colleague.

The first download asks where to put it, and suggests a name taken from the
evaluation's own name. After that it writes straight back to the same file, so
you can download often without a dialog interrupting you each time.

**Download it often.** Nothing is stored on a server.

### Downloading the report

**View Evaluation Results** on the home screen shows the finished report on
screen: the scorecard, the significant issues per assistive technology, the
scoring key, and the detailed results for every use case.

**Generate Report (.docx)** in that view downloads the Word version. It arrives
named after the evaluation, so two reports from different engagements do not
land on top of each other.

### Unsaved changes

The two editing screens — **Evaluation** and **Functional Test Editor** — hold
your edits as a draft until you choose **Save changes**. The button stays
unavailable until something has actually changed, so it is never inviting you to
save nothing.

If you leave one of those screens with a draft still open, an **Unsaved changes**
dialog offers three choices:

- **Keep editing** — stay where you are
- **Discard changes** — throw the draft away and leave
- **Save and continue** — apply the draft, then leave

Separately, closing or reloading the browser tab with work that has not been
downloaded raises the browser's own warning. That is your last line of defence,
not a substitute for downloading.

---

## For scripters

### Starting a new evaluation

**New Evaluation** on the home screen opens the Evaluation screen on an empty
evaluation. If the evaluation already open has changes you have not downloaded,
you are asked before it is replaced.

Fill in the three cover fields:

| Field | What it is |
|---|---|
| **Workspace** | the organisation the work is for |
| **Asset** | the thing being evaluated — the site, app or product |
| **Evaluation** | the name of this evaluation, such as "Q3 2026 Accessibility Evaluation" |

The Asset and Evaluation appear on the report's cover, and the Evaluation name
is used for the downloaded file names.

### Editing an evaluation

**Edit Evaluation** on the home screen returns to the same screen for an
evaluation already open. Change the cover fields, add or remove functional
tests, then **Save changes**.

**Back** returns to the home screen.

### Adding a functional test

**Add Test** on the Evaluation screen opens the Functional Test Editor on a new
script. Fill in what the test is:

| Field | What it is |
|---|---|
| **Name** | the task, in a few words: "Place a hold" |
| **Goal** | what success looks like |
| **Operator** | who is performing it — "Screen reader user" |
| **Start Location** | the address the task starts from |
| **Operating System** | the platform it is performed on |
| **Application** | the application under test |

The number in front of the name is added for you. Do not type it into the Name
field.

### Choosing assistive technologies

The **Assistive Technology** button opens a list of every technology the tool
knows about. Tick each one this script should be performed with.

This is the field that decides how many functional tests you end up with. Tick
three technologies and saving produces three functional tests, identical except
for the technology in the name. They can be edited separately afterwards:
driving a screen reader through a task reads differently from driving speech
recognition through it, and the copies often should not stay identical.

**At least one technology is required** before the script can be saved.

Unticking a technology does **not** delete the script already written for it,
results and all. Deleting a functional test is what does that, and it asks
first.

Working the list from the keyboard:

- **Enter** or **Space** on the button opens it and moves focus into the list
- **Arrow keys**, **Home** and **End** move through it
- typing a letter jumps to the next technology starting with it
- **Escape** closes it and returns focus to the button, and you are told it has
  closed

### Writing steps

A new script starts with five empty steps. Write one instruction per step, in
the order a tester will follow them.

Write them as instructions to a person: *"Search for 'tide pools' and open the
first result."* The tester reads them one at a time while performing the task,
and records anything that goes wrong against the step it happened on.

### Inserting and deleting steps

**New Step** asks which position to add at. The list offers every position from
1 to one past the end, and defaults to the end, so adding to the bottom is the
quickest path. Choose a number and **Add Step** to insert there — later steps
move down.

To delete a step, use the **delete** button on the step's own row. Deleting a
step also discards anything a tester has recorded against it.

### Extensions

An **extension** is a deviation from the main path: the credentials to sign in
with, an error condition to trigger. They are what a step needs to refer to
without cluttering the instruction.

They are numbered from 1 within the test, and a step points at one by number —
*"Login credentials are located in extension 1."*

**New Extension** adds one at the end. Extensions are only ever added to the
end, because deleting one renumbers the rest, and nothing can follow that change
into the wording of a step that mentions it.

Extensions record issues exactly as steps do.

### Links in a step

Write a web address into a step's instructions as you normally would:

```
Sign in at https://catalogue.example.org/account and confirm the name is announced.
```

The address becomes a link the tester can activate while performing, opening in
a new tab so the tool stays where it is. There is no markup to learn, and
scripts you have already written gain their links without being changed.

The address must be written out in full, starting `http://` or `https://`.
`catalogue.example.org/holds` is left as plain text rather than guessed at.

### Deleting a functional test

**Delete Functional Test** on the Evaluation screen removes the selected script
and everything recorded against it. It asks first, and naming what it is about
to delete.

---

## For testers

### Performing a functional test

On the home screen, choose a functional test from the list and press
**Perform**. The name tells you which technology it is for — `01 Place a hold -
NVDA`.

The Perform screen shows the overview information, then every step and
extension in order. Each one has its instructions, a list of what has been
recorded against it, and an **Add Issue** button.

Work down the steps, performing the task with the technology named at the top.
**Get past a failure and keep going** where you can, so the whole task is
covered; that is why problems can appear on steps after a severe one.

**Download Functional Test Results** saves the whole evaluation, including
everything you have recorded. **Back** returns to the home screen — your results
stay in the tool, but they are only permanent once downloaded.

### Adding an issue

**Add Issue** on a step opens a dialog naming that step and showing its
instructions, so you can check you are recording against the right one.

Fill in:

| Field | Required | What it is |
|---|---|---|
| **Description** | yes | what went wrong, in a sentence a reader outside the test can understand |
| **Score** | yes | how severe it is — see below |
| **Finding URL** | no | a link to the finding in your issue tracker |

**Save Issue** records it. The button on the step then reads **View 1 Issue**,
and counts up as you add more.

Once an issue is recorded it also appears in the **Summary** under the score,
grouped by severity, without you having to ask for it.

### Scoring an issue

Every issue carries one of four severities:

| Score | Means |
|---|---|
| **1** | Severe — the task cannot be completed, or you have very little confidence it could be |
| **2** | Major — completion is very difficult; many users would be expected to give up |
| **3** | Minor — completion is trickier or more difficult than it should be |
| **4** | Advisory — the task is readily completed, but a change would make it easier |

**"Not Rated" is not a score.** The field starts there and the tool refuses to
save until you choose, because an unscored issue cannot be counted or grouped.
If what you want to say is that a step was not tested at all, use **Out of
scope** instead.

### Editing and deleting issues

The dialog lists every issue on the step, with **edit** and **delete** on each
row.

**Editing** updates the issue in place. If you change its score, its line moves
to the matching category in the summary. If you reword it, the summary follows
the new wording.

**Deleting** removes it from the step and from the summary.

### Steps that are out of scope

Scripts sometimes carry steps nobody is meant to perform — signing in to the
site being the usual one. Tick **Out of scope** on that step.

The step then reads **Out of scope** where its issues would be listed, and shows
**N/A** rather than a score in the results and the report. Its issues stop
counting towards anything: not the test's score, not the scorecard, not the
summary.

Unticking brings it back.

Marking a step out of scope is per performance, so the same script can have a
step skipped under one technology and tested under another.

### Scoring the functional test

Choose a **Score** under the steps. This is the score for the task as a whole,
and **choosing one is what marks the test as performed** — a test nobody has
scored is left out of the scorecard rather than counted as a pass.

The tool does not fill it in for you. If it did, every script would report as
performed the moment it was opened.

A stopper found anywhere in the test takes the task to 1: if the user cannot
complete it, the task failed, whatever else went well.

### The summary

The **Summary** under the score is the list of problems this test reports, in
severity order. It builds itself as you record issues, grouped under four
headings:

```
Stoppers:
Major Issues:
Minor Issues
Advisory
```

**View Summary** opens it for editing. You can rewrite anything there in your
own words — a comment keeps its severity because of **where it sits**, not what
it says. Reword a stopper however you like and it stays under `Stoppers:`.

The rules for editing it:

1. A **banner alone on its line** opens a section. The colon is optional.
2. Everything below it keeps that severity until the next banner.
3. Put a **blank line between comments**. A single line break inside a comment
   keeps it as one comment.
4. Text **above the first banner** carries no severity, and prints first. That is
   where a note about what the testing covered belongs.
5. To use a severity that is not there yet, type its banner line.

**Generate Summary** fills in anything the summary does not yet mention. It
merges rather than replacing, so it is always safe to press: your wording stays,
and pressing it twice changes nothing.

**Save** stores it and confirms that it has.

> A line you delete from the summary while its issue is still recorded comes
> back the next time any issue changes, because the summary follows the issues.
> Delete the issue itself to be rid of it.

### Overall comments for an assistive technology

Once you have performed the **last** test for a technology, **View Overall
Comments** appears. This is that technology's verdict on the whole evaluation.

Set the **Overall Rating** — it starts at the worst score any of that
technology's tests reached, which is an honest place to begin, and you can raise
it.

**Generate Overall Comments** fills the box with everything that technology ran
into, grouped by severity in the same format as the summary. Press it again and
nothing duplicates; your edits survive.

**Save** stores both. They appear in the report's Significant Issues section,
and the ratings are averaged into the scorecard's overall rating.

### Viewing results

**View Results** on the Perform screen shows this test as the report will print
it: the overview, a table with one row per issue, and the problem summary
grouped by severity.

In the table, each issue has its **own row and its own score**, so a step with a
stopper and two minor issues reads `1`, `3`, `3` rather than one averaged
number. The step's number and instructions span its rows.

---

## Reference

### What the scores mean

The same five-point scale scores a whole functional test:

| Score | Label |
|---|---|
| **5** | Pass - No Accessibility Problem(s) |
| **4** | Pass - Optimizations Suggested |
| **3** | Pass - Minor Accessibility Problem(s) |
| **2** | Fail - Major Accessibility Problem(s) |
| **1** | Fail - Severe Accessibility Problem(s) |

Issues use 1 to 4 from the same scale. There is no issue scored 5, because an
issue is by definition a problem.

### Keyboard notes

- Every screen names itself in the page title, so you can ask your screen reader
  which of the four you are on at any time.
- Dialogs open on their heading, with the close button immediately after it.
  **Escape** closes them.
- Status messages are announced from inside the dialog you are in, so they are
  not lost behind a modal.
- On the Perform screen, a link inside a step's instructions is a tab stop
  between the step text and its **Add Issue** button.
- The assistive technology list takes over the arrow keys and first-letter
  navigation while it is open, so those keys reach the list rather than your
  screen reader's own quick navigation.
