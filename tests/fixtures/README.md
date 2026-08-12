# Test fixtures

Two evaluation files for a fictional public library catalogue, used by the unit
tests and the golden round trips. The content is invented; what matters is that
the structure and size of the data match what the app reads and writes.

Both files use the **older field names** (`evalUCs`, `performedUCs`, `ats`,
`oses`, `startlocation`) that files saved by earlier versions contain, so
loading them exercises the rename in `src/domain/migration.ts`.

| File | Shape |
| --- | --- |
| `evaluation-legacy.json` | Saved before test runs existed: issues hang off the authoring steps and there are no runs. Also covers an array-valued operating system and a test with no assistive technology recorded. |
| `evaluation-with-runs.json` | Runs already recorded, including one test run against two assistive technologies and one run whose stored score has drifted from its issues. |

`../golden/` holds the exact bytes each file produces after a load/save round
trip. See `../golden-roundtrip.test.ts`.

Several tests assert exact counts, and the goldens record the precise bytes of
a save. After changing a fixture, regenerate and review the diff:

```bash
UPDATE_GOLDEN=1 npm test
```
